import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerifyEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
