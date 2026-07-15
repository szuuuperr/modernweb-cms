import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Vercel production' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class ApiKeyCreatedDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'mwc_a1b2c3d4' })
  prefix: string;

  @ApiProperty({
    description:
      'The full key. Shown once, at creation — it is not recoverable.',
    example: 'mwc_a1b2c3d4_v3ry53cr3t...',
  })
  key: string;

  @ApiProperty()
  createdAt: Date;
}
