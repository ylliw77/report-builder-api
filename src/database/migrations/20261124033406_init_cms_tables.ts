import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('data_sources', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable();
    table.string('client').notNullable();
    table.string('host').notNullable();
    table.integer('port').notNullable();
    table.string('username').notNullable();
    table.text('password').notNullable();
    table.string('database').notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('report_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('slug').unique().notNullable();
    table.string('name').notNullable();
    table.text('html_template').notNullable();
    table.text('sql_query').nullable();
    table
      .uuid('data_source_id')
      .nullable()
      .references('id')
      .inTable('data_sources')
      .onDelete('SET NULL');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('report_templates');
  await knex.schema.dropTableIfExists('data_sources');
}
