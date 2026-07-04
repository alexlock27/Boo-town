// tests/shoot.mjs — self-QA screenshotter.
// Usage: node tests/shoot.mjs <path> <outPrefix> [--wait ms] [--full] [--portrait-only|--landscape-only]
// Screenshots the given app path at tablet landscape and portrait into screenshots/.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const args = process.argv.slice(2);
let path = args[0] || '/';
if (!/^https?:/.test(path) && !path.startsWith('/')) path = '/' + path;
const prefix = args[1] || 'shot';
const waitMs = args.includes('--wait') ? Number(args[args.indexOf('--wait') + 1]) : 700;
const full = args.includes('--full');
const base = process.env.BASE || 'http://127.0.0.1:8000';

// A typical 10-inch tablet is ~1024x600 CSS landscape; use clean tablet sizes.
const SIZES = {
  landscape: { width: 1024, height: 768 },
  portrait:  { width: 768,  height: 1024 }
};
const only = args.includes('--portrait-only') ? ['portrait']
           : args.includes('--landscape-only') ? ['landscape']
           : ['landscape', 'portrait'];

mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch();
const consoleErrors = [];
for (const mode of only) {
  const ctx = await browser.newContext({ viewport: SIZES[mode], deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[${mode}] ${m.text()}`); });
  page.on('pageerror', e => consoleErrors.push(`[${mode}] PAGEERROR ${e.message}`));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(waitMs);
  const out = `screenshots/${prefix}-${mode}.png`;
  await page.screenshot({ path: out, fullPage: full });
  console.log('WROTE', out);
  await ctx.close();
}
await browser.close();
if (consoleErrors.length) {
  console.log('CONSOLE_ERRORS:\n' + consoleErrors.join('\n'));
  process.exitCode = 2;
} else {
  console.log('NO_CONSOLE_ERRORS');
}
