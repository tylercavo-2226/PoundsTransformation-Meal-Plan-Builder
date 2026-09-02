#!/usr/bin/env node
// The On-Ramp, in three commands.
//
//   node ramp.mjs          where you are, and the one thing to do next
//   node ramp.mjs plan     read the plan
//   node ramp.mjs print    make the patient handout
//
// Everything else the system does happens underneath. If it needs a human it says so
// in plain words and gives exactly one next step.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const run = (f, a = []) => spawnSync(process.execPath, [f, ...a], { stdio: 'inherit' });
const quiet = (f, a = []) =>
  spawnSync(process.execPath, [f, ...a], { encoding: 'utf8' }).stdout ?? '';

const cmd = process.argv[2] ?? 'status';

if (cmd === 'plan')  { process.exit(run('_week.mjs').status ?? 0); }
if (cmd === 'print') { process.exit(run('build-protocol.mjs').status ?? 0); }

// Anything below is the guided view.
const cfg    = read('data/protocol.config.json');
const meals  = read('data/meals.json').meals;
const plan   = read('data/plan.json').days;

// Work out, in order, the single most useful thing a person could do right now.
const todo = [];

const unfilledFat = plan.filter(d =>
  d.meals.some(id => {
    const m = meals.find(x => x.id === id);
    return m && typeof m.macros?.fat !== 'number';
  })).length;
if (unfilledFat) todo.push({
  what: `${unfilledFat} days show a fat number that isn't real`,
  why:  `Those meals came from a menu that never stated fat. Nothing made one up, so the handout can't print yet.`,
  how:  `node ramp.mjs plan          see which days`,
});

const shortDays = cfg.durationDays - plan.length;
if (shortDays > 0) todo.push({
  what: `${shortDays} more days needed`,
  why:  `The protocol runs ${cfg.durationDays} days and ${plan.length} are built. Every Pounds menu at this calorie target has been used up.`,
  how:  `Either add more menus, or decide week 1 repeats four times.`,
});

const incomplete = meals.filter(m => m.usableInPlan === false).length;
if (incomplete) todo.push({
  what: `${incomplete} Pounds recipes can't be used yet`,
  why:  `They're loaded and searchable, but the source didn't state all four macros. 31 of them need just one number.`,
  how:  `node incomplete.mjs         work through them`,
});

const queue = quiet('review.mjs').match(/(\d+) in the plan waiting/);
const waiting = queue ? Number(queue[1]) : 0;
if (waiting) todo.push({
  what: `${waiting} items need a dietitian's sign-off`,
  why:  `Nothing prints for a patient until someone has read and approved what's in the plan.`,
  how:  `node review.mjs next        one at a time`,
});

const days = plan.length;
console.log(`
  THE ON-RAMP
  Four weeks of meals for patients starting a GLP-1.

  WHERE IT IS
    ${days} of ${cfg.durationDays} days built, all hitting ${cfg.macros.protein.min}g+ protein and ${cfg.macros.carbohydrate.min}-${cfg.macros.carbohydrate.max}g carb
    ${meals.filter(m => m.usableInPlan !== false).length} meals in the library, all from Pounds' own files
    ${cfg.supplements.filter(s => s.dose).length} supplements, every dose confirmed
`);

if (!todo.length) {
  console.log(`  NOTHING NEEDS YOU
    node ramp.mjs print        make the handout
`);
} else {
  console.log(`  ${todo.length} THING${todo.length > 1 ? 'S' : ''} NEED YOU\n`);
  todo.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.what}`);
    console.log(`     ${t.why}`);
    console.log(`     ${t.how}\n`);
  });
}

console.log(`  node ramp.mjs plan         read the four weeks
  node ramp.mjs print        make the handout (blocked until the above is clear)
`);
