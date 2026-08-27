import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'cashier01' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'P@ssw0rd!' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Assigned location UUID' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ example: ['cashier'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional({ description: 'Per-user session timeout in minutes (null = system default)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  loginTimeoutMinutes?: number | null;
}
