import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v1/ecommerce/abc123.jpg',
  })
  url!: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/w_400,h_400,c_fill/ecommerce/abc123.jpg',
  })
  thumbnailUrl!: string;

  @ApiProperty({ example: 'ecommerce/abc123' })
  publicId!: string;

  @ApiProperty({ example: 1200 })
  width!: number;

  @ApiProperty({ example: 800 })
  height!: number;

  @ApiProperty({ example: 'jpg' })
  format!: string;

  @ApiProperty({ example: 204800, description: 'File size in bytes' })
  size!: number;
}
