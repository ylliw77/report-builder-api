import { PartialType } from '@nestjs/swagger';
import { CreateDatasourceDto } from './create-datasource.dto.js';

export class UpdateDatasourceDto extends PartialType(CreateDatasourceDto) {}
