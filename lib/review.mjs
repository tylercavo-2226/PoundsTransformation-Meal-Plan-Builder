// Review as we build, not a read-through at the end.
//
// Every meal and recipe carries its own review state, bound to a hash of its content.
// Add a meal and it enters the queue. Edit an approved meal and it drops back into the
// queue automatically. The dietitian clears items as they land, a few at a time, and
// only ever sees what is new or changed.
//
// Only items IN USE in the plan can block. 97 meals exist; if 28 are in the plan, the
// dietitian reviews 28.

import crypto from 'node:crypto';

export const contentHash = value =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 10);

// What is actually being approved for each kind of item. Changing anything in here
// invalidates the signature; changing anything else (a comment, a note) does not.
export const SUBJECT = {
  meal:   m => [m.name, m.items ?? [], m.macros ?? {}, m.slot, m.track],
  recipe: r => [r.title, r.ingredients ?? [], r.steps ?? [], r.nutrition],
};

export function reviewState(item, kind) {
  const current = contentHash(SUBJECT[kind](item));
  const r = item.review;
  if (!r || !r.by) return { state: 'pending', current, review: r ?? null };
  // Source-approved content carries hash:null - it is the practice's own material,
  // transcribed verbatim, and does not need re-approving every time it is touched.
  // Edit it into something the practice did not write and it must be re-reviewed.
  if (r.hash === null) {
    return item.sourceEdited
      ? { state: 'changed', current, review: r }
      : { state: 'approved', current, review: r };
  }
  if (r.hash !== current) return { state: 'changed', current, review: r };
  return { state: 'approved', current, review: r };
}

export function buildQueue({ meals, plan, recipes }) {
  const inPlan = new Set(plan.flatMap(d => d.meals));
  const usedRecipes = new Set(
    meals.filter(m => inPlan.has(m.id)).flatMap(m => (m.recipes ?? []))
         .filter(n => !n.startsWith('__MISSING__')));

  const rows = [];

  for (const m of meals) {
    const inUse = inPlan.has(m.id);
    const { state, current, review } = reviewState(m, 'meal');
    if (state === 'approved') continue;
    rows.push({ kind: 'meal', id: m.id, label: m.name, inUse, state, hash: current,
                was: review?.by ? `${review.by}, ${review.at}` : null });
  }

  for (const [name, r] of Object.entries(recipes?.recipes ?? {})) {
    const inUse = usedRecipes.has(name);
    const { state, current, review } = reviewState(r, 'recipe');
    if (state === 'approved') continue;
    rows.push({ kind: 'recipe', id: name, label: r.title ?? name, inUse, state, hash: current,
                was: review?.by ? `${review.by}, ${review.at}` : null });
  }

  // In use first, then changed before new: a changed item was already trusted once.
  const rank = r => (r.inUse ? 0 : 10) + (r.state === 'changed' ? 0 : 1);
  rows.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));

  const blocking = rows.filter(r => r.inUse);
  return {
    rows,
    blocking,
    counts: {
      total: rows.length,
      blocking: blocking.length,
      changed: rows.filter(r => r.state === 'changed').length,
      notInUse: rows.length - blocking.length,
    },
  };
}
