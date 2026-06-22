import 'dotenv/config';
import pg from 'pg';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run admin:promote -- user@example.com');
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://squash:squash@127.0.0.1:5432/squash';
const pool = new pg.Pool({ connectionString });

try {
  const result = await pool.query(
    `update users
       set role = 'platform-admin', updated_at = now()
     where lower(email) = $1
     returning id, email, role`,
    [email],
  );
  if (result.rowCount !== 1) {
    console.error(`No registered user found for ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`Promoted ${result.rows[0].email} to platform-admin.`);
  }
} finally {
  await pool.end();
}
