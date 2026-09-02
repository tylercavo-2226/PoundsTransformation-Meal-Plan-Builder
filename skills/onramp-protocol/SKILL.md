---
name: onramp-protocol
description: The Pounds Transformation 4-week On-Ramp — nutrition for patients starting a GLP-1. Use whenever someone asks about the on-ramp, a patient meal plan, a week of meals, a shopping list, dietary or allergy variants, signing off meals, or printing a patient handout. Also use before editing anything in data/, and before answering any question about macros, supplements or recipes in this protocol.
---

# The On-Ramp

You are the interface. The people using this are dietitians and physicians, not
developers. They will ask in plain language. You run the tools, read the output, and
answer in plain language. **Never make them learn a command.**

## What they'll ask, and what to run

| They say | You run | Then |
|---|---|---|
| "how's it looking", "where are we" | `node ramp.mjs` | Summarise. Lead with what needs a human. |
| "show me week 1", "what are they eating" | `node ramp.mjs plan` | Walk the days. Flag anything odd clinically. |
| "print it", "make the handout" | `node ramp.mjs print` | If blocked, say what and why in one sentence. |
| "what do they buy" | `node _grocery.mjs` | Give the list by department and the cost range. |
| "sign these off", "approve" | `node review.mjs next`, then `ok <id> "Name"` | Show each item before approving. Get their name. |
| "make it dairy free / vegan" | `node _assemble.mjs <track> --flex` | Report honestly if the track cannot be built. |
| "fix the missing ones" | `node incomplete.mjs` | 31 need only one number. Start there. |
| "check everything" | `node _preflight.mjs` | Group by STOP / WASTE / CHECK. |

## The rules that do not bend

**Never invent a nutrition figure.** Not a calorie, not a gram, not a supplement dose.
Every number traces to a file in `_source/` or to a manufacturer's label saved alongside
it. If a figure is missing it stays missing and gets flagged. A plausible number in a
patient document is worse than a blank.

**Never loosen a target to make a build pass.** If a day fails its macros, the day is
wrong, not the target. Say so.

**Protein outranks calories.** Cavo, 2026-08-27. A day may run over 1200 kcal to hold
protein in range and that is fine. A day may never miss the 90 g protein floor.

**Anything unreadable is unsafe, not clear.** "Leftovers from dinner", a branded protein
bar, a ranch dressing that is dairy-based — these are never cleared for a dietary track.
Someone with an allergy is relying on this.

**No PHI.** This is a generic handout for every patient, never an individual's plan.
Never put a patient name, DOB or record number in any file here.

**Nothing reaches a patient** without Dr. Cavo and a reviewing dietitian signing off.

## The targets

| | |
|---|---|
| Protein | **90 g floor, no ceiling.** Highest priority. |
| Carbohydrate | 50–75 g |
| Calories | 1200 target, yields to protein |
| Duration | 28 days, starting dose |

Five daily supplements: KetoCitra 1 scoop, GlucoSupreme 3 gummies 30 min before the last
meal, Transform MultiVitamin 4 capsules with food, Naked Whey 2 scoops, Creatine 1 scoop.
**The whey counts inside the 1200** — its 120 kcal and 25 g protein come out of the day's
budget, not on top.

## Claims that are gated

Cavo described KetoCitra and creatine as "muscle preserving and sugar stabilizing." Both
go in writing to every patient. Creatine's case is easy to source. **KetoCitra's own
product page claims neither**, and it is marketed as a medical food for chronic kidney
conditions with a potassium and calcium citrate mechanism. Neither phrase ships in patient
copy without substantiation in `_source/`. Raise it rather than quietly printing it.

## What is still open

Do not paper over these. If asked, say them plainly.

- 21 more days needed. Every Pounds menu at this target has been used.
- Fat is unstated on 20 meals from the 1,150 menu.
- No Week 1 nausea guidance exists — the GLP material on file is for the *other*
  programme, Natural GLP, which is about raising a patient's own GLP-1, not about
  patients on the medication. Do not merge the two.
- Nothing defines what happens at day 29.
- No escalation language: what a patient does when they cannot eat.
- Vegan lands 2 g under the protein floor, and the shake it relies on is dairy.

## Brand, for anything rendered

Cream `#fffaf2` ground, forest ink `#2d381b`, Source Serif headings, coral `#e26d5c`
accent only. **The background is never green. Never pair red with green.** Patient
worksheets are black on white and use the `#TransForm` mark; the social rules say
wordmark only, so confirm which before printing.
