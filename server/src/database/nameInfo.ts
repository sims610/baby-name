// Origin and meaning for each first name in fakeData.ts. FamilySearch only gives us
// names, so this lookup fills in the story behind them until we have a real source.

export interface NameInfo {
  origin: string;
  meaning: string;
}

export const nameInfo: Record<string, NameInfo> = {
  Adeline: { origin: 'Germanic', meaning: 'Noble' },
  Anders: { origin: 'Scandinavian', meaning: 'Strong and manly' },
  Arthur: { origin: 'Celtic', meaning: 'Bear' },
  Astrid: { origin: 'Old Norse', meaning: 'Divinely beautiful' },
  Beatrice: { origin: 'Latin', meaning: 'She who brings happiness' },
  Calvin: { origin: 'French', meaning: 'Bald' },
  Clara: { origin: 'Latin', meaning: 'Bright and clear' },
  Eleanor: { origin: 'French', meaning: 'Shining light' },
  Ezra: { origin: 'Hebrew', meaning: 'Help' },
  Florence: { origin: 'Latin', meaning: 'Flourishing' },
  Gideon: { origin: 'Hebrew', meaning: 'Feller of trees' },
  Hazel: { origin: 'English', meaning: 'Hazel tree' },
  Henry: { origin: 'Germanic', meaning: 'Ruler of the home' },
  Ingrid: { origin: 'Old Norse', meaning: 'Beautiful' },
  Jasper: { origin: 'Persian', meaning: 'Bringer of treasure' },
  Josiah: { origin: 'Hebrew', meaning: 'God supports' },
  Lars: { origin: 'Scandinavian', meaning: 'Crowned with laurel' },
  Lydia: { origin: 'Greek', meaning: 'Woman from Lydia' },
  Mabel: { origin: 'Latin', meaning: 'Lovable' },
  Magnus: { origin: 'Latin', meaning: 'Great' },
  Margaret: { origin: 'Greek', meaning: 'Pearl' },
  Oliver: { origin: 'Latin', meaning: 'Olive tree' },
  Opal: { origin: 'Sanskrit', meaning: 'Precious stone' },
  Rose: { origin: 'Latin', meaning: 'Rose flower' },
  Samuel: { origin: 'Hebrew', meaning: 'God has heard' },
  Sigrid: { origin: 'Old Norse', meaning: 'Beautiful victory' },
  Silas: { origin: 'Latin', meaning: 'Of the forest' },
  Thomas: { origin: 'Aramaic', meaning: 'Twin' },
  Violet: { origin: 'Latin', meaning: 'Violet flower' },
  Walter: { origin: 'Germanic', meaning: 'Ruler of the army' },
};
