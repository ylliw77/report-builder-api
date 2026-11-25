import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DatasourceService } from './datasource.service.js';
import { CreateDatasourceDto } from './dto/create-datasource.dto.js';
import { QueryPreviewDto } from './dto/query-preview.dto.js';
import { UpdateDatasourceDto } from './dto/update-datasource.dto.js';

@ApiTags('DataSources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('datasource')
export class DatasourceController {
  constructor(private readonly datasourceService: DatasourceService) {}

  @Post('test')
  @ApiOperation({ summary: 'Test a database connection before saving' })
  testConnection(@Body() dto: CreateDatasourceDto) {
    return this.datasourceService.testConnection(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new database connection (password encrypted)' })
  create(@Body() dto: CreateDatasourceDto) {
    return this.datasourceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all saved database connections' })
  findAll() {
    return this.datasourceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single database connection by ID' })
  findOne(@Param('id') id: string) {
    return this.datasourceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a database connection' })
  update(@Param('id') id: string, @Body() dto: UpdateDatasourceDto) {
    return this.datasourceService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a database connection' })
  remove(@Param('id') id: string) {
    return this.datasourceService.remove(id);
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Run a read-only SELECT query and preview columns/rows' })
  previewQuery(@Param('id') id: string, @Body() dto: QueryPreviewDto) {
    return this.datasourceService.previewQuery(id, dto);
  }
}
