import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('report_templates', (table) => {
    table.jsonb('sub_queries').nullable().defaultTo('[]');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('report_templates', (table) => {
    table.dropColumn('sub_queries');
  });
}
