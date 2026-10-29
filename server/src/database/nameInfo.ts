// Origin and meaning for each first name in fakeData.ts. WikiTree only gives us
// names, so this lookup fills in the story behind them until we have a real source.
// Keep meanings to a sentence or two: they're shown on the Discover card.

export interface NameInfo {
  origin: string;
  meaning: string;
}

export const nameInfo: Record<string, NameInfo> = {
  Adeline: { origin: 'Germanic', meaning: 'From adal: "noble." A medieval name revived in the 1800s.' },
  Anders: { origin: 'Scandinavian', meaning: 'The Nordic form of Andrew, from the Greek andreios: "strong, manly."' },
  Arthur: { origin: 'Celtic', meaning: 'Likely from artos: "bear." The legendary king of Camelot.' },
  Astrid: { origin: 'Old Norse', meaning: 'From áss (god) + fríðr (beautiful): "divinely beautiful." Worn by Scandinavian queens.' },
  Beatrice: { origin: 'Latin', meaning: 'From Beatrix: "she who brings happiness." The guide of Dante\'s Divine Comedy.' },
  Calvin: { origin: 'French', meaning: 'From the Latin calvus: "bald." Made known by the reformer John Calvin.' },
  Clara: { origin: 'Latin', meaning: 'From clarus: "bright, clear, famous." Borne by Saint Clare of Assisi.' },
  Eleanor: { origin: 'Old French', meaning: 'From Aliénor, carried into England by Eleanor of Aquitaine. Often read as "shining light."' },
  Ezra: { origin: 'Hebrew', meaning: '"Help." The biblical scribe who led his people home from exile in Babylon.' },
  Florence: { origin: 'Latin', meaning: 'From florens: "flourishing, in bloom." Made beloved by nurse Florence Nightingale.' },
  Gideon: { origin: 'Hebrew', meaning: '"Feller of trees" or "mighty warrior." A judge and hero of ancient Israel.' },
  Hazel: { origin: 'English', meaning: 'From the Old English hæsel, the hazel tree. In folklore it stood for wisdom and protection.' },
  Henry: { origin: 'Germanic', meaning: 'From Heimirich: "ruler of the home." The name of eight English kings.' },
  Ingrid: { origin: 'Old Norse', meaning: 'From Ing, a Norse god of fertility, + fríðr: "Ing is beautiful."' },
  Jasper: { origin: 'Persian', meaning: '"Bringer of treasure." Traditionally one of the Three Wise Men, and a deep red gemstone.' },
  Josiah: { origin: 'Hebrew', meaning: '"God supports" or "God heals." A young king of Judah known for his reforms.' },
  Lars: { origin: 'Scandinavian', meaning: 'The Nordic form of Laurence: "from Laurentum," a town named for its laurel trees.' },
  Lydia: { origin: 'Greek', meaning: '"Woman from Lydia," a kingdom in Asia Minor. A merchant of purple cloth in the New Testament.' },
  Mabel: { origin: 'Latin', meaning: 'From amabilis: "lovable." Common in medieval England and revived by the Victorians.' },
  Magnus: { origin: 'Latin', meaning: '"Great." Taken from Charlemagne\'s title, Carolus Magnus, by Norse kings.' },
  Margaret: { origin: 'Greek', meaning: 'From margarites: "pearl." Loved for centuries through Saint Margaret of Scotland.' },
  Oliver: { origin: 'Latin', meaning: 'Linked to the olive tree, a symbol of peace. A knight in the legends of Charlemagne.' },
  Opal: { origin: 'Sanskrit', meaning: 'From upala: "precious stone." The opal\'s shifting colors made it a 1900s favorite.' },
  Rose: { origin: 'Latin', meaning: 'From rosa, the rose flower. A classic symbol of love since ancient times.' },
  Samuel: { origin: 'Hebrew', meaning: '"God has heard." The prophet who anointed Israel\'s first kings.' },
  Sigrid: { origin: 'Old Norse', meaning: 'From sigr (victory) + fríðr (beautiful): "beautiful victory."' },
  Silas: { origin: 'Latin', meaning: 'Short for Silvanus: "of the forest." A companion of Paul in the New Testament.' },
  Thomas: { origin: 'Aramaic', meaning: '"Twin." One of the twelve apostles, remembered as Doubting Thomas.' },
  Violet: { origin: 'Latin', meaning: 'From viola, the violet flower. A Victorian favorite that stood for faithfulness.' },
  Walter: { origin: 'Germanic', meaning: 'From Waldhar: "ruler of the army." Brought to England by the Normans.' },
};
