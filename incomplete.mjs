#!/usr/bin/env node
// The dietitian's list of Pounds recipes that need macros filled in.
//   node incomplete.mjs            what is missing, grouped
//   node incomplete.mjs <id>       show one in full, with what the source DID state
//   node incomplete.mjs fill <id> kcal=310 fat=12    supply the missing figures
import fs from 'node:fs';
const F = 'data/meals.json';
const md = JSON.parse(fs.readFileSync(F, 'utf8'));
const rows = md.meals.filter(m => m.usableInPlan === false);
const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'fill') {
  const [id, ...pairs] = rest;
  const m = md.meals.find(x => x.id === id);
  if (!m) { console.error('  no such recipe'); process.exit(1); }
  m.macros ??= {};
  for (const p of pairs) { const [k, v] = p.split('='); m.macros[k] = Number(v); }
  m.missingMacros = ['kcal','protein','carb','fat'].filter(k => typeof m.macros[k] !== 'number');
  if (!m.missingMacros.length) { m.usableInPlan = true; m.macrosIncomplete = false; delete m.reviewReason; }
  fs.writeFileSync(F, JSON.stringify(md, null, 2) + '\n');
  console.log(`  ${m.name}: ${m.missingMacros.length ? 'still missing ' + m.missingMacros.join(', ') : 'COMPLETE — now usable'}`);
} else if (cmd) {
  const m = rows.find(x => x.id === cmd || x.name.toLowerCase().includes(cmd.toLowerCase()));
  if (!m) { console.error('  not found'); process.exit(1); }
  console.log(`\n  ${m.name}`);
  console.log(`  ${m.source}\n`);
  console.log(`    stated by the practice: ${m.macros ? Object.entries(m.macros).map(([k,v])=>k+' '+v).join(' · ') : 'nothing'}`);
  console.log(`    missing:                ${(m.missingMacros ?? []).join(', ')}`);
  console.log(`    serves:                 ${m.servings ?? 'not stated'}`);
  if (m.items?.length) { console.log(`    ingredients`); m.items.forEach(i => console.log(`      ${i}`)); }
  console.log(`\n    fill it:  node incomplete.mjs fill ${m.id} ${(m.missingMacros ?? []).map(k=>k+'=?').join(' ')}\n`);
} else {
  const by = {};
  for (const m of rows) { const k = (m.missingMacros ?? []).join(', '); (by[k] ??= []).push(m); }
  console.log(`\n  ${rows.length} Pounds recipes need macros before they can be used\n`);
  for (const [k, list] of Object.entries(by).sort((a,b) => b[1].length - a[1].length)) {
    console.log(`  missing ${k}   (${list.length})`);
    list.slice(0, 6).forEach(m => console.log(`      ${m.id.padEnd(42)} ${m.name.slice(0, 34)}`));
    if (list.length > 6) console.log(`      ... and ${list.length - 6} more`);
    console.log('');
  }
  console.log(`  node incomplete.mjs <id>   look at one\n`);
}
