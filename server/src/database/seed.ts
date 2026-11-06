import type { FavoriteName } from 'shared';
import {
  addFavorite,
  addUser,
  getInviteCode,
  getPartner,
  getUserByEmail,
  linkPartner,
  setShortlist,
} from './database.ts';

// Ready-made accounts for trying the app locally, saved in MySQL. Seeding runs on
// every start and puts back anything missing (favorites, top picks, the partner link).
// Not used by the tests.
export const DEMO_ACCOUNT = { name: 'Test User', email: 'test@gmail.com', password: 'test1234' };
export const DEMO_PARTNER_ACCOUNT = { name: 'Daniel', email: 'test2@gmail.com', password: 'test1234' };

const DEMO_FAVORITES: FavoriteName[] = [
  { name: 'Mabel', gender: 'girl' },
  { name: 'Ezra', gender: 'boy' },
  { name: 'Clara', gender: 'girl' },
  { name: 'Jasper', gender: 'boy' },
  { name: 'Eleanor', gender: 'girl' },
  { name: 'Oliver', gender: 'boy' },
  { name: 'Hazel', gender: 'girl' },
];

// Overlaps with DEMO_FAVORITES on Hazel, Jasper, Clara and Ezra.
const PARTNER_FAVORITES: FavoriteName[] = [
  { name: 'Margaret', gender: 'girl' },
  { name: 'Samuel', gender: 'boy' },
  { name: 'Ezra', gender: 'boy' },
  { name: 'Rose', gender: 'girl' },
  { name: 'Silas', gender: 'boy' },
  { name: 'Clara', gender: 'girl' },
  { name: 'Arthur', gender: 'boy' },
  { name: 'Jasper', gender: 'boy' },
  { name: 'Hazel', gender: 'girl' },
];

async function seedAccount(
  account: { name: string; email: string; password: string },
  favorites: FavoriteName[],
  shortlist: string[],
) {
  // After the first start the account already exists, and favorites already saved are skipped.
  const user = (await addUser(account.name, account.email, account.password)) ?? (await getUserByEmail(account.email));
  if (!user) {
    return null;
  }
  for (const favorite of favorites) {
    await addFavorite(user.id, favorite);
  }
  await setShortlist(user.id, shortlist);
  return user;
}

/** Adds the two demo accounts, with favorites and a top 3, already linked as partners. */
export async function seedDemoAccounts(): Promise<void> {
  const you = await seedAccount(DEMO_ACCOUNT, DEMO_FAVORITES, ['Hazel', 'Jasper']);
  const partner = await seedAccount(DEMO_PARTNER_ACCOUNT, PARTNER_FAVORITES, ['Hazel', 'Arthur', 'Clara']);
  if (you && partner && !(await getPartner(you.id))) {
    await linkPartner(you.id, await getInviteCode(partner.id));
  }
}
