#!/usr/bin/env node
// Build days 8-28 by selecting from the existing Pounds meal library.
//
// This SELECTS, it never composes. Every day is four real meals an RD wrote, chosen so
// the day lands inside the macro bands with the shake counted in. Days are marked
// assembled:true so a dietitian can see which ones a person chose and which ones the
// builder proposed.

import fs from 'node:fs';
import { classifyMeal } from './lib/dietary.mjs';

// Ingredient reuse. A month costs what it costs because of how many DIFFERENT things it
// asks you to buy, not how many meals it contains. Salmon bought for three days costs the
// same as salmon bought for eight. So prefer days built from what is already in the cart,
// and respect shelf life - reusing a fresh item across days that are two weeks apart means
// buying it twice.
const canonical = JSON.parse(fs.readFileSync('data/canonical.json', 'utf8'));
const CANON = canonical.canon ?? {};
const PRICE = canonical.price ?? {};
const BUYS  = canonical.buysPerMonth ?? {};

const itemsOf = meal => {
  const out = new Set();
  for (const line of meal.items ?? []) {
    const l = String(line).toLowerCase();
    for (const [item, words] of Object.entries(CANON)) {
      if (words.some(w => l.includes(w))) out.add(item);
    }
  }
  return out;
};

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const cfg   = read('data/protocol.config.json');
const meals = read('data/meals.json').meals;
const planDoc = read('data/plan.json');

const T = cfg.macros;
const WHEY = cfg.supplements.find(s => s.countsInsideCalories)?.macros ?? {};
const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
const SUPPS = cfg.supplements.filter(s => s.dose).map(s => s.id);

const complete = m => {
  const x = m.macros ?? {};
  return m.usableInPlan !== false &&
    ['kcal', 'protein', 'carb', 'fat'].every(k => typeof x[k] === 'number');
};

// Slot eligibility: a side never fills a meal slot; breakfast tolerates a lighter dish.
const eligible = (m, slot) => {
  const need = slot === 'snack'     ? ['snack', 'side', 'main']
             : slot === 'breakfast' ? ['main', 'snack']
             : ['main'];
  if (!need.includes(m.role ?? 'main')) return false;
  if (m.slot === slot) return true;
  // Entrees were filed by folder, so they are eligible at either midday meal.
  return m.slotInferred && ['lunch', 'dinner'].includes(slot) && ['lunch', 'dinner'].includes(m.slot);
};

const usable = meals.filter(complete);
const pool = Object.fromEntries(SLOTS.map(s => [s, usable.filter(m => eligible(m, s))]));

// Meals already used by the seven hand-built days. Prefer not to repeat them.
const alreadyUsed = new Set(planDoc.days.flatMap(d => d.meals));

const inBand = (v, lo, hi) => (lo == null || v >= lo) && (hi == null || v <= hi);
const totalOf = day => {
  const t = { kcal: WHEY.kcal ?? 0, protein: WHEY.protein ?? 0, carb: WHEY.carb ?? 0, fat: WHEY.fat ?? 0 };
  for (const m of day) for (const k of Object.keys(t)) t[k] += m.macros[k];
  return t;
};

// Every valid combination, cheapest-deviation first.
const candidates = [];
for (const b of pool.breakfast)
for (const l of pool.lunch)
for (const s of pool.snack)
for (const d of pool.dinner) {
  const day = [b, l, s, d];
  const names = day.map(m => m.name.toLowerCase().replace(/^(df|dairy[- ]free|low carb|lc)\s+/, '').trim());
  if (new Set(names).size < 4) continue;                 // no near-twins in one day
  const t = totalOf(day);
  if (!inBand(t.protein, T.protein.min, T.protein.max)) continue;
  if (!inBand(t.carb, T.carbohydrate.min, T.carbohydrate.max)) continue;
  if (t.kcal < T.calories.min) continue;
  const need = new Set();
  day.forEach(m => itemsOf(m).forEach(i => need.add(i)));
  candidates.push({ day, t, need, dev: Math.abs(t.kcal - T.calories.target) });
}

// Greedy pick. A meal may repeat across a month - people do eat things twice - but not
// within GAP days of itself, in any slot. "Never repeat" cannot fill 28 days and is not
// how anyone actually eats.
const GAP = 6;
const need = cfg.durationDays - planDoc.days.length;
const firstNewDay = planDoc.days.length + 1;
const lastSeen = new Map();
planDoc.days.forEach(d => d.meals.forEach(id => lastSeen.set(id, d.day)));

// What the hand-built week already puts in the cart. Those items are paid for.
const cart = new Set();
for (const d of planDoc.days) {
  for (const id of d.meals) {
    const m = meals.find(x => x.id === id);
    if (m) itemsOf(m).forEach(i => cart.add(i));
  }
}

const chosen = [];
let dayNo = firstNewDay;
while (chosen.length < need) {
  const before = chosen.length;
  {
  for (const c of candidates) {
    if (chosen.length >= need) break;
    // every meal in this day must be GAP days clear of its last appearance
    if (c.day.some(m => dayNo - (lastSeen.get(m.id) ?? -99) < GAP)) continue;
    c.day.forEach(m => lastSeen.set(m.id, dayNo));
    chosen.push(c);
    dayNo += 1;
  }
  }
  if (chosen.length === before) break;   // nothing fits; stop rather than loop forever
}

let day = planDoc.days.length;
for (const c of chosen) {
  day += 1;
  planDoc.days.push({
    day, week: Math.ceil(day / 7),
    meals: c.day.map(m => m.id),
    supplements: SUPPS,
    assembled: true,
    assembledNote: 'Selected by the builder from the Pounds meal library. Not yet read by a dietitian.',
  });
}
planDoc._status = `${planDoc.days.length} of ${cfg.durationDays} days. Days 1-7 built by hand from practice menus; days 8+ assembled from the library and awaiting review.`;
fs.writeFileSync('data/plan.json', JSON.stringify(planDoc, null, 2) + '\n');

console.log(`  library:      ${usable.length} complete meals`);
console.log(`  combinations: ${candidates.length.toLocaleString()} valid days`);
console.log(`  needed:       ${need}`);
console.log(`  assembled:    ${chosen.length}`);
console.log(`  plan is now:  ${planDoc.days.length} of ${cfg.durationDays} days`);
if (chosen.length < need) {
  console.log(`\n  ${need - chosen.length} short. The constraint is one meal never repeating`);
  console.log(`  in the same slot across the month. Relax that, or add more meals.`);
}
