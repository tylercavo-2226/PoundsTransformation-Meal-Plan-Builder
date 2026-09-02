// Classifies a meal against dietary tracks by reading its own ingredient lines.
//
// This does NOT decide anything clinical. It flags which ingredient triggered which
// exclusion so a human can check the call. A meal is only cleared for a track when
// every one of its lines is clear, and anything it cannot parse is treated as unsafe.

const RULES = [
  { tag: 'dairy', terms: [
    'milk', 'yogurt', 'yoghurt', 'cheese', 'feta', 'mozzarella', 'parmesan', 'cheddar',
    'cottage cheese', 'cream', 'butter', 'whey', 'ghee', 'laughing cow', 'ricotta',
    'half-and-half', 'collagen creamer', 'string cheese',
  ]},
  { tag: 'egg',   terms: ['egg', 'eggs', 'egg white', 'omelet', 'omelette', 'mayo', 'mayonnaise'] },
  { tag: 'fish',  terms: ['tuna', 'salmon', 'cod', 'tilapia', 'shrimp', 'fish', 'anchov', 'seafood'] },
  { tag: 'meat',  terms: [
    'chicken', 'turkey', 'beef', 'pork', 'bacon', 'sausage', 'ham', 'deli', 'steak',
    'burger', 'meatball', 'rotisserie', 'kielbasa', 'pepperoni', 'lamb', 'gelatin',
  ]},
];

// Words that look like a trigger but are not.
const EXEMPT = [
  'dairy-free', 'dairy free', 'non-dairy', 'plant-based', 'vegan',
  'peanut butter', 'nut butter', 'almond butter', 'pb2', 'coconut cream',
  'almond milk', 'oat milk', 'coconut milk', 'soy milk', 'cashew',
  'butternut', 'butter lettuce', 'kite hill', 'owyn', 'chickpea', 'eggplant',
];

// Lines whose contents cannot be read off the text. A branded product, a prepared
// item, or a back-reference to another meal. These are never cleared for any track:
// "Leftovers from dinner" is only vegan if that dinner was, and a protein bar is
// usually whey. Guessing here is how someone with an allergy gets hurt.
const OPAQUE = [
  'leftover', 'protein bar', 'protein shake', 'protein powder', 'protein water',
  'collagen', 'bites', 'shortcuts', 'muffin', 'wrap', 'bagel', 'crackers', 'chips',
  'cereal', 'dressing', 'sauce', 'see recipes', 'pouch', 'protein bar',
];
// Why these: Bolthouse ranch dressing is dairy-based, collagen peptides are bovine,
// branded wraps/bagels/chips/bars vary by SKU. Each is a real question, not caution
// for its own sake. Over-flagging is safe here; under-flagging is how someone with an
// allergy gets hurt.

function scanLine(line) {
  const l = ' ' + line.toLowerCase() + ' ';
  let cleaned = l;
  for (const ex of EXEMPT) cleaned = cleaned.split(ex).join(' ');

  const hits = [];
  for (const { tag, terms } of RULES) {
    for (const t of terms) {
      // Word boundary, but allow a trailing plural: 'sausage' must match 'sausages',
      // while 'ham' must not match 'graham'.
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^a-z])${esc}(e?s)?([^a-z]|$)`);
      if (re.test(cleaned)) { hits.push({ tag, term: t, line }); break; }
    }
  }

  const opaque = OPAQUE.filter(o => cleaned.includes(o));
  return { hits, opaque: opaque.length ? [{ line, terms: opaque }] : [] };
}

export function classifyMeal(meal) {
  const items = meal.items ?? [];
  const scans = items.map(scanLine);
  const hits = scans.flatMap(s => s.hits);
  const opaque = scans.flatMap(s => s.opaque);
  const tags = new Set(hits.map(h => h.tag));

  // Nothing to read, or something unreadable in it, means nothing can be cleared.
  const unverifiable = !items.length || opaque.length > 0;
  const clear = t => !unverifiable && !t;

  return {
    id: meal.id,
    name: meal.name,
    hits,
    opaque,
    tags: [...tags],
    unverifiable,
    dairyFree:  clear(tags.has('dairy')),
    vegetarian: clear(tags.has('meat') || tags.has('fish')),
    vegan:      clear(tags.size > 0),
  };
}

export function trackReport(meals) {
  const rows = meals.map(classifyMeal);
  const bySlot = {};
  for (const r of rows) {
    const m = meals.find(x => x.id === r.id);
    (bySlot[m.slot] ??= []).push(r);
  }
  return { rows, bySlot };
}
