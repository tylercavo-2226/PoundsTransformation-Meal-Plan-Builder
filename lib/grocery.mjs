// One consolidated shopping list per week.
//
// Everything collapses onto a canonical cart item, so the list counts what you buy,
// not how many times a recipe mentioned it. Ordered the way a store is walked.

export const DEPARTMENTS = [
  { label: 'Produce',        items: ['salad greens','berries','apples','avocado','citrus','celery','cucumber','tomatoes','peppers','onions','carrots','broccoli','cauliflower','zucchini','green veg','sweet potato'] },
  { label: 'Meat & seafood', items: ['chicken','turkey','beef','pork','sausage','deli meat','salmon','white fish','shrimp'] },
  { label: 'Dairy & eggs',   items: ['eggs','greek yogurt','cottage cheese','cheese','butter'] },
  { label: 'Pantry',         items: ['canned tuna','rice or quinoa','beans','bread or wraps','nuts and seeds','peanut butter','condiments'] },
];

export function buildGroceryList(days, canonical) {
  const { canon, price } = canonical;
  const cart = new Map();

  for (const d of days) {
    for (const meal of d.detail ?? []) {
      for (const line of meal.items ?? []) {
        const l = String(line).toLowerCase();
        for (const [item, words] of Object.entries(canon)) {
          if (words.some(w => l.includes(w))) {
            const c = cart.get(item) ?? new Set();
            c.add(d.day);
            cart.set(item, c);
          }
        }
      }
    }
  }

  let total = 0;
  const byDept = DEPARTMENTS.map(d => ({
    label: d.label,
    rows: d.items.filter(i => cart.has(i)).map(i => {
      const p = price[i] ?? 0;
      total += p;
      return { item: i, price: p, days: [...cart.get(i)].sort((a, b) => a - b) };
    }),
  })).filter(d => d.rows.length);

  return {
    byDept,
    count: cart.size,
    // A range, not a figure. Prices move by store and by week and the list is a guide.
    low: Math.round(total * 0.85),
    high: Math.round(total * 1.15),
  };
}

// Cost a whole month, not four identical weeks.
//
// A month is not 4x a week. Olive oil, rice and peanut butter are one purchase for the
// whole 28 days; salad greens and berries are four. Charging every item weekly roughly
// doubles the figure and makes the plan look unaffordable when it is not.
export function costMonth(days, canonical) {
  const { canon, price, buysPerMonth = {} } = canonical;
  const used = new Map();

  for (const d of days) {
    for (const meal of d.detail ?? []) {
      for (const line of meal.items ?? []) {
        const l = String(line).toLowerCase();
        for (const [item, words] of Object.entries(canon)) {
          if (words.some(w => l.includes(w))) {
            const s = used.get(item) ?? new Set();
            s.add(d.day);
            used.set(item, s);
          }
        }
      }
    }
  }

  const rows = [...used.entries()].map(([item, dayset]) => {
    const unit = price[item] ?? 0;
    const buys = buysPerMonth[item] ?? 4;      // unknown shelf life: assume weekly
    return { item, unit, buys, spend: unit * buys, days: [...dayset].sort((a, b) => a - b) };
  }).sort((a, b) => b.spend - a.spend);

  const total = rows.reduce((a, r) => a + r.spend, 0);
  return {
    rows,
    items: rows.length,
    total: Math.round(total),
    low: Math.round(total * 0.85),
    high: Math.round(total * 1.15),
  };
}
