import { HttpStatus, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AddressesRepository } from './addresses.repository';
import { AddressDocument } from './schemas/address.schema';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCodes } from '../../common/constants/error-codes.constant';
import { LIMITS } from '../../common/constants/app.constant';

@Injectable()
export class AddressesService {
  constructor(private readonly addressesRepository: AddressesRepository) {}

  async getAddresses(userId: string): Promise<AddressDocument[]> {
    return this.addressesRepository.findByUserId(userId);
  }

  async create(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<AddressDocument> {
    const count = await this.addressesRepository.countByUser(userId);
    if (count >= LIMITS.ADDRESS_MAX_PER_USER) {
      throw new BusinessException(
        ErrorCodes.ADDRESS_LIMIT_REACHED,
        `Bạn chỉ có thể lưu tối đa ${LIMITS.ADDRESS_MAX_PER_USER} địa chỉ`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const isFirstAddress = count === 0;
    const shouldBeDefault = isFirstAddress || dto.isDefault === true;

    if (shouldBeDefault) {
      await this.addressesRepository.unsetDefault(userId);
    }

    return this.addressesRepository.create({
      ...dto,
      userId: new Types.ObjectId(userId),
      isDefault: shouldBeDefault,
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<AddressDocument> {
    const address = await this.addressesRepository.findByIdAndUser(id, userId);
    if (!address) {
      throw new BusinessException(
        ErrorCodes.ADDRESS_NOT_FOUND,
        'Địa chỉ không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.isDefault === true) {
      await this.addressesRepository.unsetDefault(userId);
    }

    const updated = await this.addressesRepository.update(id, dto);
    if (!updated) {
      throw new BusinessException(
        ErrorCodes.ADDRESS_NOT_FOUND,
        'Địa chỉ không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }
    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    const address = await this.addressesRepository.findByIdAndUser(id, userId);
    if (!address) {
      throw new BusinessException(
        ErrorCodes.ADDRESS_NOT_FOUND,
        'Địa chỉ không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    if (address.isDefault) {
      throw new BusinessException(
        ErrorCodes.ADDRESS_CANNOT_DELETE_DEFAULT,
        'Không thể xóa địa chỉ mặc định. Vui lòng đặt địa chỉ khác làm mặc định trước.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.addressesRepository.delete(id);
  }

  async setDefault(userId: string, id: string): Promise<AddressDocument> {
    const address = await this.addressesRepository.findByIdAndUser(id, userId);
    if (!address) {
      throw new BusinessException(
        ErrorCodes.ADDRESS_NOT_FOUND,
        'Địa chỉ không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.addressesRepository.unsetDefault(userId);
    await this.addressesRepository.setDefault(id, userId);

    const updated = await this.addressesRepository.findByIdAndUser(id, userId);
    return updated as AddressDocument;
  }
}
