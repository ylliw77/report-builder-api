import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

export class ReportQueryDto {
  @ApiProperty({
    example: 'bl_header',
    description: 'Variable name injected into Handlebars (e.g. {{bl_header.shipper}})',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'key must be a valid variable name (letters, numbers, underscores)',
  })
  key: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the DataSource to execute this query against',
  })
  @IsUUID()
  data_source_id: string;

  @ApiProperty({
    example: 'SELECT * FROM bills_of_lading WHERE bl_no = :blNo',
  })
  @IsString()
  @IsNotEmpty()
  sql: string;

  @ApiPropertyOptional({
    enum: ['single', 'list'],
    default: 'list',
    description:
      '"single" returns the first row as an object ({{key.field}}); "list" returns an array ({{#each key}})',
  })
  @IsOptional()
  @IsIn(['single', 'list'])
  result_mode?: 'single' | 'list';
}

export class CreateReportDto {
  @ApiProperty({
    example: 'bill-of-lading',
    description: 'Unique URL slug used by external apps to download the PDF',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @ApiProperty({ example: 'Samudera Bill of Lading' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '<html><body><h1>B/L {{bl_header.bl_no}}</h1></body></html>',
  })
  @IsString()
  @IsNotEmpty()
  html_template: string;

  @ApiPropertyOptional({
    example: '11111111-2222-3333-4444-555555555555',
    description: 'Optional Bucket UUID this report belongs to',
  })
  @IsOptional()
  @IsUUID()
  bucket_id?: string;

  @ApiPropertyOptional({
    example: 'SELECT * FROM invoices WHERE id = :id',
    description: 'Legacy primary SQL query (optional if using queries array)',
  })
  @IsOptional()
  @IsString()
  sql_query?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Legacy DataSource UUID for sql_query',
  })
  @IsOptional()
  @IsUUID()
  data_source_id?: string;

  @ApiPropertyOptional({
    type: [ReportQueryDto],
    description:
      'List of named SQL queries (each can target its own DataSource and return a single object or list)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportQueryDto)
  queries?: ReportQueryDto[];
}
