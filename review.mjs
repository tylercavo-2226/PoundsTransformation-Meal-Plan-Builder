#!/usr/bin/env node
// The dietitian's working tool.
//
//   node review.mjs                    what is waiting
//   node review.mjs next               show the next item in full, ready to judge
//   node review.mjs ok <id> "Name"     approve it
//   node review.mjs ok-all "Name"      approve everything currently in use (use sparingly)
//   node review.mjs note <id> "text"   leave a note without approving

import fs from 'node:fs';
import { buildQueue, reviewState, contentHash, SUBJECT } from './lib/review.mjs';

const MEALS = 'data/meals.json', RECIPES = 'data/recipes.json', PLAN = 'data/plan.json';
const load = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const save = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const today = () => new Date().toISOString().slice(0, 10);

const md = load(MEALS), rd = load(RECIPES), plan = load(PLAN).days;
const q = buildQueue({ meals: md.meals, plan, recipes: rd });
const [cmd, a1, a2] = process.argv.slice(2);

const find = id => {
  const m = md.meals.find(x => x.id === id);
  if (m) return { kind: 'meal', item: m, file: MEALS, doc: md };
  const key = Object.keys(rd.recipes ?? {}).find(k => k === id || k.toLowerCase().startsWith(String(id).toLowerCase()));
  if (key) return { kind: 'recipe', item: rd.recipes[key], file: RECIPES, doc: rd, id: key };
  return null;
};

function show(r) {
  const f = find(r.id);
  console.log(`\n  ${r.kind.toUpperCase()}  ${r.label}`);
  console.log(`  ${r.state === 'changed' ? 'CHANGED since ' + r.was : 'never reviewed'}   ${r.inUse ? 'IN THE PLAN' : 'not in the plan'}\n`);
  const it = f.item;
  if (r.kind === 'meal') {
    console.log(`    slot     ${it.slot}${it.slotInferred ? '  (inferred from a folder - check this)' : ''}`);
    console.log(`    macros   ${it.macros?.kcal} kcal · ${it.macros?.protein}g protein · ${it.macros?.carb}g carb · ${it.macros?.fat ?? 'fat not stated'}`);
    console.log(`    source   ${it.source}`);
    if (it.sourceNote) console.log(`    note     ${it.sourceNote}`);
    console.log(`    items`);
    (it.items ?? []).forEach(i => console.log(`             ${i}`));
  } else {
    console.log(`    serves ${it.serves ?? '?'}   ${it.nutrition ?? 'no nutrition stated'}`);
    console.log(`    source ${it.source}`);
    (it.ingredients ?? []).forEach(i => console.log(`      · ${i}`));
    (it.steps ?? []).forEach((s, i) => console.log(`      ${i + 1}. ${s.slice(0, 100)}`));
  }
  console.log(`\n    approve:  node review.mjs ok ${r.id.includes(' ') ? `"${r.id}"` : r.id} "Your Name"\n`);
}

function approve(id, name) {
  if (!name) { console.error('  Name required: node review.mjs ok <id> "Your Name"'); process.exit(1); }
  const f = find(id);
  if (!f) { console.error(`  No meal or recipe called "${id}"`); process.exit(1); }
  f.item.review = { by: name, at: today(), hash: contentHash(SUBJECT[f.kind](f.item)) };
  save(f.file, f.doc);
  console.log(`  approved: ${f.item.name ?? f.item.title}  —  ${name}, ${today()}`);
}

if (cmd === 'ok') {
  approve(a1, a2);
} else if (cmd === 'ok-all') {
  if (!a1) { console.error('  Name required'); process.exit(1); }
  q.blocking.forEach(r => approve(r.id, a1));
  console.log(`\n  ${q.blocking.length} item(s) approved by ${a1}.`);
} else if (cmd === 'note') {
  const f = find(a1);
  if (!f) { console.error('  not found'); process.exit(1); }
  (f.item.reviewNotes ??= []).push({ at: today(), note: a2 });
  save(f.file, f.doc);
  console.log('  note added.');
} else if (cmd === 'next') {
  if (!q.blocking.length) console.log('\n  Nothing in the plan is waiting on review.\n');
  else show(q.blocking[0]);
} else {
  console.log(`\n  REVIEW QUEUE`);
  console.log(`  ${q.counts.blocking} in the plan waiting · ${q.counts.changed} changed since approval · ${q.counts.notInUse} not in the plan\n`);
  const rows = q.blocking.slice(0, 20);
  for (const r of rows) {
    const tag = r.state === 'changed' ? 'CHANGED' : 'new';
    console.log(`    [${tag.padEnd(7)}] ${r.kind.padEnd(6)} ${r.label.slice(0, 52)}`);
  }
  if (q.counts.blocking > rows.length) console.log(`    ... and ${q.counts.blocking - rows.length} more`);
  console.log(`\n  node review.mjs next     look at the first one`);
  console.log(`  ${q.counts.notInUse} item(s) in the library are unreviewed but not in the plan. They do not block.\n`);
}
