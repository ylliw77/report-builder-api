import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  public readonly db: Knex;

  constructor(private configService: ConfigService) {
    this.db = knex({
      client: 'pg',
      connection: this.configService.get<string>('CMS_DATABASE_URL'),
      pool: { min: 2, max: 10 },
    });
  }

  async onModuleDestroy() {
    await this.db.destroy();
  }
}
