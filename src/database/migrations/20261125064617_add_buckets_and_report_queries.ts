import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Buckets (Apps / Folders)
  await knex.schema.createTable('buckets', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable(); // e.g. "Shipping & Logistics"
    table.string('slug').unique().notNullable(); // e.g. "logistics"
    table.text('description').nullable();
    table.timestamps(true, true);
  });

  // 2. Link report_templates & api_keys to a bucket
  await knex.schema.alterTable('report_templates', (table) => {
    table
      .uuid('bucket_id')
      .nullable()
      .references('id')
      .inTable('buckets')
      .onDelete('SET NULL');
  });

  await knex.schema.alterTable('api_keys', (table) => {
    table
      .uuid('bucket_id')
      .nullable()
      .references('id')
      .inTable('buckets')
      .onDelete('CASCADE');
  });

  // 3. Dedicated Queries table per report
  await knex.schema.createTable('report_queries', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table
      .uuid('report_id')
      .notNullable()
      .references('id')
      .inTable('report_templates')
      .onDelete('CASCADE');
    table
      .uuid('data_source_id')
      .notNullable()
      .references('id')
      .inTable('data_sources')
      .onDelete('RESTRICT');
    table.string('key').notNullable();
    table.text('sql').notNullable();
    table.string('result_mode').notNullable().defaultTo('list'); // 'single' | 'list'
    table.timestamps(true, true);

    table.unique(['report_id', 'key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('report_queries');
  await knex.schema.alterTable('api_keys', (table) => {
    table.dropColumn('bucket_id');
  });
  await knex.schema.alterTable('report_templates', (table) => {
    table.dropColumn('bucket_id');
  });
  await knex.schema.dropTableIfExists('buckets');
}
