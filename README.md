# The On-Ramp

Four weeks of meals for Pounds Transformation patients starting a GLP-1.

**You talk to Claude. Claude does the work.** There is nothing to learn and no commands to
memorise. Open this folder in Claude Code and ask for what you want.

---

## Just say what you want

> **"How's the on-ramp looking?"**

> **"Show me week 1."**

> **"This patient can't have dairy — what changes?"**

> **"What do they need to buy this week?"**

> **"Print the handout."**

> **"I've read week 1, sign it off for me — Alisha R, RD."**

Claude runs the checks, reads the results, and answers in plain language. If something
needs a person it says so and tells you what it needs.

---

## What it actually does

It assembles meal plans out of **Pounds' own menus and recipes**, checks the arithmetic on
every single day, and prints a patient handout with a shopping list and the recipes.

Nothing in it came from the internet. Every meal, every recipe and every product traces
back to a file in `_source/`, which is your own material.

## What it will not do

**It will not make up a number.** Not a calorie, not a gram, not a supplement dose. Where
a figure is missing it stays missing and gets flagged. Five days currently show "fat not
stated" rather than a plausible-looking figure, and the patient handout is blocked because
of it. That is the system working.

**It will not print something nobody has approved.** A dietitian signs off the meals in the
plan. If anyone edits a meal afterwards, that signature stops counting and the item comes
back for review.

**It will not clear a meal for an allergy if it cannot read the ingredients.** "Leftovers
from dinner", a branded protein bar, a ranch dressing that turns out to be dairy-based —
those are treated as unsafe, not cleared.

---

## Where it stands

| | |
|---|---|
| Days built | 7 of 28 |
| Meals in the library | 155 usable, all from Pounds files |
| Recipes | all 209 branded recipes loaded; 132 usable, 77 waiting on macros |
| Store products | 538 across 13 Connecticut stores |
| Supplements | all five doses confirmed by Dr. Cavo |

### Still needs a person

- **21 more days.** Every Pounds menu at this calorie target has been used. Either more
  menus, or week 1 repeats four times.
- **Fat on 20 meals.** The menu they came from never stated it.
- **Week 1 nausea guidance.** The GLP material on file is for the *other* programme.
- **What happens at day 29.**
- **When a patient should call** if they cannot eat.
- **Vegan** lands 2 g under the protein floor, and the shake it relies on is dairy.

---

## The targets

| | |
|---|---|
| Protein | **90 g floor, no ceiling** — highest priority |
| Carbohydrate | 50-75 g |
| Calories | 1200 target, yields to protein |

Five supplements daily: KetoCitra, GlucoSupreme gummies, Transform MultiVitamin, Naked
Whey, creatine. The whey counts *inside* the 1200.

---

## If you would rather type

Everything above works from the terminal too.

```
node ramp.mjs          where things stand and what needs you
node ramp.mjs plan     read the weeks
node ramp.mjs print    make the patient handout
```

Full instructions for the dietitians: `DIETITIAN-GUIDE.md`

---

Nothing reaches a patient without Dr. Cavo and a reviewing dietitian signing off.
