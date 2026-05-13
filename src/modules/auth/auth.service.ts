import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

type AuthTokenPayload = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  async exchangeGoogleToken(googleIdToken: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('GOOGLE_CLIENT_ID is not configured');
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken: googleIdToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google token payload');
    }

    const authPayload: AuthTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    const token = this.signAccessToken(authPayload);
    return {
      accessToken: token,
      user: {
        id: authPayload.sub,
        email: authPayload.email,
        name: authPayload.name,
        picture: authPayload.picture,
      },
      expiresIn: this.tokenExpirySeconds(),
    };
  }

  verifyAccessToken(token: string) {
    const secret = this.accessTokenSecret();
    try {
      return jwt.verify(token, secret) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private signAccessToken(payload: AuthTokenPayload) {
    const secret = this.accessTokenSecret();
    return jwt.sign(payload, secret, {
      expiresIn: this.tokenTtl() as jwt.SignOptions['expiresIn'],
    });
  }

  private accessTokenSecret() {
    const secret = this.configService.get<string>('ACCESS_TOKEN_SECRET');
    if (!secret) {
      throw new BadRequestException('ACCESS_TOKEN_SECRET is not configured');
    }
    return secret;
  }

  private tokenTtl() {
    return this.configService.get<string>('ACCESS_TOKEN_TTL') || '1h';
  }

  private tokenExpirySeconds() {
    const ttl = this.tokenTtl();
    if (ttl.endsWith('h')) return Number(ttl.slice(0, -1)) * 3600;
    if (ttl.endsWith('m')) return Number(ttl.slice(0, -1)) * 60;
    if (ttl.endsWith('s')) return Number(ttl.slice(0, -1));
    const asNumber = Number(ttl);
    return Number.isFinite(asNumber) ? asNumber : 3600;
  }
}
