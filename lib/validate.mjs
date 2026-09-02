// Macro engine + gates for the Pounds On-Ramp protocol.
// Every rule here exists because a human cannot check 28 days of arithmetic reliably.

const round = o => Object.fromEntries(
  Object.entries(o).map(([k, v]) => [k, Math.round(v * 10) / 10]));

// Sums a day from its meals. Meals carry the macros the PRACTICE stated; nothing is
// derived here, because deriving nutrition is exactly the invention this repo forbids.
export function resolveDay(day, mealsById, cfg) {
  const macros = { kcal: 0, protein: 0, carb: 0, fat: 0 };
  const errors = [];
  const detail = [];
  const fatUnknown = new Set();

  // A day's meals are POSITIONAL: breakfast, lunch, snack, dinner. A dish filed under
  // "dinner" in the library can be placed at lunch, and when it is, it is a lunch.
  // Labelling it by its library slot leaves the lunch column empty and prints two dinners.
  const POSITIONS = ['breakfast', 'lunch', 'snack', 'dinner'];

  for (const [i, mealId] of day.meals.entries()) {
    const position = POSITIONS[i] ?? `meal ${i + 1}`;
    const meal = mealsById[mealId];
    if (!meal) { errors.push(`day ${day.day}: unknown meal "${mealId}"`); continue; }
    if (!meal.source) { errors.push(`meal "${mealId}" has no source. Every meal must trace to a file in _source/.`); }
    if (meal.usableInPlan === false) {
      errors.push(`day ${day.day}: meal "${meal.name}" is flagged incomplete (missing ${(meal.missingMacros ?? []).join(', ')}). A dietitian supplies those before it can be used.`);
    }
    const m = meal.macros ?? {};
    for (const k of Object.keys(macros)) {
      if (typeof m[k] === 'number') { macros[k] += m[k]; continue; }
      // Fat is optional: several practice menus state only calories, carb and protein,
      // and there is no fat target to check against. Deriving it would be inventing
      // nutrition. Everything else is mandatory.
      if (k === 'fat') { fatUnknown.add(mealId); continue; }
      errors.push(`meal "${mealId}" is missing ${k}`);
    }
    detail.push({
      mealId, name: meal.name,
      slot: position,                 // where it sits in the day
      librarySlot: meal.slot,         // how the library files it
      movedSlot: meal.slot !== position,
      items: meal.items ?? [], macros: round(m),
    });
  }

  const food = round({ ...macros });

  // Cavo 2026-08-27: the protein supplement counts towards the 1200. So any supplement
  // flagged countsInsideCalories spends the same budget the food does, and the day is
  // judged on food PLUS supplement — not on food alone.
  const counted = [];
  const unknown = [];
  for (const s of cfg?.supplements ?? []) {
    if (!s.countsInsideCalories) continue;
    const m = s.macros ?? {};
    const got = {};
    for (const k of Object.keys(macros)) {
      if (typeof m[k] === 'number') { macros[k] += m[k]; got[k] = m[k]; }
      else unknown.push(`${s.name}: ${k} unknown`);
    }
    counted.push({ name: s.name, dose: s.dose, macros: got });
  }

  return { macros: round(macros), food, counted, unknown, detail, errors,
           fatUnknown: [...fatUnknown] };
}

// Judges one day. Returns { fails, warnings }. A non-empty `fails` is fatal.
//
// Cavo 2026-08-26: PROTEIN OUTRANKS CALORIES. A day that runs over 1200 kcal in order to
// land protein inside 90-110g is acceptable and warns. A day that misses protein is not
// acceptable no matter how clean its calories look. That ordering is the whole rule.
export function checkMacros(dayNumber, macros, cfg) {
  const fails = [];
  const warnings = [];

  const band = (label, v, min, max, unit) => {
    const out = [];
    if (min !== null && min !== undefined && v < min) out.push(`${label} ${v}${unit} below minimum ${min}${unit}`);
    if (max !== null && max !== undefined && v > max) out.push(`${label} ${v}${unit} above maximum ${max}${unit}`);
    return out;
  };

  const P = cfg.macros.protein;
  const proteinFails = band('protein', macros.protein, P.min, P.max, 'g');
  fails.push(...proteinFails.map(m => `day ${dayNumber}: ${m}`));

  fails.push(...band('carbohydrate', macros.carb, cfg.macros.carbohydrate.min, cfg.macros.carbohydrate.max, 'g')
    .map(m => `day ${dayNumber}: ${m}`));

  fails.push(...band('fat', macros.fat, cfg.macros.fat.min, cfg.macros.fat.max, 'g')
    .map(m => `day ${dayNumber}: ${m}`));

  // Calories are subordinate. Over the ceiling is only a problem if protein did not need it.
  const C = cfg.macros.calories;
  const proteinIsClean = proteinFails.length === 0;
  for (const issue of band('calories', macros.kcal, C.min, C.max, 'kcal')) {
    if (issue.includes('above maximum') && proteinIsClean && C.subordinateTo === 'protein') {
      warnings.push(`day ${dayNumber}: ${issue}, allowed because protein (${macros.protein}g) is in range`);
    } else {
      fails.push(`day ${dayNumber}: ${issue}`);
    }
  }

  return { fails, warnings };
}

// Compares the sum of a day's meals against the total the source document claims.
// These should agree. Where they do not, the source has an arithmetic problem, and a
// human reviewer reading 28 days of tables will not catch it.
export function reconcile(dayNumber, computed, stated, tolerance = 5) {
  if (!stated) return [];
  const out = [];
  for (const k of ['kcal', 'protein', 'carb', 'fat']) {
    if (typeof stated[k] !== 'number') continue;
    const diff = computed[k] - stated[k];
    if (Math.abs(diff) > tolerance) {
      out.push({
        day: dayNumber, macro: k, computed: computed[k], stated: stated[k],
        diff: Math.round(diff * 10) / 10,
      });
    }
  }
  return out;
}

// Checks a meal's own macros against the calorie identity (protein 4, carb 4, fat 9).
// A meal whose stated calories disagree with its own grams has a typo in one of the
// four numbers. This turns "day 1 is wrong somewhere" into "this cell is wrong".
export function checkMealArithmetic(meal, tolerance = 25) {
  const m = meal.macros ?? {};
  // No fat figure means the identity cannot be checked. Not an error, just unverifiable.
  if (['kcal', 'protein', 'carb', 'fat'].some(k => typeof m[k] !== 'number')) return null;
  const implied = m.protein * 4 + m.carb * 4 + m.fat * 9;
  const diff = m.kcal - implied;
  if (Math.abs(diff) <= tolerance) return null;
  // Which single value would reconcile it?
  const fatFix = Math.round((m.kcal - m.protein * 4 - m.carb * 4) / 9);
  return {
    mealId: meal.id, name: meal.name,
    stated: m.kcal, implied: Math.round(implied), diff: Math.round(diff),
    suggestion: fatFix >= 0 && fatFix !== m.fat
      ? `fat ${m.fat}g would need to be ~${fatFix}g for ${m.kcal} kcal to hold`
      : `no single-value fix; two or more of the four numbers disagree`,
  };
}

// Unresolved clinical decisions. These block a PATIENT render, never a staff draft —
// the whole point is that the draft is visibly incomplete rather than plausibly wrong.
export function openClinicalQuestions(cfg) {
  const open = [];
  if (cfg.wheyCountsInsideCalories === null)
    open.push('Q2 Naked Whey: counts inside the 1200 kcal, or on top? (protocol.config.json wheyCountsInsideCalories)');
  for (const s of cfg.supplements) {
    if (s.dose === null || s.timing === null)
      open.push(`Q5 ${s.name}: dose and timing not confirmed by Cavo.`);
  }
  if (cfg.titration.agentSpecific === null)
    open.push('Q4 Titration: does the protocol change by agent and dose?');
  return open;
}
