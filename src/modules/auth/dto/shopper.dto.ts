import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ShopperRequestOtpDto {
  @ApiProperty({ example: '08012345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ enum: ['sms', 'whatsapp'], default: 'sms' })
  @IsIn(['sms', 'whatsapp'])
  channel!: 'sms' | 'whatsapp';
}

/**
 * Shopper sign-in. The OTP is verified on the client (the device that receives
 * it); the backend only needs the phone number to issue tokens.
 */
export class ShopperVerifyOtpDto {
  @ApiProperty({ example: '08012345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}
