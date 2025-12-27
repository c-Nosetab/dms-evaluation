import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AuthService, AuthUser } from './auth.service';

@Injectable()
export class SessionStrategy extends PassportStrategy(Strategy, 'session') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: Request): Promise<AuthUser> {
    // NextAuth stores session token in cookies
    // Cookie name depends on environment:
    // - __Secure-authjs.session-token (production with HTTPS)
    // - authjs.session-token (development)
    const sessionToken =
      req.cookies?.['__Secure-authjs.session-token'] ||
      req.cookies?.['authjs.session-token'] ||
      req.cookies?.['next-auth.session-token'] ||
      req.cookies?.['__Secure-next-auth.session-token'];

    if (!sessionToken) {
      throw new UnauthorizedException('No session token found');
    }

    const user = await this.authService.validateSession(sessionToken);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return user;
  }
}
