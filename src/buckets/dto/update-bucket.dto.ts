import { PartialType } from '@nestjs/swagger';
import { CreateBucketDto } from './create-bucket.dto.js';

export class UpdateBucketDto extends PartialType(CreateBucketDto) {}
