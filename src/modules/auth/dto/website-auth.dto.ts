import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class WebsiteRequestOtpDto {
  @ApiProperty({ example: '08012345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ enum: ['sms', 'whatsapp'], default: 'sms' })
  @IsIn(['sms', 'whatsapp'])
  @IsOptional()
  channel?: 'sms' | 'whatsapp';
}

export class WebsiteVerifyOtpDto {
  @ApiProperty({ example: '08012345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class WebsiteOAuthDto {
  @ApiProperty({ description: 'OAuth access token from Google' })
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}
