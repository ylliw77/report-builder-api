import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';
import { encrypt, decrypt } from '../common/crypto.util.js';
import { DatabaseService } from '../database/database.service.js';
import { SupportedClient, CreateDatasourceDto } from './dto/create-datasource.dto.js';
import { UpdateDatasourceDto } from './dto/update-datasource.dto.js';
import { QueryPreviewDto } from './dto/query-preview.dto.js';

export interface DataSourceConfig {
  id: string;
  name: string;
  client: SupportedClient;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

const PUBLIC_COLUMNS = [
  'id',
  'name',
  'client',
  'host',
  'port',
  'username',
  'database',
  'created_at',
  'updated_at',
];

@Injectable()
export class DatasourceService implements OnModuleDestroy {
  private pools = new Map<string, Knex>();
  private readonly encryptionKey: string;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async create(dto: CreateDatasourceDto) {
    const encryptedPassword = encrypt(dto.password, this.encryptionKey);

    const [created] = await this.databaseService
      .db('data_sources')
      .insert({
        name: dto.name,
        client: dto.client,
        host: dto.host,
        port: dto.port,
        username: dto.username,
        password: encryptedPassword,
        database: dto.database,
      })
      .returning(PUBLIC_COLUMNS);

    return created;
  }

  async findAll() {
    return this.databaseService
      .db('data_sources')
      .select(PUBLIC_COLUMNS)
      .orderBy('created_at', 'desc');
  }

  async findOne(id: string) {
    const row = await this.databaseService
      .db('data_sources')
      .select(PUBLIC_COLUMNS)
      .where({ id })
      .first();

    if (!row) {
      throw new NotFoundException(`DataSource ${id} not found`);
    }
    return row;
  }

  // Internal helper for ReportsService (returns decrypted password)
  async findOneWithCredentials(id: string): Promise<DataSourceConfig> {
    const row = await this.databaseService
      .db<DataSourceConfig>('data_sources')
      .where({ id })
      .first();

    if (!row) {
      throw new NotFoundException(`DataSource ${id} not found`);
    }

    return {
      ...row,
      password: decrypt(row.password, this.encryptionKey),
    };
  }

  async update(id: string, dto: UpdateDatasourceDto) {
    await this.findOne(id);

    const updatePayload: Record<string, unknown> = {
      ...dto,
      updated_at: this.databaseService.db.fn.now(),
    };

    if (dto.password) {
      updatePayload.password = encrypt(dto.password, this.encryptionKey);
    }

    const [updated] = await this.databaseService
      .db('data_sources')
      .where({ id })
      .update(updatePayload)
      .returning(PUBLIC_COLUMNS);

    // Evict cached pool so updated credentials take effect immediately
    await this.destroyPool(id);

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.destroyPool(id);
    await this.databaseService.db('data_sources').where({ id }).del();
    return { deleted: true, id };
  }

  async testConnection(dto: CreateDatasourceDto) {
    const tempDb = knex({
      client: dto.client,
      connection: {
        host: dto.host,
        port: dto.port,
        user: dto.username,
        password: dto.password,
        database: dto.database,
      },
      pool: { min: 0, max: 1 },
      acquireConnectionTimeout: 5000,
    });

    try {
      await tempDb.raw('SELECT 1');
      return { ok: true, message: 'Connection successful' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Connection failed: ${message}`);
    } finally {
      await tempDb.destroy();
    }
  }

  getConnection(config: DataSourceConfig): Knex {
    if (this.pools.has(config.id)) {
      return this.pools.get(config.id)!;
    }

    const instance = knex({
      client: config.client,
      connection: {
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
      },
      pool: { min: 0, max: 5 },
    });

    this.pools.set(config.id, instance);
    return instance;
  }

  async executeQuery(
    config: DataSourceConfig,
    sql: string,
    bindings: Knex.RawBinding[] | Knex.ValueDict = [],
  ): Promise<Record<string, unknown>[]> {
    const db = this.getConnection(config);
    const result = await db.raw(sql, bindings);

    if (config.client === 'pg') {
      return result.rows as Record<string, unknown>[];
    }
    return (Array.isArray(result[0]) ? result[0] : result) as Record<
      string,
      unknown
    >[];
  }
  private async destroyPool(id: string) {
    const existing = this.pools.get(id);
    if (existing) {
      await existing.destroy();
      this.pools.delete(id);
    }
  }

  async previewQuery(id: string, dto: QueryPreviewDto) {
    // Guardrail: only allow read-only SELECT or CTE (WITH) queries
    const trimmedSql = dto.sql.trim();
    if (!/^(select|with)\b/i.test(trimmedSql)) {
      throw new BadRequestException(
        'Only read-only SELECT or WITH queries are allowed in preview',
      );
    }

    const config = await this.findOneWithCredentials(id);
    const limit = dto.limit ?? 50;
    const startTime = Date.now();

    try {
      const rows = await this.executeQuery(
        config,
        trimmedSql,
        (dto.params ?? {}) as Knex.ValueDict,
      );

      const limitedRows = rows.slice(0, limit);
      const columns =
        limitedRows.length > 0 ? Object.keys(limitedRows[0]) : [];

      return {
        columns,
        rows: limitedRows,
        totalReturned: rows.length,
        truncated: rows.length > limit,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query failed';
      throw new BadRequestException(`SQL Error: ${message}`);
    }
  }

  async onModuleDestroy() {
    for (const pool of this.pools.values()) {
      await pool.destroy();
    }
  }
}
