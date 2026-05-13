import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';

class GoogleExchangeDto {
  @IsString()
  googleIdToken!: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('google')
  @ApiOperation({ summary: 'Exchange Google ID token for EnvOps access token' })
  exchangeGoogle(@Body() body: GoogleExchangeDto) {
    return this.authService.exchangeGoogleToken(body.googleIdToken);
  }
}
