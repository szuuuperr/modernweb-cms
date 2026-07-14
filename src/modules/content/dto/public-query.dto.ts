import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PublicQueryEntriesDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'publishedAt:desc',
    description: 'column:direction; columns: createdAt, updatedAt, publishedAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: 'filter[key][op]=value; ops: eq, ne, gt, gte, lt, lte, contains',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @Allow()
  filter?: Record<string, Record<string, string>>;
}
