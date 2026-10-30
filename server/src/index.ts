import app from './service.ts';
import { DEMO_ACCOUNT, DEMO_PARTNER_ACCOUNT, seedDemoAccounts } from './database/seed.ts';

const port = process.argv[2] || 3000;

await seedDemoAccounts();
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  console.log(`Demo accounts: ${DEMO_ACCOUNT.email} and ${DEMO_PARTNER_ACCOUNT.email} (password ${DEMO_ACCOUNT.password})`);
  console.log(
    process.env.RESEND_API_KEY
      ? `Email: sending through Resend as ${process.env.EMAIL_FROM ?? 'the default sender'}`
      : 'Email: RESEND_API_KEY is not set, so emails are printed here instead of sent (see server/.env.example)',
  );
});
