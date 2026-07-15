import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WEBHOOK_EVENTS } from '../webhook-events';

export class CreateWebhookDto {
  @ApiProperty({ example: 'Next.js ISR revalidate' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'https://halwatravel.com/api/revalidate' })
  // require_tld is off so http://localhost receivers work in dev; without
  // require_protocol that would also accept bare strings like "not-a-url".
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  @MaxLength(2000)
  url: string;

  @ApiProperty({
    enum: WEBHOOK_EVENTS,
    isArray: true,
    example: ['entry.published', 'page.published'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {}
