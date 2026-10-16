import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ExpandPermissionsDto {
  @ApiProperty({
    description:
      'Granted codes, which may include wildcards (e.g. rxsoft.catalog.*). Wildcards are resolved to concrete catalog codes.',
    type: [String],
    example: ['rxsoft.catalog.*', 'shop.pos'],
  })
  @IsArray()
  @IsString({ each: true })
  codes!: string[];
}
