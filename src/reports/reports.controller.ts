import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { GeneratePdfDto } from './dto/generate-pdf.dto.js';
import { UpdateReportDto } from './dto/update-report.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new report template with queries' })
  create(@Body() dto: CreateReportDto) {
    return this.reportsService.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiQuery({
    name: 'bucket_id',
    required: false,
    description: 'Filter report templates by Bucket UUID',
  })
  @ApiOperation({ summary: 'List report templates (optionally filtered by bucket)' })
  findAll(@Query('bucket_id') bucketId?: string) {
    return this.reportsService.findAll(bucketId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single report template and its queries' })
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a report template and its queries' })
  update(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.reportsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a report template' })
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }

  @Post(':slug/preview-pdf')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Test-download a PDF from the CMS (uses Bearer JWT)',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 201,
    description: 'Returns the preview PDF file stream',
  })
  async previewPdf(
    @Param('slug') slug: string,
    @Body() body: GeneratePdfDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportsService.renderPdf(slug, body);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}-preview.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Post(':slug/pdf')
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: 'Generate and download a PDF (for external apps using x-api-key)',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 201,
    description: 'Returns the generated PDF file stream',
  })
  async generatePdf(
    @Param('slug') slug: string,
    @Body() body: GeneratePdfDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportsService.renderPdf(slug, body);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
