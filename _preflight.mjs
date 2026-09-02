// Pull every branded item off the practice's own store cheat sheets, then cross-check.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { resolveDay } from './lib/validate.mjs';
import { preflight } from './lib/preflight.mjs';

const cfg   = JSON.parse(fs.readFileSync('data/protocol.config.json','utf8'));
const meals = JSON.parse(fs.readFileSync('data/meals.json','utf8')).meals;
const plan  = JSON.parse(fs.readFileSync('data/plan.json','utf8')).days;
const recipes   = JSON.parse(fs.readFileSync('data/recipes.json','utf8'));
const canonical = JSON.parse(fs.readFileSync('data/canonical.json','utf8'));
const storeItems = fs.existsSync('data/store-items.json')
  ? JSON.parse(fs.readFileSync('data/store-items.json','utf8')).items : [];

const by = Object.fromEntries(meals.map(m => [m.id, m]));
const days = plan.map(d => ({ ...d, ...resolveDay(d, by, cfg) }));

const { findings, counts } = preflight({ days, meals, recipes, canonical, cfg, storeItems });

const LABEL = { stop: 'STOP ', waste: 'WASTE', check: 'CHECK' };
console.log(`\n  PREFLIGHT — ${findings.length} finding(s)`);
console.log(`  ${counts.stop} stop · ${counts.waste} unnecessary spend · ${counts.check} needs checking\n`);
let last = '';
for (const f of findings) {
  if (f.check !== last) { console.log(`  ${f.check.toUpperCase()}`); last = f.check; }
  console.log(`    [${LABEL[f.severity]}] ${f.detail}`);
  console.log(`             fix: ${f.fix}`);
}
console.log('');
process.exit(counts.stop ? 1 : 0);
