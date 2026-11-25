import type { Knex } from 'knex';
import 'dotenv/config';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: process.env.CMS_DATABASE_URL,
    migrations: {
      directory: './src/database/migrations',
      extension: 'ts',
    },
  },
};

export default config;
