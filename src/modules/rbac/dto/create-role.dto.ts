import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayNotEmpty, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS, Permission } from '../permissions';

export class CreateRoleDto {
  @ApiProperty({ example: 'Content Editor' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ enum: PERMISSIONS, isArray: true })
  @ArrayNotEmpty()
  @IsIn(PERMISSIONS, { each: true })
  permissions: Permission[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @ApiPropertyOptional({ enum: PERMISSIONS, isArray: true })
  declare permissions?: Permission[];
}
