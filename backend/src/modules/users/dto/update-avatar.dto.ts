import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpdateAvatarDto {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v1/ecommerce/avatar.jpg',
  })
  @IsString()
  @Matches(/^https:\/\/res\.cloudinary\.com\/.+/, {
    message: 'avatarUrl phải là URL hợp lệ từ Cloudinary',
  })
  avatarUrl!: string;
}
