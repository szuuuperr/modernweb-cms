import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { SeoTarget } from '../../../generated/prisma/client';

export class SeoTargetParamsDto {
  @ApiProperty({ enum: SeoTarget })
  @IsEnum(SeoTarget)
  targetType: SeoTarget;

  @ApiProperty()
  @IsString()
  targetId: string;
}

export class UpsertSeoDto {
  @ApiPropertyOptional({ example: 'Paket Wisata Bromo 3 Hari' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/og.jpg' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  ogImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://halwatravel.com/tour/bromo' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  canonicalUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;

  @ApiPropertyOptional({
    description: 'free-form extras (twitter card, structured data, ...)',
  })
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}

export class UpsertSeoDefaultsDto {
  @ApiPropertyOptional({
    example: '%s | Halwa Travel',
    description: '%s is replaced with the target metaTitle',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleTemplate?: string;

  @ApiPropertyOptional({ description: 'fallback title when a target has none' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  ogImageUrl?: string;
}
