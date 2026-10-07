import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

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
  @ApiPropertyOptional({ description: 'OAuth access token from Google' })
  @IsString()
  @IsOptional()
  accessToken?: string;

  @ApiPropertyOptional({
    description:
      'Google ID token (Credential Manager / One Tap) verified server-side',
  })
  @IsString()
  @IsOptional()
  idToken?: string;
}

export class WebsiteForgotPasswordDto {
  @ApiProperty({ example: 'shopper@example.com' })
  @IsEmail()
  email!: string;
}

export class WebsiteResetPasswordDto {
  @ApiProperty({ description: 'Reset token from the emailed link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class WebsiteRequestEmailVerificationDto {
  @ApiProperty({ example: 'shopper@example.com' })
  @IsEmail()
  email!: string;
}

export class WebsiteVerifyEmailDto {
  @ApiProperty({ description: 'Verification token from the emailed link' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
