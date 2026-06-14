import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { SessionAuthGuard } from './session-auth.guard';
import type { AuthenticatedRequest } from './authenticated-request';

@Controller('api/v1')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(SessionAuthGuard)
  @Post('auth/logout')
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.auth.sessionId);
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(
      request.auth.user.id,
      request.auth.organization.id,
    );
  }
}
