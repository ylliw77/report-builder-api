import { Global, Module } from '@nestjs/common';
import { DatasourceController } from './datasource.controller.js';
import { DatasourceService } from './datasource.service.js';

@Global()
@Module({
  controllers: [DatasourceController],
  providers: [DatasourceService],
  exports: [DatasourceService]
})
export class DatasourceModule { }
