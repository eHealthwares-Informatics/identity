import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { LogoutAllDto } from '../dto/logout-all.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { LoginUseCase } from '../services/login.use-case';
import { LogoutAllUseCase } from '../services/logout-all.use-case';
import { LogoutUseCase } from '../services/logout.use-case';
import { RefreshTokenUseCase } from '../services/refresh-token.use-case';
import { RegisterUseCase } from '../services/register.use-case';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { getUserModules } from '../../roles/services/permission.data';
import { ModuleInfoDto } from '../../roles/dto/module-info.dto';

class MeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() roles!: string[];
  @ApiProperty() permissions!: string[];
  @ApiProperty() modules!: ModuleInfoDto[];
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new website user' })
  register(@Body() payload: RegisterDto): Promise<AuthResponseDto> {
    return this.registerUseCase.execute(payload);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and issue access/refresh tokens' })
  login(@Body() payload: LoginDto): Promise<AuthResponseDto> {
    return this.loginUseCase.execute(payload);
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new token pair' })
  refreshToken(@Body() payload: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.refreshTokenUseCase.execute(payload);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the presented refresh token (sign out this device)' })
  logout(@Body() payload: RefreshTokenDto): Promise<void> {
    return this.logoutUseCase.execute(payload);
  }

  @Public()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all refresh tokens for the user (sign out every device)' })
  logoutAll(
    @Headers('authorization') authHeader: string | undefined,
    @Body() payload: LogoutAllDto,
  ): Promise<void> {
    return this.logoutAllUseCase.execute(authHeader, payload.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile with modules' })
  me(@CurrentUser() currentUser: RequestUser): MeResponse {
    return {
      id: currentUser.sub,
      username: currentUser.username,
      roles: currentUser.roles,
      permissions: currentUser.permissions,
      modules: getUserModules(currentUser.permissions, currentUser.roles),
    };
  }
}
