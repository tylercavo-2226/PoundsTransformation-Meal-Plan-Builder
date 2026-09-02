// Report which existing meals clear which dietary tracks, and where the gaps are.
import fs from 'node:fs';
import { classifyMeal } from './lib/dietary.mjs';

const ROOT = '.';
const meals = JSON.parse(fs.readFileSync(`${ROOT}/data/meals.json`, 'utf8')).meals;
const rows = meals.map(m => ({ ...classifyMeal(m), slot: m.slot, protein: m.macros?.protein ?? 0 }));

const pad = (s, n) => String(s).slice(0, n).padEnd(n);
console.log(`${pad('SLOT', 10)} ${pad('MEAL', 44)} ${pad('DF', 4)} ${pad('VEG', 4)} ${pad('VGN', 4)} why`);
console.log('-'.repeat(112));
for (const r of rows) {
  const why = r.unverifiable
    ? 'unreadable: ' + [...new Set(r.opaque.flatMap(o => o.terms))].slice(0, 2).join(', ')
    : [...new Set(r.hits.map(h => h.term))].slice(0, 3).join(', ');
  console.log(`${pad(r.slot, 10)} ${pad(r.name, 44)} ${pad(r.dairyFree ? 'yes' : '-', 4)} ${pad(r.vegetarian ? 'yes' : '-', 4)} ${pad(r.vegan ? 'yes' : '-', 4)} ${why}`);
}

const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
console.log('\n\nSLOT COVERAGE — how many days each track could actually fill\n');
console.log(`${pad('TRACK', 14)} ${SLOTS.map(s => pad(s, 11)).join('')} full days`);
console.log('-'.repeat(70));
for (const [label, key] of [['dairy-free', 'dairyFree'], ['vegetarian', 'vegetarian'], ['vegan', 'vegan']]) {
  const counts = SLOTS.map(s => rows.filter(r => r.slot === s && r[key]).length);
  console.log(`${pad(label, 14)} ${counts.map(c => pad(c, 11)).join('')} ${Math.min(...counts)}`);
}

console.log('\n\nPROTEIN AVAILABLE per track (sum of the best day it could build)\n');
for (const [label, key] of [['dairy-free', 'dairyFree'], ['vegetarian', 'vegetarian'], ['vegan', 'vegan']]) {
  const best = SLOTS.map(s => {
    const c = rows.filter(r => r.slot === s && r[key]).map(r => r.protein);
    return c.length ? Math.max(...c) : 0;
  });
  const total = best.reduce((a, b) => a + b, 0);
  console.log(`  ${pad(label, 14)} best-case food protein ${String(total).padStart(3)} g` +
    (total ? `  (+25 whey = ${total + 25} g)` : '  — cannot build a day'));
}
