import fs from 'node:fs';
import { resolveDay } from './lib/validate.mjs';

const cfg   = JSON.parse(fs.readFileSync('data/protocol.config.json','utf8'));
const meals = JSON.parse(fs.readFileSync('data/meals.json','utf8')).meals;
const plan  = JSON.parse(fs.readFileSync('data/plan.json','utf8')).days;
const { canon, price } = JSON.parse(fs.readFileSync('data/canonical.json','utf8'));
const by = Object.fromEntries(meals.map(m => [m.id, m]));
const days = plan.map(d => ({ ...d, ...resolveDay(d, by, cfg) }));

const DEPT = { 'Meat & seafood':['chicken','turkey','beef','pork','sausage','deli meat','salmon','white fish','shrimp'],
  'Dairy & eggs':['eggs','greek yogurt','cottage cheese','cheese','butter'],
  'Produce':['salad greens','berries','apples','avocado','citrus','celery','cucumber','tomatoes','peppers','onions','carrots','broccoli','cauliflower','zucchini','green veg','sweet potato'],
  'Pantry':['canned tuna','rice or quinoa','beans','bread or wraps','nuts and seeds','peanut butter','condiments'] };

const cart = new Map();
for (const d of days) for (const m of d.detail ?? []) for (const line of m.items ?? []) {
  const l = line.toLowerCase();
  for (const [item, words] of Object.entries(canon)) {
    if (words.some(w => l.includes(w))) {
      const c = cart.get(item) ?? new Set(); c.add(d.day); cart.set(item, c);
    }
  }
}

console.log(`\n  SHOPPING LIST — ${days.length} days, one trip\n`);
let total = 0;
for (const [dept, items] of Object.entries(DEPT)) {
  const rows = items.filter(i => cart.has(i));
  if (!rows.length) continue;
  console.log(`  ${dept}`);
  for (const i of rows) {
    const p = price[i] ?? 0; total += p;
    console.log(`    ${i.padEnd(18)} $${p.toFixed(2).padStart(6)}   days ${[...cart.get(i)].sort((a,b)=>a-b).join(',')}`);
  }
  console.log('');
}
const lo = Math.round(total * 0.85), hi = Math.round(total * 1.15);
console.log(`  ${cart.size} items      ESTIMATE  $${lo}\u2013$${hi} for the week`);
console.log(`  Prices vary by store and week. Estimate only.\n`);
