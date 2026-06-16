import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from '@nestjs/cache-manager';
import { Types } from 'mongoose';
import { CategoriesRepository } from './categories.repository';
import { CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ProductsRepository } from '../products/products.repository';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { CacheKeys } from '../../common/constants/cache-keys.constant';
import { generateSlug } from '../../common/utils/slug.util';

const TREE_CACHE_TTL_MS = 60 * 60 * 1000; // 60 phút
const SLUG_CACHE_TTL_MS = 60 * 60 * 1000; // 60 phút

export interface CategoryTreeNode {
  _id: string;
  name: string;
  slug: string;
  image: string;
  order: number;
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly productsRepository: ProductsRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const cached = await this.cache.get<CategoryTreeNode[]>(
      CacheKeys.CATEGORIES_TREE,
    );
    if (cached) {
      this.logger.log('[Cache] HIT categories:tree');
      return cached;
    }
    this.logger.log('[Cache] MISS categories:tree');

    const categories = await this.categoriesRepository.findAll({
      isActive: true,
    });

    const tree = this.buildTree(categories);

    await this.cache.set(CacheKeys.CATEGORIES_TREE, tree, TREE_CACHE_TTL_MS);
    return tree;
  }

  async getCategoryBySlug(slug: string): Promise<CategoryDocument> {
    const cacheKey = CacheKeys.CATEGORY_BY_SLUG(slug);
    const cached = await this.cache.get<CategoryDocument>(cacheKey);
    if (cached) {
      this.logger.log(`[Cache] HIT ${cacheKey}`);
      return cached;
    }
    this.logger.log(`[Cache] MISS ${cacheKey}`);

    const category = await this.categoriesRepository.findBySlug(slug);
    if (!category) {
      throw new BusinessException(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Danh mục không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.cache.set(cacheKey, category, SLUG_CACHE_TTL_MS);
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    if (dto.parentId) {
      const parent = await this.categoriesRepository.findById(dto.parentId);
      if (!parent) {
        throw new BusinessException(
          ErrorCodes.CATEGORY_PARENT_NOT_FOUND,
          'Danh mục cha không tồn tại',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const slug = await this.generateUniqueSlugForCategory(dto.name);

    const category = await this.categoriesRepository.create({
      ...dto,
      slug,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
    });

    await this.invalidateListCaches();
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new BusinessException(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Danh mục không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BusinessException(
          ErrorCodes.CATEGORY_CIRCULAR_REFERENCE,
          'Danh mục không thể là cha của chính nó',
          HttpStatus.BAD_REQUEST,
        );
      }

      const parent = await this.categoriesRepository.findById(dto.parentId);
      if (!parent) {
        throw new BusinessException(
          ErrorCodes.CATEGORY_PARENT_NOT_FOUND,
          'Danh mục cha không tồn tại',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Chặn vòng lặp: parent mới không được là con (cháu) của category này
      let current: CategoryDocument | null = parent;
      while (current?.parentId) {
        if (current.parentId.toString() === id) {
          throw new BusinessException(
            ErrorCodes.CATEGORY_CIRCULAR_REFERENCE,
            'Phát hiện vòng lặp danh mục cha-con',
            HttpStatus.BAD_REQUEST,
          );
        }
        current = await this.categoriesRepository.findById(current.parentId);
      }
    }

    const updateData: Partial<typeof category> & {
      parentId?: Types.ObjectId | null;
    } = { ...dto } as Partial<typeof category>;
    if (dto.parentId !== undefined) {
      updateData.parentId = dto.parentId
        ? new Types.ObjectId(dto.parentId)
        : null;
    }

    const updated = await this.categoriesRepository.update(id, updateData);
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Danh mục không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.invalidateListCaches();
    await this.cache.del(CacheKeys.CATEGORY_BY_SLUG(category.slug));
    return updated;
  }

  async delete(id: string): Promise<void> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new BusinessException(
        ErrorCodes.CATEGORY_NOT_FOUND,
        'Danh mục không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const activeProductCount =
      await this.productsRepository.countActiveByCategory(id);
    if (activeProductCount > 0) {
      throw new BusinessException(
        ErrorCodes.CATEGORY_HAS_PRODUCTS,
        'Không thể xóa danh mục đang có sản phẩm',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const childrenCount = await this.categoriesRepository.countChildren(id);
    if (childrenCount > 0) {
      throw new BusinessException(
        ErrorCodes.CATEGORY_HAS_CHILDREN,
        'Không thể xóa danh mục đang có danh mục con',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.categoriesRepository.delete(id);
    await this.invalidateListCaches();
    await this.cache.del(CacheKeys.CATEGORY_BY_SLUG(category.slug));
  }

  private async generateUniqueSlugForCategory(name: string): Promise<string> {
    const base = generateSlug(name);
    let slug = base;
    let suffix = 1;
    while (await this.categoriesRepository.existsBySlug(slug)) {
      slug = `${base}-${++suffix}`;
    }
    return slug;
  }

  private buildTree(categories: CategoryDocument[]): CategoryTreeNode[] {
    const nodeMap = new Map<string, CategoryTreeNode>();
    for (const cat of categories) {
      nodeMap.set(cat._id.toString(), {
        _id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug,
        image: cat.image,
        order: cat.order,
        children: [],
      });
    }

    const roots: CategoryTreeNode[] = [];
    for (const cat of categories) {
      const node = nodeMap.get(cat._id.toString());
      if (!node) continue;

      if (cat.parentId) {
        const parentNode = nodeMap.get(cat.parentId.toString());
        if (parentNode) {
          parentNode.children.push(node);
          continue;
        }
      }
      roots.push(node);
    }

    return roots;
  }

  private async invalidateListCaches(): Promise<void> {
    await this.cache.del(CacheKeys.CATEGORIES_TREE);
  }
}
