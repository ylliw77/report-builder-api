import { Module } from '@nestjs/common';
import { DatasourceModule } from '../datasource/datasource.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [DatasourceModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
