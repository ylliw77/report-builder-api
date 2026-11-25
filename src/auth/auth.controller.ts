import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { CreateApiKeyDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags('Auth & API Keys')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('api-keys')
  createApiKey(
    @Req() req: Request & { user: { sub: string } },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.authService.createApiKey(req.user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('api-keys')
  listApiKeys() {
    return this.authService.listApiKeys();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('api-keys/:id')
  revokeApiKey(@Param('id') id: string) {
    return this.authService.revokeApiKey(id);
  }
}
