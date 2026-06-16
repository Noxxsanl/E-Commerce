import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  token!: string;

  @ApiProperty({
    example: 'NewPassword@123',
    description: 'Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
  })
  newPassword!: string;
}
