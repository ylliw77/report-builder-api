import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateBucketDto } from './dto/create-bucket.dto.js';
import { UpdateBucketDto } from './dto/update-bucket.dto.js';

@Injectable()
export class BucketsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateBucketDto) {
    const existing = await this.databaseService
      .db('buckets')
      .where({ slug: dto.slug })
      .first();

    if (existing) {
      throw new ConflictException(`Bucket slug "${dto.slug}" already exists`);
    }

    const [created] = await this.databaseService
      .db('buckets')
      .insert({
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
      })
      .returning('*');

    return created;
  }

  async findAll() {
    return this.databaseService
      .db('buckets')
      .leftJoin('report_templates', 'buckets.id', 'report_templates.bucket_id')
      .select('buckets.*')
      .count('report_templates.id as report_count')
      .groupBy('buckets.id')
      .orderBy('buckets.created_at', 'desc');
  }

  async findOne(id: string) {
    const bucket = await this.databaseService
      .db('buckets')
      .where({ id })
      .first();

    if (!bucket) {
      throw new NotFoundException(`Bucket ${id} not found`);
    }

    const reports = await this.databaseService
      .db('report_templates')
      .where({ bucket_id: id })
      .orderBy('updated_at', 'desc');

    return { ...bucket, reports };
  }

  async update(id: string, dto: UpdateBucketDto) {
    await this.findOne(id);

    const [updated] = await this.databaseService
      .db('buckets')
      .where({ id })
      .update({
        ...dto,
        updated_at: this.databaseService.db.fn.now(),
      })
      .returning('*');

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.databaseService.db('buckets').where({ id }).del();
    return { deleted: true, id };
  }
}
