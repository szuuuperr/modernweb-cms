import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class TrackPageViewDto {
  @ApiProperty({ example: '/tour-packages/bromo-sunrise-tour' })
  @IsString()
  @Matches(/^\//, { message: 'path must start with "/"' })
  @MaxLength(500)
  path: string;
}

export class QueryPageViewsDto {
  @ApiPropertyOptional({ example: '2026-07-01', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'exact path filter' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;
}
