import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FieldType } from '../../../generated/prisma/client';

/** Same shape as a collection Field, so the entry validator can be reused. */
export class FormFieldDto {
  @ApiProperty({ example: 'email' })
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: 'key must start with a letter and contain only letters/digits/_',
  })
  @MaxLength(50)
  key: string;

  @ApiProperty({ example: 'Email' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: FieldType, example: FieldType.TEXT })
  @IsEnum(FieldType)
  type: FieldType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: { choices: ['umum', 'kerjasama'] } })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class CreateFormDto {
  @ApiProperty({ example: 'Kontak' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'kontak' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (lowercase letters, numbers, dashes)',
  })
  @MaxLength(100)
  slug: string;

  @ApiProperty({ type: [FormFieldDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields: FormFieldDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ['sales@halwatravel.com'],
    description: 'notified on each submission; empty disables notification',
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  notifyEmails?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateFormDto extends PartialType(CreateFormDto) {}

export class SubmitFormDto {
  @ApiProperty({
    description: 'values keyed by field key',
    example: { name: 'Budi', email: 'budi@example.com', message: 'Halo' },
  })
  @IsObject()
  data: Record<string, unknown>;
}
