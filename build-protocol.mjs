#!/usr/bin/env node
// Pounds On-Ramp protocol builder.
//
//   node build-protocol.mjs              build from data/ (real practice material)
//   node build-protocol.mjs --fixture    build from data/_fixture/ (synthetic, staff copy only)
//   node build-protocol.mjs --self-test  prove the validator fails a broken day
//   node build-protocol.mjs --track=vegan  build a dietary variant (standard is default)
//   node build-protocol.mjs --preview    render the patient copy DRAFT, watermarked,
//                                        so the design can be reviewed before sign-off
//
// Exits non-zero on any validation failure. That is the feature.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDay, checkMacros, reconcile, checkMealArithmetic, openClinicalQuestions } from './lib/validate.mjs';
import { renderStaff, renderPatient, setArtifactMode } from './lib/render.mjs';
import { preflight } from './lib/preflight.mjs';
import { buildQueue } from './lib/review.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const die = msg => { console.error(`\n  BUILD FAILED\n\n${msg}\n`); process.exit(1); };

const trackArg = (argv.find(a => a.startsWith('--track=')) ?? '').split('=')[1] || 'standard';

function load(fixture) {
  const dir = fixture ? 'data/_fixture' : 'data';
  const cfg = read('data/protocol.config.json');
  const allMeals = read(`${dir}/meals.json`).meals ?? [];
  const plan  = read(`${dir}/plan.json`).days ?? [];

  // A track is a filter over the same engine. The mechanism is here; whether a track
  // can actually be built depends entirely on whether the practice has source meals
  // for it. Nothing is substituted or invented to fill a gap.
  const meals = allMeals.filter(m => (m.track ?? 'standard') === trackArg);
  if (!meals.length) {
    const have = [...new Set(allMeals.map(m => m.track ?? 'standard'))];
    const t = cfg.macros;
    die([
      `No meals on the "${trackArg}" track.`,
      ``,
      `  Tracks with source meals: ${have.join(', ')}`,
      ``,
      `  A dietary variant needs practice meals WITH MACROS on that track. The dump does`,
      `  contain a 7-day plant-based menu (Diets/Plant Based Menus/Plant-based Meal`,
      `  Plan.docx), but it states meal names only. No calories, carb or protein, so it`,
      `  cannot be checked against ${t.calories.target} kcal / ${t.carbohydrate.min}-${t.carbohydrate.max} g carb / ${t.protein.min} g+ protein.`,
      ``,
      `  Deriving those numbers would be inventing nutrition. Refusing instead.`,
      ``,
      `  Also blocking this track: see SUPPLEMENTS vs DIETARY TRACKS in --status.`,
      `  Naked Whey is dairy, and it carries 25 g of the day's protein.`,
    ].join('\n'));
  }
  return { cfg, meals, plan, fixture };
}

function build({ cfg, meals, plan, fixture }, { overrideDays } = {}) {
  const mealsById = Object.fromEntries(meals.map(m => [m.id, m]));
  const days = overrideDays ?? plan;

  if (!days.length) {
    die(`No days in the plan.\n\n` +
        `  This is expected at skeleton stage. data/ is empty by design until the\n` +
        `  practice source material lands in _source/.\n\n` +
        `  To exercise the engine right now:  node build-protocol.mjs --self-test`);
  }
  if (days.length !== cfg.durationDays) {
    console.log(`\n  NOTE: plan has ${days.length} days, the protocol needs ${cfg.durationDays}.`);
    console.log(`        Building what exists. This is a sample, not the finished protocol.\n`);
  }

  const resolved = [];
  const errors = [];
  const warnings = [];
  const mismatches = [];
  for (const day of days) {
    const r = resolveDay(day, mealsById, cfg);
    const { fails, warnings: warn } = checkMacros(day.day, r.macros, cfg);
    errors.push(...r.errors, ...fails);
    warnings.push(...warn);
    mismatches.push(...reconcile(day.day, r.food, day.statedTotal));
    resolved.push({ ...day, ...r });
  }
  return { resolved, errors, warnings, mismatches, cfg, fixture };
}

function selfTest() {
  console.log('\n  SELF-TEST — proving the validator actually fails a bad day\n');
  const data = load(true);

  // 1. The good 28 days must pass.
  const good = build(data);
  if (good.errors.length) {
    die(`Fixture that should PASS produced errors:\n\n  ${good.errors.join('\n  ')}`);
  }
  const d1 = good.resolved[0].macros;
  console.log(`  [pass] 28/28 fixture days inside bounds`);
  console.log(`         day 1: ${d1.kcal} kcal, ${d1.protein}g protein, ${d1.carb}g carb, ${d1.fat}g fat`);

  // 2. Break day 14's protein and demand a failure.
  const broken = structuredClone(data.plan);
  broken[13].meals = ['fx-breakfast', 'fx-lunch', 'fx-underprotein'];
  const bad = build(data, { overrideDays: broken });
  if (!bad.errors.length) {
    die('A deliberately broken day PASSED validation. The macro gate is not working.');
  }
  console.log(`  [pass] broken day 14 rejected:`);
  bad.errors.forEach(e => console.log(`         ${e}`));

  // 3. Protein outranks calories: an over-calorie day with clean protein must WARN, not fail.
  const over = structuredClone(data.plan);
  over[0].meals = ['fx-breakfast', 'fx-lunch', 'fx-dinner', 'fx-calorie-overage'];
  const o = build(data, { overrideDays: over });
  if (o.errors.length) {
    die(`A day over 1200 kcal with protein in range should WARN, not fail. Got:\n\n  ${o.errors.join('\n  ')}`);
  }
  if (!o.warnings.length) die('Expected a calorie warning on the over-calorie day. Got none.');
  const d1o = o.resolved[0].macros;
  console.log(`  [pass] protein outranks calories:`);
  console.log(`         day 1 at ${d1o.kcal} kcal / ${d1o.protein}g protein warns instead of failing`);
  o.warnings.slice(0, 1).forEach(w => console.log(`         ${w}`));

  console.log('\n  Self-test OK. Protein floor enforced, calories subordinate.\n');
}

// Walks the config and the data folders and reports exactly what is still blocking.
function status() {
  const cfg = read('data/protocol.config.json');
  const line = s => console.log(s);

  line('\n  ON-RAMP STATUS\n');

  line('  SUPPLEMENTS');
  for (const s of cfg.supplements) {
    const have = s.dose ? 'CONFIRMED' : s.labelDose ? 'LABEL ONLY' : 'MISSING';
    line(`    [${have.padEnd(10)}] ${s.name}`);
    if (s.labelDose) line(`                 ${s.labelDose}`);
    if (s.conflict) line(`                 CONFLICT: ${s.conflict}`);
    if (s.flag)     line(`                 FLAG: ${s.flag.split('.')[0]}.`);
  }

  line('\n  SUPPLEMENTS vs DIETARY TRACKS');
  for (const s2 of cfg.supplements) {
    const v = s2.dietary;
    const name = s2.name.replace(/\s*\(.*\)$/, '');
    line(`    [${(v?.status ?? 'UNREVIEWED').padEnd(12)}] ${name}`);
    if (v?.note) line(`                    ${v.note.split('. ')[0]}.`);
  }

  line('\n  TRACKS');
  for (const [t, note] of Object.entries(cfg.trackNotes ?? {})) {
    line(`    ${t.padEnd(12)} ${note}`);
  }

  line('\n  MACRO RULES');
  const m = cfg.macros;
  const band = (b, unit) =>
    b.max === null || b.max === undefined ? `${b.min}${unit}+ (floor, no ceiling)`
                                          : `${b.min}-${b.max}${unit}`;
  line(`    protein      ${band(m.protein, 'g')}   ${m.protein.answeredBy ? 'answered' : 'OPEN'}`);
  line(`    carbohydrate ${band(m.carbohydrate, 'g')}  answered`);
  line(`    calories     ${m.calories.target} kcal, subordinate to protein   answered`);
  line(`    whey inside the 1200?  ${cfg.wheyCountsInsideCalories === null ? 'OPEN' : cfg.wheyCountsInsideCalories}`);

  line('\n  CLINICAL FLAGS');
  for (const f of cfg.clinicalFlags ?? []) line(`    [${f.severity}] ${f.id}: ${f.issue.split('.')[0]}.`);

  line('\n  DATA FILES');
  for (const f of ['foods', 'meals', 'plan']) {
    const d = read(`data/${f}.json`);
    const n = (d.foods ?? d.meals ?? d.days ?? []).length;
    line(`    data/${f}.json  ${n} ${n === 0 ? 'entries  EMPTY - blocks every build' : 'entries'}`);
  }

  line('\n  SOURCE MATERIAL');
  for (const b of ['01_foundation', '02_glp_education', '03_supplement_dosing', '04_existing_meal_lists']) {
    let n = 0;
    try { n = fs.readdirSync(path.join(ROOT, '_source', b)).filter(f => !f.startsWith('_')).length; } catch {}
    line(`    ${b.padEnd(24)} ${String(n).padStart(3)} files`);
  }

  const open = openClinicalQuestions(cfg);
  line(`\n  ${open.length} question(s) blocking the patient copy:`);
  open.forEach(q => line(`    - ${q}`));
  line('');
}

function main() {
  if (has('--self-test')) return selfTest();
  if (has('--status'))    return status();

  const fixture = has('--fixture');
  const data = load(fixture);
  const { resolved, errors, warnings, mismatches, cfg } = build(data);

  // Per-meal arithmetic: pinpoints the individual cell that is wrong.
  // 35 kcal tolerance: absorbs ordinary rounding, surfaces only real errors.
  const badMeals = data.meals.map(m => checkMealArithmetic(m, 35)).filter(Boolean);
  if (badMeals.length) {
    console.log(`  MEAL ARITHMETIC`);
    console.log(`  ${badMeals.length} meal(s) whose stated calories disagree with their own grams`);
    console.log(`  by more than 35 kcal (protein x4 + carb x4 + fat x9):\n`);
    for (const b of badMeals) {
      console.log(`    ${b.name}`);
      console.log(`      says ${b.stated} kcal, its grams imply ${b.implied} kcal  (${b.diff > 0 ? '+' : ''}${b.diff})`);
      console.log(`      ${b.suggestion}`);
    }
    console.log('');
  }

  // Fat is now tracked (Tyler 2026-08-27), so a day whose fat is unknown is incomplete
  // rather than acceptable. Show it as unknown; never show it as zero.
  const fatGaps = resolved.filter(d => (d.fatUnknown ?? []).length);
  if (fatGaps.length && cfg.macros.fat?.tracked) {
    console.log(`  FAT NOT STATED`);
    console.log(`  Fat is a tracked macro, but ${fatGaps.length} day(s) have meals whose source`);
    console.log(`  document does not state it. It is NOT derived.
`);
    for (const d of fatGaps) {
      console.log(`    day ${String(d.day).padStart(2)}  ${d.fatUnknown.length} meal(s): ${d.fatUnknown.join(', ')}`);
    }
    console.log(`
  The RD supplies these, or the days stay flagged.
`);
  }

  const unknown = [...new Set(resolved.flatMap(d => d.unknown ?? []))];
  if (unknown.length) {
    console.log(`  SUPPLEMENTS COUNTED INSIDE THE 1200`);
    const counted = resolved[0]?.counted ?? [];
    counted.forEach(c => console.log(`    ${c.name} - ${c.dose}`));
    console.log(`
  ${unknown.length} macro(s) still unknown, so the day budget cannot close:`);
    unknown.forEach(u => console.log(`    ${u}`));
    console.log('');
  }

  // Print reconciliation FIRST — when a day fails its bands, this usually explains why.
  if (mismatches.length) {
    console.log(`  SOURCE RECONCILIATION`);
    console.log(`  ${mismatches.length} figure(s) where the source document's stated day total`);
    console.log(`  disagrees with the sum of its own meals.\n`);
    console.log(`    day  macro     meals sum   doc says     diff`);
    for (const m of mismatches) {
      console.log(`    ${String(m.day).padStart(3)}  ${m.macro.padEnd(8)}  ${String(m.computed).padStart(9)}  ${String(m.stated).padStart(8)}  ${((m.diff > 0 ? '+' : '') + m.diff).padStart(7)}`);
    }
    console.log(`\n  The build trusts the MEALS, because those are what the patient actually eats.`);
    console.log(`  Somebody has to say which number is right before this reaches anyone.\n`);
  }

  if (warnings.length) {
    console.log(`  ${warnings.length} day(s) over ${cfg.macros.calories.max} kcal to protect protein (allowed per Cavo):`);
    warnings.forEach(w => console.log(`    ${w}`));
    console.log('');
  }

  if (errors.length) {
    console.error(`  VALIDATION FAILURES\n`);
    errors.forEach(e => console.error(`    ${e}`));
    console.error('');
  }

  const mealsById = Object.fromEntries(data.meals.map(m => [m.id, m]));

  // Cross-checks. Runs on every build so nothing reaches a patient unverified.
  const storeItems = fs.existsSync(path.join(ROOT, 'data/store-items.json'))
    ? read('data/store-items.json').items : [];
  const pf = preflight({
    days: resolved, meals: data.meals, cfg,
    recipes: read('data/recipes.json'), canonical: read('data/canonical.json'), storeItems,
  });
  if (pf.findings.length) {
    console.log(`  PREFLIGHT  ${pf.counts.stop} stop · ${pf.counts.waste} unnecessary spend · ${pf.counts.check} to check
`);
    for (const f of pf.findings) {
      const tag = { stop: 'STOP ', waste: 'WASTE', check: 'CHECK' }[f.severity];
      console.log(`    [${tag}] ${f.detail}`);
    }
    console.log(`
  Full detail: node _preflight.mjs
`);
  }

  // Dietitian review. Items enter the queue as they are added and drop back in when
  // edited, so review happens alongside the build rather than as a read-through at the end.
  const incomplete = data.meals.filter(m => m.usableInPlan === false);
  if (incomplete.length) {
    const byMiss = {};
    for (const m of incomplete) {
      const k = (m.missingMacros ?? []).join(', ') || 'unknown';
      byMiss[k] = (byMiss[k] ?? 0) + 1;
    }
    console.log(`  FLAGGED FOR A DIETITIAN   ${incomplete.length} Pounds recipe(s) imported but not usable yet`);
    for (const [k, n] of Object.entries(byMiss).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${String(n).padStart(3)} missing ${k}`);
    }
    console.log(`      They are in the library and searchable. The assembler will not use them.`);
    console.log(`      node incomplete.mjs   to work through them
`);
  }

  const queue = buildQueue({ meals: data.meals, plan: data.plan, recipes: read('data/recipes.json') });
  if (queue.counts.blocking) {
    console.log(`  REVIEW     ${queue.counts.blocking} item(s) in the plan awaiting a dietitian` +
                (queue.counts.changed ? `, ${queue.counts.changed} changed since approval` : ''));
    console.log(`             node review.mjs
`);
  }

  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  const open = openClinicalQuestions(cfg);

  // The staff copy always renders. It is the REVIEW artifact, so it has to be readable
  // precisely when days are failing - that is when a human needs to look at it.
  const staffArgs = [resolved, cfg, open, fixture, { errors, mismatches, badMeals }];
  fs.writeFileSync(path.join(ROOT, 'dist/staff.html'), renderStaff(...staffArgs));
  console.log(`  dist/staff.html      ${resolved.length} days, macros shown${errors.length ? ', WITH FAILURES MARKED' : ''}`);

  // Publishable form: page content only, for hosting as a shareable link.
  setArtifactMode(true);
  fs.writeFileSync(path.join(ROOT, 'dist/staff.artifact.html'), renderStaff(...staffArgs));
  setArtifactMode(false);
  console.log(`  dist/staff.artifact.html   publishable copy`);

  // Patient copy is gated on validation passing, on top of the clinical questions.
  const preview = has('--preview');
  if (queue.counts.blocking && !preview) {
    console.log(`  dist/patient.html    BLOCKED - ${queue.counts.blocking} item(s) not yet reviewed`);
    console.log(`                       node build-protocol.mjs --preview  to see the draft`);
    console.log('');
    process.exit(1);
  }
  if (queue.counts.blocking && preview) {
    // Renders, but every page is stamped. A draft must never be mistakable for the real thing.
    const pArgs = [resolved, cfg, read('data/canonical.json'), read('data/recipes.json'), mealsById,
      { draft: `DRAFT - ${queue.counts.blocking} items not yet reviewed by a dietitian` }];
    fs.writeFileSync(path.join(ROOT, 'dist/patient-DRAFT.html'), renderPatient(...pArgs));
    setArtifactMode(true);
    fs.writeFileSync(path.join(ROOT, 'dist/patient-DRAFT.artifact.html'), renderPatient(...pArgs));
    setArtifactMode(false);
    console.log(`  dist/patient-DRAFT.html   watermarked draft, ${resolved.length} days`);
    console.log(`                            NOT for a patient. ${queue.counts.blocking} items unreviewed.`);
    console.log('');
    process.exit(0);
  }
  if (pf.counts.stop) {
    console.log(`  dist/patient.html    BLOCKED - ${pf.counts.stop} preflight STOP finding(s)`);
    console.log('');
    process.exit(1);
  }
  if (errors.length) {
    console.log(`  dist/patient.html    BLOCKED - ${errors.length} validation failure(s) above`);
    console.log('');
    process.exit(1);
  }
  if (fixture) {
    console.log(`  dist/patient.html    SKIPPED - refusing to render a patient copy from fixture data`);
  } else if (open.length) {
    console.log(`  dist/patient.html    SKIPPED - ${open.length} clinical question(s) still open:`);
    open.forEach(q => console.log(`                       - ${q}`));
  } else {
    fs.writeFileSync(path.join(ROOT, 'dist/patient.html'), renderPatient(resolved, cfg, read('data/canonical.json'), read('data/recipes.json'), mealsById));
    fs.writeFileSync(path.join(ROOT, 'dist/drip.json'), JSON.stringify(
      resolved.map(d => ({ day: d.day, week: d.week, meals: d.detail.map(m => m.name) })), null, 2));
    console.log(`  dist/patient.html    rendered`);
    console.log(`  dist/drip.json       ${resolved.length} messages`);
  }
  console.log('');
}

main();
