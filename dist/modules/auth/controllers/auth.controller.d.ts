import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { LoginUseCase } from '../services/login.use-case';
import { RefreshTokenUseCase } from '../services/refresh-token.use-case';
import { RegisterUseCase } from '../services/register.use-case';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ModuleInfoDto } from '../../roles/dto/module-info.dto';
declare class MeResponse {
    id: string;
    username: string;
    roles: string[];
    permissions: string[];
    modules: ModuleInfoDto[];
}
export declare class AuthController {
    private readonly loginUseCase;
    private readonly refreshTokenUseCase;
    private readonly registerUseCase;
    constructor(loginUseCase: LoginUseCase, refreshTokenUseCase: RefreshTokenUseCase, registerUseCase: RegisterUseCase);
    register(payload: RegisterDto): Promise<AuthResponseDto>;
    login(payload: LoginDto): Promise<AuthResponseDto>;
    refreshToken(payload: RefreshTokenDto): Promise<AuthResponseDto>;
    me(currentUser: RequestUser): MeResponse;
}
export {};
