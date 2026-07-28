import { openApp, mkSave } from './_critic2-lib.mjs';
const { browser, page } = await openApp({ width: 1024, height: 768 }, mkSave());
const r = await page.evaluate(async () => {
  const cat = await import('/data/catalogue.js');
  const ae = await import('/js/attrengine.js');
  const ids = ['boo_inky','boo_plum','boo_pippin','boo_lolly','boo_chomp','boo_mallow','boo_curly','boo_wisp'];
  const feats = ids.map(id => ({ id, f: ae.featuresOf(cat.BY_ID[id]) }));
  const all = Object.values(cat.BY_ID).filter(i => i.id.startsWith('boo_'));
  const accNone = all.filter(b => ae.featuresOf(b).accessory === 'none').length;
  const notShiny = all.filter(b => !ae.featuresOf(b).shiny).length;
  return { feats, totalBoos: all.length, accNone, notShiny };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
