import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryPreviewDto {
  @ApiProperty({
    example: 'SELECT id, name, client FROM data_sources WHERE client = :client',
  })
  @IsString()
  @IsNotEmpty()
  sql: string;

  @ApiPropertyOptional({
    example: { client: 'pg' },
    description: 'Named parameters for the SQL query',
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
