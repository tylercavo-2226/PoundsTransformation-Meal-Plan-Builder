---
description: Work on the Pounds 4-week On-Ramp meal plan — check it, read it, approve it, or print it.
---

Load the `onramp-protocol` skill first. Its rules are not optional.

The person asking is a dietitian or a physician. Answer in plain language. Do not show
them a command unless they ask how something works.

Argument: $ARGUMENTS

If there is no argument, run `node ramp.mjs` and tell them where things stand — lead with
whatever needs a human, not with what is working.

Otherwise read what they want and act:

- **status, how's it going, where are we** → `node ramp.mjs`
- **show me the plan, what are they eating** → `node ramp.mjs plan`, then walk the days
- **print, make the handout, PDF** → `node ramp.mjs print`. If it refuses, give the reason
  in one sentence and what would unblock it.
- **shopping, groceries, what do they buy** → `node _grocery.mjs`
- **approve, sign off, review** → `node review.mjs next`, show them the item, then
  `node review.mjs ok <id> "<their name>"`. Ask for their name; never sign for them.
- **dairy free, vegan, vegetarian, allergic to X** → `node _assemble.mjs <track> --flex`.
  If the track cannot be built, say exactly why and how far short it is.
- **fill in the missing recipes** → `node incomplete.mjs`, start with the 31 that need one number
- **check it, is it safe, what's wrong** → `node _preflight.mjs`

Report what the tools actually say. Do not soften a failure and do not work around one by
changing a target.
