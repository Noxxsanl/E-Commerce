import { Model } from 'mongoose';
import { PaginatedResultDto } from '../dto/paginated-result.dto';

interface PaginateOptions {
  page: number;
  limit: number;
}

export async function paginate<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  sort: Record<string, 1 | -1>,
  { page, limit }: PaginateOptions,
): Promise<PaginatedResultDto<T>> {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
    model.countDocuments(filter).exec(),
  ]);

  return {
    items: items as unknown as T[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
