import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PageStatus } from '../../../generated/prisma/client';

/**
 * A block is an opaque, frontend-defined section. The CMS only guarantees that
 * every block has a `type`; `props` stay free-form so a new block type never
 * requires a backend change.
 */
export class PageBlockDto {
  @ApiProperty({ example: 'hero' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({ example: { heading: 'Selamat datang' } })
  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>;
}

export class CreatePageDto {
  @ApiProperty({ example: 'Tentang Kami' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'tentang-kami' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (lowercase letters, numbers, dashes)',
  })
  @MaxLength(200)
  slug: string;

  @ApiPropertyOptional({ type: [PageBlockDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageBlockDto)
  blocks?: PageBlockDto[];

  @ApiPropertyOptional({ enum: PageStatus, default: PageStatus.DRAFT })
  @IsOptional()
  @IsEnum(PageStatus)
  status?: PageStatus;
}

export class UpdatePageDto extends PartialType(CreatePageDto) {}

export class QueryPagesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PageStatus })
  @IsOptional()
  @IsEnum(PageStatus)
  status?: PageStatus;

  @ApiPropertyOptional({
    description: 'case-insensitive match on title or slug',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
