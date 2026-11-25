import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('email').unique().notNullable();
    table.string('name').notNullable();
    table.string('password_hash').notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('api_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable();
    table.string('key_prefix').notNullable();
    table.string('key_hash').unique().notNullable();
    table
      .uuid('created_by')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.timestamp('last_used_at').nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('api_keys');
  await knex.schema.dropTableIfExists('users');
}
