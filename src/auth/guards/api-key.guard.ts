import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { DatabaseService } from '../../database/database.service.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = request.headers['x-api-key'];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.databaseService
      .db('api_keys')
      .where({ key_hash: keyHash })
      .first();

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    void this.databaseService
      .db('api_keys')
      .where({ id: apiKey.id })
      .update({ last_used_at: this.databaseService.db.fn.now() });

    return true;
  }
}
