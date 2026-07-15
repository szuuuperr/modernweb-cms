import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookie: AuthCookieService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withRefreshCookie(res, await this.authService.register(dto));
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.withRefreshCookie(res, await this.authService.login(dto));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Cookie first (browser clients); the body stays as a fallback for callers
    // that cannot hold cookies at all.
    const token = this.authCookie.read(req) ?? dto.refreshToken;
    if (!token) throw new UnauthorizedException('Missing refresh token');
    return this.withRefreshCookie(res, await this.authService.refresh(token));
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): void {
    this.authCookie.clear(res);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /**
   * The refresh token leaves over Set-Cookie only — echoing it in the body too
   * would hand it straight back to any script running in the panel, which is
   * the exact thing httpOnly is here to prevent.
   */
  private withRefreshCookie<T extends TokenPair>(
    res: Response,
    result: T,
  ): Omit<T, 'refreshToken'> {
    const { refreshToken, ...rest } = result;
    this.authCookie.set(res, refreshToken);
    return rest;
  }
}
