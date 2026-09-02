// Can the existing meal library assemble valid days on its own?
// Selects one real meal per slot. Never composes new meals from ingredients — a
// macro solver left to invent combinations produces food nobody wants to eat.
import fs from 'node:fs';
import { classifyMeal } from './lib/dietary.mjs';

const cfg   = JSON.parse(fs.readFileSync('data/protocol.config.json', 'utf8'));
const meals = JSON.parse(fs.readFileSync('data/meals.json', 'utf8')).meals;

const WHEY = cfg.supplements.find(s => s.countsInsideCalories)?.macros ?? {};
const T = cfg.macros;
const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];

const track = process.argv[2] ?? 'standard';
const KEY = { standard: null, 'dairy-free': 'dairyFree', vegetarian: 'vegetarian', vegan: 'vegan' }[track];

// Only meals with a complete macro line can be assembled — fat is tracked now.
const usable = meals.filter(m => {
  if (m.usableInPlan === false) return false;   // flagged incomplete, awaiting a dietitian
  const x = m.macros ?? {};
  if (['kcal', 'protein', 'carb', 'fat'].some(k => typeof x[k] !== 'number')) return false;
  if (!KEY) return true;
  return classifyMeal(m)[KEY];
});

// Slot was inferred from the folder a recipe was filed under, which is a filing
// decision, not a clinical one. A chicken bake is a perfectly good lunch. So entrees
// are eligible at BOTH midday meals unless the practice says otherwise.
const FLEX = process.argv.includes('--flex');
const eligible = (m, slot) => {
  // A side never fills a meal slot on its own. Macro-valid is not the same as a meal.
  // Breakfast tolerates a lighter dish - a yogurt bowl is a real breakfast. Lunch and
  // dinner need a main. Snack takes anything.
  const need = slot === 'snack'     ? ['snack', 'side', 'main']
             : slot === 'breakfast' ? ['main', 'snack']
             : ['main'];
  if (!need.includes(m.role ?? 'main')) return false;
  if (m.slot === slot) return true;
  if (!FLEX) return false;
  return m.slotInferred && ((slot === 'lunch' && m.slot === 'dinner') ||
                            (slot === 'dinner' && m.slot === 'lunch'));
};
const pool = Object.fromEntries(SLOTS.map(s => [s, usable.filter(m => eligible(m, s))]));
console.log(`track: ${track}`);
console.log('pool  ' + SLOTS.map(s => `${s} ${pool[s].length}`).join('  '));
if (SLOTS.some(s => !pool[s].length)) {
  console.log('\nCannot assemble: at least one slot has no usable meal.\n');
  process.exit(0);
}

const inBand = (v, lo, hi) => (lo == null || v >= lo) && (hi == null || v <= hi);

function score(day) {
  // Prefer days closest to the calorie target, protein comfortably clear of the floor.
  const kcal = day.reduce((a, m) => a + m.macros.kcal, 0) + (WHEY.kcal ?? 0);
  return Math.abs(kcal - T.calories.target);
}

// Exhaustive over slot combinations, capped so it stays quick.
const valid = [];
const cap = 60;
for (const b of pool.breakfast.slice(0, cap))
for (const l of pool.lunch.slice(0, cap))
for (const s of pool.snack.slice(0, cap))
for (const d of pool.dinner.slice(0, cap)) {
  const day = [b, l, s, d];
  // No repeating the same dish, or a near-twin of it, inside one day. "Chia Pudding"
  // for breakfast and "DF Chia Pudding" as the snack is technically two meals.
  const keys = day.map(m => m.name.toLowerCase().replace(/^(df|dairy[- ]free|low carb|lc)\s+/, '').trim());
  if (new Set(keys).size < 4) continue;
  const tot = { kcal: WHEY.kcal ?? 0, protein: WHEY.protein ?? 0, carb: WHEY.carb ?? 0, fat: WHEY.fat ?? 0 };
  for (const m of day) for (const k of Object.keys(tot)) tot[k] += m.macros[k];
  if (!inBand(tot.protein, T.protein.min, T.protein.max)) continue;
  if (!inBand(tot.carb, T.carbohydrate.min, T.carbohydrate.max)) continue;
  if (tot.kcal < T.calories.min) continue;          // under is a hard fail
  valid.push({ day, tot });
}

console.log(`\nvalid day combinations: ${valid.length.toLocaleString()}`);
if (!valid.length) { console.log(''); process.exit(0); }

valid.sort((a, b) => score(a.day) - score(b.day));

// How many DISTINCT days, no meal repeated within a day's slot across the set?
const chosen = [];
const usedBySlot = { breakfast: new Set(), lunch: new Set(), snack: new Set(), dinner: new Set() };
for (const v of valid) {
  if (chosen.length >= 28) break;
  if (v.day.some((m, i) => usedBySlot[SLOTS[i]].has(m.id))) continue;
  v.day.forEach((m, i) => usedBySlot[SLOTS[i]].add(m.id));
  chosen.push(v);
}
console.log(`distinct days with NO repeated meal in any slot: ${chosen.length}\n`);

console.log('  day   kcal  prot  carb   fat   meals');
for (const [i, v] of chosen.slice(0, 10).entries()) {
  const t = v.tot;
  console.log(`  ${String(i + 1).padStart(3)}  ${String(Math.round(t.kcal)).padStart(5)} ${String(Math.round(t.protein)).padStart(5)} ${String(Math.round(t.carb)).padStart(5)} ${String(Math.round(t.fat)).padStart(5)}   ${v.day.map(m => m.name.slice(0, 22)).join(' | ')}`);
}
if (chosen.length > 10) console.log(`  ... and ${chosen.length - 10} more`);
console.log('');
