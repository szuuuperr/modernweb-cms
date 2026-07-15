import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateMenuDto {
  @ApiProperty({ example: 'Main Navigation' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'main-nav' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (lowercase letters, numbers, dashes)',
  })
  @MaxLength(100)
  slug: string;
}

export class UpdateMenuDto extends PartialType(CreateMenuDto) {}

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Paket Wisata' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional({ example: '/tour-packages' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional({ description: 'link to a page in this website' })
  @IsOptional()
  @IsString()
  pageId?: string;

  @ApiPropertyOptional({ description: 'link to an entry in this website' })
  @IsOptional()
  @IsString()
  entryId?: string;

  @ApiPropertyOptional({ example: '_blank' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  target?: string;

  @ApiPropertyOptional({ description: 'parent item id; omit for a root item' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {}

export class ReorderMenuItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiPropertyOptional({ description: 'null/omitted moves the item to root' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order: number;
}

/** Whole-tree reorder, which is what a drag-drop admin UI produces. */
export class ReorderMenuDto {
  @ApiProperty({ type: [ReorderMenuItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderMenuItemDto)
  items: ReorderMenuItemDto[];
}
