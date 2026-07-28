import { openApp, mkSave } from './_critic2-lib.mjs';
const { browser, page } = await openApp({ width: 1024, height: 768 }, mkSave());
console.log(JSON.stringify(await page.evaluate(async () => {
  const cat = await import('/data/catalogue.js');
  const ae = await import('/js/attrengine.js');
  const all = Object.values(cat.BY_ID).filter(i => i.id.startsWith('boo_'));
  const acc = {};
  all.forEach(b => { const a = String(ae.featuresOf(b).accessory); acc[a] = (acc[a] || 0) + 1; });
  const plain = all.filter(b => !ae.featuresOf(b).accessory && !ae.featuresOf(b).shiny);
  return { total: all.length, accessoryValues: acc, plainCount: plain.length, plainNames: plain.slice(0,12).map(b=>b.name) };
}), null, 1));
await browser.close();
