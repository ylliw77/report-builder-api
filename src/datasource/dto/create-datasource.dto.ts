import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export const SUPPORTED_CLIENTS = [
  'pg',
  'mysql2',
  'mssql',
  'better-sqlite3',
] as const;

export type SupportedClient = (typeof SUPPORTED_CLIENTS)[number];

export class CreateDatasourceDto {
  @ApiProperty({ example: 'ERP Production DB' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: SUPPORTED_CLIENTS, example: 'pg' })
  @IsIn(SUPPORTED_CLIENTS)
  client: SupportedClient;

  @ApiProperty({ example: 'localhost' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({ example: 5432, minimum: 1, maximum: 65535 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ example: 'postgres' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'secret-password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'report_cms' })
  @IsString()
  @IsNotEmpty()
  database: string;
}
