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
import { BucketsService } from './buckets.service.js';
import { CreateBucketDto } from './dto/create-bucket.dto.js';
import { UpdateBucketDto } from './dto/update-bucket.dto.js';

@ApiTags('Buckets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('buckets')
export class BucketsController {
  constructor(private readonly bucketsService: BucketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new report bucket (app/folder)' })
  create(@Body() dto: CreateBucketDto) {
    return this.bucketsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all buckets with report counts' })
  findAll() {
    return this.bucketsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bucket and its report templates' })
  findOne(@Param('id') id: string) {
    return this.bucketsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bucket' })
  update(@Param('id') id: string, @Body() dto: UpdateBucketDto) {
    return this.bucketsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bucket (reports are kept with bucket_id = null)' })
  remove(@Param('id') id: string) {
    return this.bucketsService.remove(id);
  }
}
