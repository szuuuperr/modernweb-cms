import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { EntryStatus } from '../../../generated/prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateEntryDto {
  @ApiProperty({
    description: 'Entry data keyed by field key',
    example: { title: 'Bromo Tour', price: 1500000 },
  })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({ enum: EntryStatus, default: EntryStatus.DRAFT })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;
}

export class UpdateEntryDto {
  @ApiProperty({ description: 'Partial entry data keyed by field key' })
  @IsObject()
  data: Record<string, unknown>;
}

export class QueryEntriesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EntryStatus })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description: 'column:direction; columns: createdAt, updatedAt, publishedAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description:
      'filter[key][op]=value; ops: eq, ne, gt, gte, lt, lte, contains',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @Allow()
  filter?: Record<string, Record<string, string>>;
}
