import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class GeneratePdfDto {
  @ApiPropertyOptional({
    example: {
      invoiceNo: 'INV-2026-001',
      customer: 'Acme Corp',
      items: [{ name: 'Report License', price: 250 }],
    },
    description: 'Option A: Push JSON data directly from your external app',
  })
  @IsOptional()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: { status: 'PAID' },
    description: 'Option B: Named SQL parameters if the template uses sql_query',
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
