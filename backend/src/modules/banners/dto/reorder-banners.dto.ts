import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

export class ReorderBannersDto {
  @ApiProperty({
    type: [String],
    example: ['id1', 'id2', 'id3'],
    description: 'Banner IDs in the desired display order',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  orderedIds!: string[];
}
