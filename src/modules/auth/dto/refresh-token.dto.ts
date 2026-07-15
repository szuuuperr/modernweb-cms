import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  /**
   * Optional: browser clients send the token in the httpOnly refresh cookie
   * instead, and the cookie takes precedence over this field.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
