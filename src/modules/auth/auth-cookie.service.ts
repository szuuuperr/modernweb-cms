import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

export const REFRESH_COOKIE = 'mwc_rt';

/**
 * The refresh token lives in an httpOnly cookie so a script injected into the
 * admin panel cannot read it; the access token stays in the panel's memory and
 * travels as a Bearer header. That split is also what keeps this CSRF-free:
 * the cookie alone authenticates nothing but /auth/refresh, and the access
 * token it returns can only be read by an origin CORS already trusts.
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  set(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE, refreshToken, this.options());
  }

  clear(res: Response): void {
    // maxAge must be omitted here or the attributes stop matching and the
    // browser keeps the original cookie.
    const { maxAge: _maxAge, ...options } = this.options();
    res.clearCookie(REFRESH_COOKIE, options);
  }

  read(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      // Off only for plain-HTTP local dev; SameSite=None *requires* Secure.
      secure: this.config.get<string>('COOKIE_SECURE', 'true') !== 'false',
      // cms.modernwebid.com and api.modernwebid.com are the same site, so Lax
      // is enough and keeps the cookie off other sites entirely. Deployments
      // where the panel sits on a different registrable domain (a *.vercel.app
      // preview) need "none", which is why this is configurable.
      sameSite: this.config.get<CookieOptions['sameSite']>(
        'COOKIE_SAMESITE',
        'lax',
      ),
      // Host-only on purpose: no Domain attribute, so the cookie never leaks to
      // sibling subdomains. Scoped to the only routes that consume it.
      path: '/api/v1/auth',
      maxAge: parseDuration(
        this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      ),
    };
  }
}

const UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Mirrors the "7d"/"15m" syntax jsonwebtoken accepts for expiresIn. */
function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return seconds * 1000;
    throw new Error(`Unsupported JWT_REFRESH_EXPIRES_IN value: ${value}`);
  }
  return Number(match[1]) * UNITS[match[2]];
}
