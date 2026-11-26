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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { CreateApiKeyDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags('Auth & API Keys')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @ApiOperation({ summary: 'Register CMS Account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login to access CMS' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate API Key' })
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
  @ApiOperation({ summary: 'Get list valid API Key' })
  listApiKeys() {
    return this.authService.listApiKeys();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get API Key By Id' })
  @Delete('api-keys/:id')
  revokeApiKey(@Param('id') id: string) {
    return this.authService.revokeApiKey(id);
  }
}
