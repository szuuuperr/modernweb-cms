import { ApiProperty } from '@nestjs/swagger';
import {
  Allow,
  IsDefined,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpsertSettingDto {
  @ApiProperty({
    description: 'any JSON value: string, number, boolean, object or array',
    example: { phone: '+62 812 0000 0000', whatsapp: '+62 812 0000 0000' },
  })
  @IsDefined()
  @Allow()
  value: unknown;
}

export class SettingKeyParamDto {
  @ApiProperty({ example: 'contact' })
  @IsString()
  @Matches(/^[a-z0-9]+([._-][a-z0-9]+)*$/, {
    message: 'key must be lowercase alphanumeric, separated by . _ or -',
  })
  @MaxLength(100)
  key: string;
}
