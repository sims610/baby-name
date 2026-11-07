import app from './service.ts';
import { DEMO_ACCOUNT, DEMO_PARTNER_ACCOUNT, seedDemoAccounts } from './database/seed.ts';
import { initDatabase } from './database/db.ts';
import { deleteExpiredRecords } from './database/database.ts';

const port = process.argv[2] || process.env.PORT || 3000;

try {
  await initDatabase();
} catch (error) {
  console.error('Could not connect to MySQL. Is it running? From the repo root: docker compose up -d');
  throw error;
}
await deleteExpiredRecords();
// The demo passwords are public, so these accounts must never exist in production.
const seedDemo = process.env.NODE_ENV !== 'production';
if (seedDemo) {
  await seedDemoAccounts();
}
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  if (seedDemo) {
    console.log(`Demo accounts: ${DEMO_ACCOUNT.email} and ${DEMO_PARTNER_ACCOUNT.email} (password ${DEMO_ACCOUNT.password})`);
  }
  console.log(
    process.env.RESEND_API_KEY
      ? `Email: sending through Resend as ${process.env.EMAIL_FROM ?? 'the default sender'}`
      : 'Email: RESEND_API_KEY is not set, so emails are printed here instead of sent (see server/.env.example)',
  );
});
