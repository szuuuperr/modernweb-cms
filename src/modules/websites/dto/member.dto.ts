import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ description: 'Email of an existing user' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Role id belonging to this website' })
  @IsString()
  roleId: string;
}

export class UpdateMemberDto {
  @ApiProperty({ description: 'Role id belonging to this website' })
  @IsString()
  roleId: string;
}
