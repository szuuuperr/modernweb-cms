import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FieldType } from '../../../generated/prisma/client';

export class CreateFieldDto {
  @ApiProperty({ example: 'Price' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'price',
    description: 'Key used in entry data JSON (snake_case or camelCase)',
  })
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message:
      'key must start with a letter and contain only letters, numbers, underscores',
  })
  @MaxLength(60)
  key: string;

  @ApiProperty({ enum: FieldType })
  @IsEnum(FieldType)
  type: FieldType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    description:
      'Type-specific options, e.g. { "choices": ["a", "b"] } for SELECT',
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class UpdateFieldDto extends PartialType(CreateFieldDto) {}
