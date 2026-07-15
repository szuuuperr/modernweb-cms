import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WebsiteStatus } from '../../../generated/prisma/client';

export class CreateWebsiteDto {
  @ApiProperty({ example: 'Halwa Travel' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'halwa-travel' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (lowercase letters, numbers, dashes)',
  })
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ example: 'halwatravel.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;
}

export class UpdateWebsiteDto extends PartialType(CreateWebsiteDto) {
  @ApiPropertyOptional({ enum: WebsiteStatus })
  @IsOptional()
  @IsEnum(WebsiteStatus)
  status?: WebsiteStatus;

  @ApiPropertyOptional({
    default: false,
    description: 'require a valid x-api-key on the public Content API',
  })
  @IsOptional()
  @IsBoolean()
  requireApiKey?: boolean;
}
