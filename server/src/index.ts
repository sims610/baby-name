import app from './service.ts';
import { DEMO_ACCOUNT, DEMO_PARTNER_ACCOUNT, seedDemoAccounts } from './database/seed.ts';

const port = process.argv[2] || 3000;

await seedDemoAccounts();
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  console.log(`Demo accounts: ${DEMO_ACCOUNT.email} and ${DEMO_PARTNER_ACCOUNT.email} (password ${DEMO_ACCOUNT.password})`);
});
