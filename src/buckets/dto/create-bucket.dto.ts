import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateBucketDto {
  @ApiProperty({ example: 'Shipping & Logistics' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'logistics',
    description: 'Unique URL-friendly identifier for this bucket',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @ApiPropertyOptional({
    example: 'Bills of Lading, Manifests, and Shipping Invoices',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
