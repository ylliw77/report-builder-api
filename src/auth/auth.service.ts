import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service.js';
import { CreateApiKeyDto, LoginDto, RegisterDto } from './dto/auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.databaseService
      .db('users')
      .where({ email: dto.email.toLowerCase() })
      .first();

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const [user] = await this.databaseService
      .db('users')
      .insert({
        email: dto.email.toLowerCase(),
        name: dto.name,
        password_hash: passwordHash,
      })
      .returning(['id', 'email', 'name', 'created_at']);

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.databaseService
      .db('users')
      .where({ email: dto.email.toLowerCase() })
      .first();

    if (!user || !(await bcrypt.compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      access_token: accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async createApiKey(userId: string, dto: CreateApiKeyDto) {
    const plainKey = `rb_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');

    const [created] = await this.databaseService
      .db('api_keys')
      .insert({
        name: dto.name,
        key_prefix: plainKey.slice(0, 10),
        key_hash: keyHash,
        created_by: userId,
      })
      .returning(['id', 'name', 'key_prefix', 'created_at']);

    // Plain key is returned ONCE here; save it in your external app
    return { ...created, api_key: plainKey };
  }

  async listApiKeys() {
    return this.databaseService
      .db('api_keys')
      .select('id', 'name', 'key_prefix', 'last_used_at', 'created_at')
      .orderBy('created_at', 'desc');
  }

  async revokeApiKey(id: string) {
    await this.databaseService.db('api_keys').where({ id }).del();
    return { deleted: true, id };
  }
}
