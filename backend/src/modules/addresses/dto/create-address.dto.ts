import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AddressLabel } from '../schemas/address.schema';
import { AdminDivisionDto } from './admin-division.dto';

export class CreateAddressDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ type: AdminDivisionDto })
  @ValidateNested()
  @Type(() => AdminDivisionDto)
  province!: AdminDivisionDto;

  @ApiProperty({ type: AdminDivisionDto })
  @ValidateNested()
  @Type(() => AdminDivisionDto)
  district!: AdminDivisionDto;

  @ApiProperty({ type: AdminDivisionDto })
  @ValidateNested()
  @Type(() => AdminDivisionDto)
  ward!: AdminDivisionDto;

  @ApiProperty({ example: '123 Đường ABC, Phường XYZ' })
  @IsString()
  streetAddress!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: AddressLabel, example: AddressLabel.HOME })
  @IsOptional()
  @IsEnum(AddressLabel)
  label?: AddressLabel;
}
