import { createDatabase } from '@squash/db';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://squash:squash@127.0.0.1:5432/squash';

const database = createDatabase(connectionString);
export const db = database.db;
export const dbPool = database.pool;
