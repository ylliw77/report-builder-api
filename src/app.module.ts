import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { DatasourceModule } from './datasource/datasource.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BucketsModule } from './buckets/buckets.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    DatasourceModule,
    ReportsModule,
    AuthModule,
    BucketsModule,
  ],
})
export class AppModule {}
