import fs from 'node:fs';
import { resolveDay } from './lib/validate.mjs';
const cfg=JSON.parse(fs.readFileSync('data/protocol.config.json','utf8'));
const meals=JSON.parse(fs.readFileSync('data/meals.json','utf8')).meals;
const plan=JSON.parse(fs.readFileSync('data/plan.json','utf8')).days;
const by=Object.fromEntries(meals.map(m=>[m.id,m]));
const days=plan.filter(d=>d.week===1).map(d=>({...d,...resolveDay(d,by,cfg)}));
const supp=cfg.supplements.filter(s=>s.dose);
const w=s=>String(s??'');
console.log('\n  WEEK 1 — THE ON-RAMP\n');
for(const d of days){
  const m=d.macros;
  console.log(`  DAY ${d.day}`.padEnd(12)+`${Math.round(m.kcal)} kcal   ${Math.round(m.protein)}g protein   ${Math.round(m.carb)}g carb   ${(d.fatUnknown&&d.fatUnknown.length)?'fat not stated':Math.round(m.fat)+'g fat'}`);
  console.log('  '+'-'.repeat(88));
  for(const meal of d.detail){
    console.log(`    ${w(meal.slot).padEnd(10)} ${w(meal.name).slice(0,44).padEnd(46)} ${String(meal.macros.kcal).padStart(4)} kcal  ${String(meal.macros.protein).padStart(3)}g P`);
    if(meal.items?.length) console.log(`               ${meal.items.join(' · ').slice(0,84)}`);
  }
  console.log(`    ${'shake'.padEnd(10)} Naked Whey, 2 scoops in water                   120 kcal   25g P`);
  console.log('');
}
console.log('  EVERY DAY, ALL 7:');
for(const s of supp) console.log(`    ${s.name.replace(/\s*\(.*\)$/,'').padEnd(24)} ${w(s.dose).padEnd(26)} ${w(s.timing)}`);
console.log('');
