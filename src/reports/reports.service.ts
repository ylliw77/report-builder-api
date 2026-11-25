import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import Handlebars from 'handlebars';
import type { Knex } from 'knex';
import puppeteer, { type Browser } from 'puppeteer';
import { DatabaseService } from '../database/database.service.js';
import { DatasourceService } from '../datasource/datasource.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { GeneratePdfDto } from './dto/generate-pdf.dto.js';
import { UpdateReportDto } from './dto/update-report.dto.js';
import { registerHandlebarsHelpers } from './handlebars-helpers.js';

interface ReportQueryRow {
  id: string;
  report_id: string;
  data_source_id: string;
  key: string;
  sql: string;
  result_mode: 'single' | 'list';
}

@Injectable()
export class ReportsService implements OnModuleDestroy {
  private browser: Browser | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly datasourceService: DatasourceService,
  ) {
    registerHandlebarsHelpers();
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async create(dto: CreateReportDto) {
    const existing = await this.databaseService
      .db('report_templates')
      .where({ slug: dto.slug })
      .first();

    if (existing) {
      throw new ConflictException(`Report slug "${dto.slug}" already exists`);
    }

    return this.databaseService.db.transaction(async (trx) => {
      const [created] = await trx('report_templates')
        .insert({
          slug: dto.slug,
          name: dto.name,
          html_template: dto.html_template,
          bucket_id: dto.bucket_id ?? null,
          sql_query: dto.sql_query ?? null,
          data_source_id: dto.data_source_id ?? null,
        })
        .returning('*');

      let savedQueries: ReportQueryRow[] = [];
      if (dto.queries && dto.queries.length > 0) {
        savedQueries = await trx('report_queries')
          .insert(
            dto.queries.map((q) => ({
              report_id: created.id,
              data_source_id: q.data_source_id,
              key: q.key,
              sql: q.sql,
              result_mode: q.result_mode ?? 'list',
            })),
          )
          .returning('*');
      }

      return { ...created, queries: savedQueries };
    });
  }

  async findAll(bucketId?: string) {
    const query = this.databaseService
      .db('report_templates')
      .select('*')
      .orderBy('updated_at', 'desc');

    if (bucketId) {
      query.where({ bucket_id: bucketId });
    }

    return query;
  }

  async findOne(id: string) {
    const report = await this.databaseService
      .db('report_templates')
      .where({ id })
      .first();

    if (!report) {
      throw new NotFoundException(`Report template ${id} not found`);
    }

    const queries = await this.databaseService
      .db('report_queries')
      .where({ report_id: id })
      .orderBy('created_at', 'asc');

    return { ...report, queries };
  }

  async update(id: string, dto: UpdateReportDto) {
    await this.findOne(id);

    return this.databaseService.db.transaction(async (trx) => {
      const { queries, ...templateFields } = dto;

      const [updated] = await trx('report_templates')
        .where({ id })
        .update({
          ...templateFields,
          updated_at: trx.fn.now(),
        })
        .returning('*');

      let savedQueries: ReportQueryRow[];
      if (queries !== undefined) {
        await trx('report_queries').where({ report_id: id }).del();
        if (queries.length > 0) {
          savedQueries = await trx('report_queries')
            .insert(
              queries.map((q) => ({
                report_id: id,
                data_source_id: q.data_source_id,
                key: q.key,
                sql: q.sql,
                result_mode: q.result_mode ?? 'list',
              })),
            )
            .returning('*');
        } else {
          savedQueries = [];
        }
      } else {
        savedQueries = await trx('report_queries')
          .where({ report_id: id })
          .orderBy('created_at', 'asc');
      }

      return { ...updated, queries: savedQueries };
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.databaseService.db('report_templates').where({ id }).del();
    return { deleted: true, id };
  }

  async renderPdf(slug: string, body: GeneratePdfDto): Promise<Buffer> {
    const template = await this.databaseService
      .db('report_templates')
      .where({ slug })
      .first();

    if (!template) {
      throw new NotFoundException(`Report template "${slug}" not found`);
    }

    // 1. Resolve Data (Push Mode vs. Pull Mode via report_queries / legacy sql_query)
    let contextData: Record<string, unknown> = body.data ?? {};

    if (!body.data) {
      const reportQueries: ReportQueryRow[] = await this.databaseService
        .db('report_queries')
        .where({ report_id: template.id });

      const params = (body.params ?? {}) as Knex.ValueDict;
      const resolvedData: Record<string, unknown> = {
        params,
        generatedAt: new Date().toISOString(),
      };

      if (reportQueries.length > 0) {
        const results = await Promise.all(
          reportQueries.map(async (q) => {
            const dsConfig = await this.datasourceService.findOneWithCredentials(
              q.data_source_id,
            );
            const rows = await this.datasourceService.executeQuery(
              dsConfig,
              q.sql,
              params,
            );
            return {
              key: q.key,
              value: q.result_mode === 'single' ? (rows[0] ?? {}) : rows,
            };
          }),
        );

        for (const item of results) {
          resolvedData[item.key] = item.value;
        }
      }

      if (template.sql_query) {
        if (!template.data_source_id) {
          throw new BadRequestException(
            'Template has sql_query configured but no data_source_id',
          );
        }
        const dsConfig = await this.datasourceService.findOneWithCredentials(
          template.data_source_id,
        );
        const mainRows = await this.datasourceService.executeQuery(
          dsConfig,
          template.sql_query,
          params,
        );
        resolvedData.rows = mainRows;
        resolvedData.first = mainRows[0] ?? {};
      }

      contextData = resolvedData;
    }

    // 2. Compile HTML with Handlebars
    const compiled = Handlebars.compile(template.html_template);
    let html = compiled(contextData);

    // Extract optional repeating PDF header & footer templates with custom heights
    const headerMatch = html.match(
      /<template id="pdf-header"(?:\s+data-height="([^"]+)")?>([\s\S]*?)<\/template>/i,
    );
    const footerMatch = html.match(
      /<template id="pdf-footer"(?:\s+data-height="([^"]+)")?>([\s\S]*?)<\/template>/i,
    );

    const headerHeight = headerMatch?.[1] || (headerMatch ? '22mm' : '12mm');
    const footerHeight = footerMatch?.[1] || (footerMatch ? '20mm' : '15mm');

    const headerTemplate = headerMatch ? headerMatch[2] : '<div></div>';
    const footerTemplate = footerMatch ? footerMatch[2] : '<div></div>';

    html = html
      .replace(/<template id="pdf-header"[^>]*>[\s\S]*?<\/template>/gi, '')
      .replace(/<template id="pdf-footer"[^>]*>[\s\S]*?<\/template>/gi, '');

    // 3. Render PDF via Puppeteer
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBytes = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: Boolean(headerMatch || footerMatch),
        headerTemplate,
        footerTemplate,
        margin: {
          top: headerHeight,
          right: '10mm',
          bottom: footerHeight,
          left: '10mm',
        },
      });
      return Buffer.from(pdfBytes);
    } finally {
      await page.close();
    }
  }
}
