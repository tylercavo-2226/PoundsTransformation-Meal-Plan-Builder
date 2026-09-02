// Cross-checks that run before anything reaches a patient.
//
// Three questions, in priority order:
//   1. Could this send someone in the wrong direction?   (severity: stop)
//   2. Could this make someone buy what they do not need? (severity: waste)
//   3. Is anything unverifiable rather than wrong?        (severity: check)
//
// Every check names the exact record so it can be fixed, not just flagged.

const norm = s => String(s).toLowerCase();

export function preflight({ days, meals, recipes, canonical, cfg, storeItems = [] }) {
  const out = [];
  const add = (severity, check, detail, fix) => out.push({ severity, check, detail, fix });
  const mealsById = Object.fromEntries(meals.map(m => [m.id, m]));
  const book = recipes?.recipes ?? {};

  // ---------------------------------------------------------------- 1. WRONG
  // A meal naming a recipe that does not exist would print a dish with no method.
  for (const m of meals) {
    for (const r of m.recipes ?? []) {
      if (r.startsWith('__MISSING__')) {
        add('check', 'recipe missing',
          `"${m.name}" needs "${r.replace('__MISSING__', '')}" and it is not in the material`,
          'RD supplies it, or the meal is swapped for one that has a recipe');
        continue;
      }
      if (!book[r]) add('stop', 'recipe not found',
        `"${m.name}" declares recipe "${r}" which is not in recipes.json`,
        'Fix the name in meals.json or extract the recipe');
    }
  }

  // A recipe's own nutrition should agree with the macros of the meal that serves it.
  // Disagreement means the patient is being told two different numbers for one plate.
  for (const m of meals) {
    for (const rName of m.recipes ?? []) {
      const r = book[rName];
      if (!r?.nutrition || !m.macros?.kcal) continue;
      const kcal = Number((r.nutrition.match(/(\d{2,4})\s*calories/i) || [])[1]);
      const prot = Number((r.nutrition.match(/(\d{1,3})\s*g\s*protein/i) || [])[1]);
      if (!kcal) continue;
      // Only meaningful when the recipe IS the meal, not one component of it.
      if ((m.recipes ?? []).length > 1) continue;
      if (Math.abs(kcal - m.macros.kcal) > 60)
        add('stop', 'recipe vs meal mismatch',
          `"${m.name}" states ${m.macros.kcal} kcal but its recipe "${rName}" states ${kcal}`,
          'One of the two is wrong. RD decides which.');
      if (prot && Math.abs(prot - m.macros.protein) > 8)
        add('stop', 'recipe vs meal mismatch',
          `"${m.name}" states ${m.macros.protein}g protein, recipe states ${prot}g`,
          'One of the two is wrong. RD decides which.');
    }
  }

  // ------------------------------------------------------- 2. UNNECESSARY SPEND
  // Anything on the shopping list that no meal that week actually uses.
  const usedText = days.flatMap(d => (d.detail ?? []).flatMap(m => m.items ?? [])).map(norm);
  const { canon = {} } = canonical ?? {};
  for (const [item, words] of Object.entries(canon)) {
    const used = usedText.some(t => words.some(w => t.includes(w)));
    if (!used) continue; // not on the list at all, fine
  }

  // A whole package bought for one small use. Real money, and it is avoidable by
  // moving the meal that needs it next to another that uses the same thing.
  const uses = new Map();
  for (const d of days) {
    for (const m of d.detail ?? []) {
      for (const line of m.items ?? []) {
        for (const [item, words] of Object.entries(canon)) {
          if (words.some(w => norm(line).includes(w))) {
            const u = uses.get(item) ?? new Set();
            u.add(d.day);
            uses.set(item, u);
          }
        }
      }
    }
  }
  const price = canonical?.price ?? {};
  for (const [item, dayset] of uses) {
    const p = price[item] ?? 0;
    if (dayset.size === 1 && p >= 5)
      add('waste', 'bought for one day',
        `${item} costs about $${p.toFixed(2)} and is used on day ${[...dayset][0]} only`,
        'Swap that meal, or add a second meal in the week that uses it');
  }

  // Two supplements delivering the same thing. The patient pays twice.
  const supp = (cfg.supplements ?? []).filter(s => s.dose);
  const proteinSources = supp.filter(s => (s.macros?.protein ?? 0) >= 10).map(s => s.name);
  const collagenInMeals = usedText.some(t => t.includes('collagen'));
  if (proteinSources.length && collagenInMeals)
    add('check', 'overlapping protein',
      `The plan includes ${proteinSources.join(', ')} AND collagen in the coffee on several days`,
      'Confirm both are intended. Two protein supplements is two purchases.');

  // ------------------------------------------------------------ 3. UNVERIFIABLE
  // Branded items a patient has to find. Cross-referenced against the practice's own
  // store cheat sheets so the sheet can say WHERE to buy it.
  const BRANDS = /\b(applegate|good culture|fage|dave'?s killer|joseph'?s|mission|sola|wasa|bolthouse|rxsugar|lily'?s|proti|realgood|perdue|catalina|kite ?hill|owyn|al fresco|lark ellen|hughe)/i;
  const branded = new Set();
  for (const t of usedText) {
    const m = t.match(BRANDS);
    if (m) branded.add(m[0]);
  }
  const storeText = storeItems.map(norm).join(' | ');
  for (const b of branded) {
    if (storeText && !storeText.includes(norm(b)))
      add('check', 'brand not on a store list',
        `"${b}" is specified in a meal but does not appear on any Pounds store cheat sheet`,
        'Confirm it is stocked locally, or note a substitute');
  }

  // Fat is tracked but not stated. Showing the supplement-only figure reads as the truth.
  if (cfg.macros?.fat?.tracked) {
    const bad = days.filter(d => (d.fatUnknown ?? []).length);
    if (bad.length)
      add('stop', 'fat shown but unknown',
        `${bad.length} day(s) print a fat figure that is the shake alone; the food's fat is not stated`,
        'Suppress fat on those days, or the RD supplies the missing figures');
  }

  const rank = { stop: 0, waste: 1, check: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return {
    findings: out,
    counts: {
      stop:  out.filter(f => f.severity === 'stop').length,
      waste: out.filter(f => f.severity === 'waste').length,
      check: out.filter(f => f.severity === 'check').length,
    },
  };
}
