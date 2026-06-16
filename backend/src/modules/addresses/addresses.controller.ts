import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import type { AddressDocument } from './schemas/address.schema';
import type { Types } from 'mongoose';

@ApiTags('Addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách địa chỉ của tôi' })
  @ApiResponse({ status: 200, description: 'Danh sách địa chỉ' })
  async getAddresses(
    @CurrentUser('_id') userId: string,
  ): Promise<AddressDocument[]> {
    return this.addressesService.getAddresses(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm địa chỉ mới' })
  @ApiResponse({ status: 201, description: 'Tạo địa chỉ thành công' })
  @ApiResponse({ status: 422, description: 'Đã đạt giới hạn số địa chỉ' })
  async create(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressDocument> {
    return this.addressesService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật địa chỉ' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Địa chỉ không tồn tại' })
  async update(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressDocument> {
    return this.addressesService.update(userId, id.toString(), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa địa chỉ' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 422, description: 'Không thể xóa địa chỉ mặc định' })
  async delete(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<{ message: string }> {
    await this.addressesService.delete(userId, id.toString());
    return { message: 'Xóa địa chỉ thành công' };
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Đặt làm địa chỉ mặc định' })
  @ApiResponse({ status: 200, description: 'Đặt mặc định thành công' })
  async setDefault(
    @CurrentUser('_id') userId: string,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ): Promise<AddressDocument> {
    return this.addressesService.setDefault(userId, id.toString());
  }
}
