import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteFileDto {
  @ApiProperty({
    example: 'ecommerce/abc123',
    description: 'Cloudinary public_id của file',
  })
  @IsString()
  @IsNotEmpty()
  publicId!: string;
}
