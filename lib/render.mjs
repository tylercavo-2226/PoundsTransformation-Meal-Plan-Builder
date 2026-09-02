// Renders the human-facing artifacts. Both come from the same resolved days, so the
// staff reference and the patient packet can never drift apart.
//
// The staff copy is a REVIEW document. Its job is to make problems obvious to an RD
// scanning 28 days of tables. So: summary before detail, colour reserved for things
// that need attention, and every number set in tabular mono.

import { buildGroceryList } from './grocery.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const sign = n => (n > 0 ? '+' : '') + n;

// Pounds brand system (assets/flyers/, content-calendar VISUALS.md): cream ground,
// forest ink, Source Serif display, coral accent. Background is never green.
// Semantic colours are deliberately NOT the coral accent, so "needs attention" and
// "brand accent" never get confused.
const CSS = `
/* Single theme, deliberately. Pounds brand law: the background is ALWAYS cream,
   never green. So there is no dark variant - every ground below is a cream or a
   near-white, and the page paints its own background so it holds on any host.
   Forest green is INK only. Never a ground. */
:root{
  --ink:#2d381b;            /* forest, text only */
  --ink-soft:#5f6350;
  --ink-faint:#8b8b7d;
  --paper:#fffaf2;          /* warm cream. The only ground on the page. */
  --line:#e6ddcb;           /* rules do the structural work, not boxes */
  --accent:#e26d5c;         /* coral, brand accent only */
  --fail:#a03e2f;           /* clay */
  --warn:#a8762c;           /* amber */
  --quiet:#8b8b7d;          /* a passing day gets NO colour. Never red beside green. */
}

*{margin:0;padding:0;box-sizing:border-box}
html{overflow-x:hidden}
body{
  background:var(--paper); color:var(--ink);
  font-family:'Inter',system-ui,Arial,sans-serif;
  font-size:15px; line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
/* Fine paper grain. The grain and the serif are the Pounds premium tell. */
body::before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:1;opacity:.5;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(%23g)' opacity='.05'/></svg>");
}
/* Wide, because this document is mostly tables. Prose sets its own measure via
   max-width on .lede and .finding p, so the wrapper does not need to constrain it.
   The cap exists only to stop day rows stretching absurdly on a very wide monitor. */
.wrap{max-width:76rem;margin:0 auto;padding:3.4rem 2rem 6rem;position:relative;z-index:2;}

h1{font-family:'Source Serif 4','Iowan Old Style',Georgia,'Times New Roman',serif;font-weight:400;font-size:clamp(2rem,4.2vw,2.9rem);
   line-height:1.05;letter-spacing:-.02em;text-wrap:balance;max-width:20ch;}
h1 em{font-style:italic;}
h2{font-family:'Source Serif 4','Iowan Old Style',Georgia,'Times New Roman',serif;font-weight:400;font-size:1.4rem;letter-spacing:-.01em;}
.eyebrow{font-size:.7rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;
   color:var(--accent);margin-bottom:.7rem;}
.lede{margin-top:.9rem;color:var(--ink-soft);max-width:60ch;}

/* ---- the spec: read as a nutrition panel, heavy rule over hairlines ---- */
.spec{margin-top:2rem;border-top:3px solid var(--ink);}
.spec div{display:flex;align-items:baseline;gap:1rem;padding:.42rem 0;
  border-bottom:1px solid var(--line);}
.spec dt{flex:0 0 11rem;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink-soft);}
.spec dd{font-family:'IBM Plex Mono',ui-monospace,'SF Mono',Consolas,monospace;font-size:.95rem;
  font-variant-numeric:tabular-nums;}
.spec .rank{margin-left:auto;font-size:.76rem;color:var(--ink-faint);text-align:right;}

/* ---- the count line: typographic, not tiles ---- */
.counts{display:flex;flex-wrap:wrap;gap:2.2rem;margin-top:1.6rem;
  padding:1rem 0 1.1rem;border-bottom:1px solid var(--line);}
.counts div{min-width:5rem}
.counts .n{font-family:'Source Serif 4','Iowan Old Style',Georgia,'Times New Roman',serif;font-size:2.1rem;line-height:1;
  font-variant-numeric:tabular-nums;}
.counts .is-fail .n{color:var(--fail)}
.counts .is-warn .n{color:var(--warn)}
.counts .l{font-size:.72rem;color:var(--ink-soft);margin-top:.4rem;max-width:11rem;line-height:1.4;}

/* ---- findings: a marginal label and a rule. No boxes, no rails. ---- */
.finding{display:grid;grid-template-columns:8rem minmax(0,1fr);gap:0 1.6rem;
  padding:1.2rem 0;border-bottom:1px solid var(--line);align-items:start;}
.finding:first-of-type{border-top:1px solid var(--line)}
.finding > *{min-width:0}
.badge{font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;
  color:var(--ink-faint);padding-top:.18rem;}
.finding.is-fail .badge{color:var(--fail)}
.finding.is-warn .badge{color:var(--warn)}
.finding h3{font-size:1rem;font-weight:600;text-wrap:balance;}
.finding p{font-size:.86rem;color:var(--ink-soft);margin-top:.4rem;max-width:58ch;}
.finding ul{margin:.6rem 0 0;list-style:none;font-size:.85rem;color:var(--ink-soft);
  columns:2;column-gap:2rem;}
@media (max-width:52rem){ .finding ul{columns:1} }
.finding li{margin:0 0 .5rem;padding-left:.85rem;border-left:1px solid var(--line);
  break-inside:avoid;}
.finding li b{color:var(--ink);font-weight:600}
.finding .scroll{margin-top:.6rem}
.fix{font-family:'IBM Plex Mono',ui-monospace,'SF Mono',Consolas,monospace;font-size:.76rem;color:var(--ink);
  display:inline-block;margin-top:.25rem;}
@media (max-width:44rem){
  .finding{grid-template-columns:1fr;gap:.35rem}
  .badge{padding-top:0}
}

/* ---- tables ---- */
.scroll{overflow-x:auto;}
table{border-collapse:collapse;width:100%;font-size:.85rem;table-layout:auto;}
td:first-child,th:first-child{overflow-wrap:anywhere}
th,td{text-align:left;padding:.45rem .6rem;border-bottom:1px solid var(--line);vertical-align:top;}
th{font-size:.63rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);font-weight:600;}
td.n,th.n{text-align:right;font-family:'IBM Plex Mono',ui-monospace,'SF Mono',Consolas,monospace;
  font-variant-numeric:tabular-nums;white-space:nowrap;}
tr.total td{border-top:1px solid var(--ink);border-bottom:0;font-weight:600;}
tr.stated td{color:var(--ink-faint);font-size:.78rem;border-bottom:0;}
.miss{color:var(--fail);font-weight:600}

/* ---- sticky jump nav ---- */
.nav{position:sticky;top:0;z-index:5;background:var(--paper);
  border-bottom:1px solid var(--line);margin:2.6rem 0 0;padding:.7rem 0;
  display:flex;flex-wrap:wrap;gap:1.2rem;align-items:center;}
.nav a,.nav button{font:inherit;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:600;color:var(--ink-soft);text-decoration:none;background:none;border:0;
  padding:.2rem 0;cursor:pointer;border-bottom:1px solid transparent;}
.nav a:hover,.nav a:focus-visible,.nav button:hover,.nav button:focus-visible{
  color:var(--ink);border-bottom-color:var(--ink);}
.nav a.alert{color:var(--fail)}
.nav .spacer{flex:1}
.nav .sep{color:var(--line)}

/* ---- week grouping ---- */
.week{margin-top:2.2rem}
.week > h3{font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ink-soft);padding-bottom:.4rem;border-bottom:2px solid var(--ink);
  display:flex;justify-content:space-between;align-items:baseline;gap:1rem;}
.week > h3 span{font-weight:400;letter-spacing:.06em;color:var(--ink-faint);}

/* ---- days: ledger rows, collapsed. No cards. ---- */
.day{border-bottom:1px solid var(--line);break-inside:avoid;}
.day > summary{list-style:none;cursor:pointer;padding:.62rem 0;
  display:grid;grid-template-columns:4.6rem minmax(0,1fr) auto;gap:1rem;align-items:baseline;}
.day > summary > *{min-width:0}
.day > summary::-webkit-details-marker{display:none}
.day > summary:hover .daynum{text-decoration:underline;text-underline-offset:3px}
.day > summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.daynum{font-family:'Source Serif 4','Iowan Old Style',Georgia,'Times New Roman',serif;font-size:1.05rem;}
.day.is-fail .daynum{color:var(--fail)}
.mini{display:flex;gap:1.1rem;font-family:'IBM Plex Mono',ui-monospace,'SF Mono',Consolas,monospace;
  font-size:.78rem;font-variant-numeric:tabular-nums;color:var(--ink-faint);flex-wrap:wrap;}
.mini b{color:var(--ink);font-weight:500}
.mini .miss b{color:var(--fail);font-weight:600}
.mini .miss{color:var(--fail)}
.daybody{padding:.2rem 0 1.2rem 4.6rem}
@media (max-width:38rem){ .daybody{padding-left:0} }
.pill{font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;
  color:var(--quiet);flex:none;}
.pill.is-fail{color:var(--fail)}
.meal b{font-weight:600}
.meal .slot{font-size:.63rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);
  display:block;margin-bottom:.12rem;}
.meal .items{font-size:.78rem;color:var(--ink-soft);margin-top:.2rem;
  overflow-wrap:anywhere;}

.sec{margin-top:3rem}
.sec > h2{font-family:'Source Serif 4','Iowan Old Style',Georgia,'Times New Roman',serif;font-weight:400;font-size:1.5rem;
  padding-bottom:.45rem;border-bottom:3px solid var(--ink);letter-spacing:-.01em;}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);
  font-size:.78rem;color:var(--ink-soft);max-width:60ch;}

@media print{
  @page{ margin:14mm 12mm; }
  body{background:#fff;color:#000;font-size:10.5pt;}
  body::before{display:none}                 /* grain muddies print */
  .wrap{padding:0;max-width:none}
  .nav{display:none}                         /* jump links are meaningless on paper */
  /* Collapsed days would print EMPTY. Force every day open on paper. */
  details.day{display:block}
  details.day > summary{list-style:none}
  details.day .daybody{display:block !important}
  .day,.finding,.week{break-inside:avoid}
  .sec > h2{break-after:avoid}
  .week > h3{break-after:avoid}
  a{color:inherit;text-decoration:none}
  .miss{font-weight:700;text-decoration:underline}   /* colour may not print */
}
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..600;1,8..60,300..500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">`;

// ARTIFACT mode emits page content only: the publisher supplies the doctype, head
// and body wrapper, so shipping our own would nest a second document inside it.
let ARTIFACT = false;
export const setArtifactMode = v => { ARTIFACT = v; };

const head = title => ARTIFACT
  ? `<title>${esc(title)}</title>
${FONTS}
<style>${CSS}</style>
<div class="wrap">`
  : `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${FONTS}
<style>${CSS}</style></head><body><div class="wrap">`;

const foot = note => ARTIFACT
  ? `<footer>${note}</footer></div>`
  : `<footer>${note}</footer></div></body></html>`;

// ---------------------------------------------------------------------------

export function renderStaff(days, cfg, open, fixture, checks = {}) {
  const { errors = [], mismatches = [], badMeals = [] } = checks;
  const t = cfg.macros;

  const failedDays = new Set(errors.map(e => (e.match(/^day (\d+)/) || [])[1]).filter(Boolean).map(Number));
  const passing = days.length - failedDays.size;

  const tile = (n, label, state = '') =>
    `<div class="${state}"><div class="n">${n}</div><div class="l">${label}</div></div>`;

  const tiles = `<div class="counts">
    ${tile(`${days.length}/${cfg.durationDays}`, 'Days built of the full protocol', days.length < cfg.durationDays ? 'is-warn' : '')}
    ${tile(passing, 'Days inside every macro band', '')}
    ${tile(failedDays.size, 'Days failing a band', failedDays.size ? 'is-fail' : '')}
    ${tile(badMeals.length + mismatches.length, 'Arithmetic problems in the source', (badMeals.length + mismatches.length) ? 'is-fail' : '')}
    ${tile(open.length, 'Clinical questions open', open.length ? 'is-warn' : '')}
  </div>`;

  const findings = [];

  if (fixture) findings.push(`<div class="finding is-fail">
    <span class="badge">Do not use</span><div>
    <h3>Fixture build, not clinical content</h3>
    <p>Synthetic test numbers. This document exists to prove the validator works and must never reach a patient.</p></div></div>`);

  if (errors.length) findings.push(`<div class="finding is-fail">
    <span class="badge">Fails</span><div>
    <h3>${errors.length} day${errors.length > 1 ? 's' : ''} outside the macro bands</h3>
    <p>A patient following this day as written does not get what the plan promises.</p>
    <ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div></div>`);

  if (badMeals.length) findings.push(`<div class="finding is-fail">
    <span class="badge">Check</span><div>
    <h3>${badMeals.length} meal${badMeals.length > 1 ? 's' : ''} whose calories contradict their own grams</h3>
    <p>Protein &times;4 plus carb &times;4 plus fat &times;9 should land on the stated calories. Where it does not, one of the four numbers is a typo.</p>
    <ul>${badMeals.map(b => `<li><b>${esc(b.name)}</b> &mdash; states ${b.stated} kcal, its grams imply ${b.implied} (${sign(b.diff)})<br><span class="fix">${esc(b.suggestion)}</span></li>`).join('')}</ul></div></div>`);

  if (mismatches.length) findings.push(`<div class="finding is-warn">
    <span class="badge">Reconcile</span><div>
    <h3>The source document disagrees with itself in ${mismatches.length} place${mismatches.length > 1 ? 's' : ''}</h3>
    <p>Each day's stated total against the sum of its own meals. The build trusts the meals, because those are what the patient actually eats.</p>
    <div class="scroll"><table>
      <tr><th>Day</th><th>Macro</th><th class="n">Meals sum</th><th class="n">Document states</th><th class="n">Difference</th></tr>
      ${mismatches.map(m => `<tr><td>${m.day}</td><td>${esc(m.macro)}</td><td class="n">${m.computed}</td><td class="n">${m.stated}</td><td class="n miss">${sign(m.diff)}</td></tr>`).join('')}
    </table></div></div></div>`);

  if (open.length) findings.push(`<div class="finding is-warn">
    <span class="badge">Blocked</span><div>
    <h3>${open.length} clinical question${open.length > 1 ? 's' : ''} unanswered</h3>
    <p>The patient copy will not render until these are settled.</p>
    <ul>${open.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div></div>`);

  // One collapsed row per day. Totals and status read without opening anything,
  // so 28 days stay a scannable list instead of an endless scroll.
  const dayCard = d => {
    const bad = failedDays.has(d.day);
    const s = d.statedTotal;
    const off = k => s && Math.abs(d.macros[k] - s[k]) > 5;
    const band = (k, lo, hi) => (d.macros[k] < lo || (hi && d.macros[k] > hi)) ? ' miss' : '';
    return `<details class="day${bad ? ' is-fail' : ''}"${bad ? ' open' : ''}>
      <summary>
        <span class="daynum">Day ${d.day}</span>
        <span class="mini">
          <span class="${band('kcal', t.calories.min, t.calories.max)}"><b>${d.macros.kcal}</b> kcal</span>
          <span class="${band('protein', t.protein.min, t.protein.max)}"><b>${d.macros.protein}</b> g P</span>
          <span class="${band('carb', t.carbohydrate.min, t.carbohydrate.max)}"><b>${d.macros.carb}</b> g C</span>
          <span><b>${d.macros.fat}</b> g F</span>
        </span>
        <span class="pill${bad ? ' is-fail' : ''}">${bad ? 'Fails' : 'In band'}</span>
      </summary>
      <div class="daybody"><div class="scroll"><table>
        <tr><th>Meal</th><th class="n">kcal</th><th class="n">Protein</th><th class="n">Carb</th><th class="n">Fat</th></tr>
        ${d.detail.map(m => `<tr class="meal"><td><span class="slot">${esc(m.slot)}</span><b>${esc(m.name)}</b>${
          m.items?.length ? `<div class="items">${m.items.map(esc).join(' &middot; ')}</div>` : ''
        }</td><td class="n">${m.macros.kcal}</td><td class="n">${m.macros.protein}</td><td class="n">${m.macros.carb}</td><td class="n">${m.macros.fat}</td></tr>`).join('')}
        <tr class="total"><td>Day total</td>
          <td class="n${off('kcal') ? ' miss' : ''}">${d.macros.kcal}</td>
          <td class="n${off('protein') ? ' miss' : ''}">${d.macros.protein}</td>
          <td class="n${off('carb') ? ' miss' : ''}">${d.macros.carb}</td>
          <td class="n${off('fat') ? ' miss' : ''}">${d.macros.fat}</td></tr>
        ${s ? `<tr class="stated"><td>Source document states</td><td class="n">${s.kcal}</td><td class="n">${s.protein}</td><td class="n">${s.carb}</td><td class="n">${s.fat}</td></tr>` : ''}
      </table></div></div>
    </details>`;
  };

  const weeks = [...new Set(days.map(d => d.week))].sort((a, b) => a - b);
  const weekBlocks = weeks.map(w => {
    const inWeek = days.filter(d => d.week === w);
    const bad = inWeek.filter(d => failedDays.has(d.day)).length;
    return `<section class="week" id="week-${w}">
      <h3>Week ${w}<span>${inWeek.length} day${inWeek.length > 1 ? 's' : ''}${bad ? ` &middot; ${bad} failing` : ''}</span></h3>
      ${inWeek.map(dayCard).join('')}
    </section>`;
  }).join('');

  const nav = `<nav class="nav">
    ${findings.length ? `<a class="alert" href="#attention">Needs attention</a>` : ''}
    ${weeks.map(w => `<a href="#week-${w}">Week ${w}</a>`).join('')}
    <span class="spacer"></span>
    <button type="button" data-toggle="open">Expand all</button>
    <button type="button" data-toggle="close">Collapse all</button>
  </nav>`;

  const script = `<script>
    document.querySelectorAll('.nav [data-toggle]').forEach(function(b){
      b.addEventListener('click', function(){
        var open = b.dataset.toggle === 'open';
        document.querySelectorAll('details.day').forEach(function(d){ d.open = open; });
      });
    });
    // Collapsed <details> print empty, so open every day before printing and
    // put back whatever was open afterwards.
    var wasOpen = [];
    window.addEventListener('beforeprint', function(){
      wasOpen = [];
      document.querySelectorAll('details.day').forEach(function(d, i){
        wasOpen[i] = d.open; d.open = true;
      });
    });
    window.addEventListener('afterprint', function(){
      document.querySelectorAll('details.day').forEach(function(d, i){ d.open = wasOpen[i]; });
    });
  </script>`;

  return head('On-Ramp Staff Reference') + `
    <div class="eyebrow">Staff reference &middot; not for patients</div>
    <h1>The <em>On-Ramp</em> Protocol</h1>
    <p class="lede">Nutrition for patients starting a GLP-1, at the starting dose. Every day below was checked against the bands by the build, and every meal traces to a file in <code>_source/</code>.</p>

    <div class="spec">
      <div><dt>Protein</dt><dd>${t.protein.min}&ndash;${t.protein.max} g</dd><div class="rank">Highest priority</div></div>
      <div><dt>Carbohydrate</dt><dd>${t.carbohydrate.min}&ndash;${t.carbohydrate.max} g</dd><div class="rank">Hard bound</div></div>
      <div><dt>Calories</dt><dd>${t.calories.target}</dd><div class="rank">Yields to protein</div></div>
      <div><dt>Duration</dt><dd>${cfg.durationDays} days</dd><div class="rank">Starting dose</div></div>
    </div>

    ${tiles}
    ${nav}
    ${findings.length ? `<div class="sec" id="attention"><h2>What needs attention</h2>${findings.join('')}</div>` : ''}
    <div class="sec"><h2>The days</h2>${weekBlocks}</div>` +
    script +
    foot('Every figure on this page was checked by <code>build-protocol.mjs</code>. Requires written sign-off from Dr.&nbsp;Cavo and the reviewing RD before any patient use.');
}

// ---------------------------------------------------------------------------


// The patient copy follows the practice's own WEEKLY FOOD DIARY
// (_source/05_patient_formats/Weekly food diary.pdf): a calendar grid, seven days
// across, numbered meal slots down, then Supplements, Water and Carb Total rows.
// Landscape, black on white, coral accents. These are worksheets, not brand collateral.
const PATIENT_CSS = `
:root{ --ink:#111; --coral:#e8442a; --soft:#6b6b6b; --hair:#cfcfcf; }
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;color:var(--ink);font-family:'Inter',system-ui,Arial,sans-serif;
  font-size:15px;line-height:1.35;-webkit-font-smoothing:antialiased;}
.wrap{max-width:92rem;margin:0 auto;padding:2.2rem 1.4rem 4rem;}
.marker{font-family:'Permanent Marker','Bradley Hand',cursive;font-weight:400;text-transform:uppercase;}

.masthead{display:flex;align-items:baseline;gap:1rem;flex-wrap:wrap;margin-bottom:.3rem;}
.masthead h1{font-size:clamp(1.7rem,4vw,2.6rem);line-height:1;}
.masthead .of{color:var(--coral);font-size:clamp(1rem,2vw,1.35rem);}
.masthead .rule{flex:1;height:3px;background:var(--ink);min-width:2rem;}
.intro{font-size:.84rem;color:var(--soft);max-width:70ch;margin-bottom:1.6rem;}

.draftbar{background:#e8442a;color:#fff;font-weight:700;font-size:.78rem;letter-spacing:.14em;
  text-transform:uppercase;padding:.55rem .9rem;margin-bottom:1.4rem;}
@media print{ .draftbar{background:#fff;color:#000;border:3px solid #000} }
.gridwrap{overflow-x:auto;margin-bottom:2.6rem;break-inside:avoid;}
table.diary{border-collapse:collapse;width:100%;table-layout:fixed;min-width:60rem;}
table.diary th,table.diary td{border:1px solid var(--hair);padding:.45rem .5rem;
  vertical-align:top;overflow-wrap:anywhere;}
table.diary thead th{border:0;border-bottom:3px solid var(--ink);text-align:center;
  font-size:.86rem;padding-bottom:.35rem;}
table.diary thead th.corner{border-bottom:3px solid var(--ink)}
th.rowlab{width:7.2rem;border-left:0;text-align:left;font-size:.8rem;line-height:1.15;}
th.rowlab .n{color:var(--coral);display:block;font-size:.92rem;}
td.cell{width:auto;height:4.2rem;}
td.empty{background:#fbfbfb}
.mname{font-size:.8rem;font-weight:600;line-height:1.25}
.mitems{font-size:.71rem;color:var(--soft);margin-top:.15rem;line-height:1.25}
tr.supp th.rowlab,tr.supp td{background:#fdf6f3}
.sname{font-size:.75rem;font-weight:600}
.sdose{font-size:.7rem;color:var(--soft)}
tr.tally td,tr.tally th{height:auto}
.dot{display:inline-block;width:.85rem;height:.85rem;border:1.5px solid var(--hair);
  border-radius:50%;margin:.1rem .12rem 0 0;}
.carb{font-size:.95rem;font-weight:600;font-variant-numeric:tabular-nums;text-align:center}
.carb small{display:block;font-size:.62rem;font-weight:400;color:var(--soft);letter-spacing:.08em;text-transform:uppercase}
.blank{color:var(--hair);font-size:.75rem;text-align:center}
.shop{margin-top:1.6rem;padding-top:.4rem;break-inside:avoid;}
.shopgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.6rem 1.6rem;}
.dept h4{font-size:.74rem;letter-spacing:.1em;padding-bottom:.2rem;border-bottom:2px solid var(--ink);margin-bottom:.3rem;}
.dept ul{list-style:none}
.dept li{display:flex;align-items:center;gap:.4rem;font-size:.78rem;padding:.16rem 0;border-bottom:1px solid #eee;}
.tick{flex:none;width:.72rem;height:.72rem;border:1.5px solid var(--hair);}
.it{flex:1;text-transform:capitalize}
.pr{color:var(--soft);font-variant-numeric:tabular-nums}
.recipes{margin-top:1.8rem}
.rx{break-inside:avoid;margin-bottom:1rem;padding-bottom:.7rem;border-bottom:1px solid #eee;}
.rx h4{font-size:.92rem;font-weight:700;margin-bottom:.35rem;}
.rx h4 span{font-weight:400;font-size:.72rem;color:var(--soft);text-transform:none;}
.rxcols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:.4rem 1.4rem;}
.rxcols ul,.rxcols ol{font-size:.76rem;color:var(--soft);padding-left:1rem;line-height:1.45;}
.rxcols ul{list-style:square}
.rxcols li{margin-bottom:.12rem}
.rxn{font-size:.72rem;color:var(--soft);margin-top:.35rem;font-style:italic;}
@media (max-width:44rem){ .rxcols{grid-template-columns:1fr} }
.est{margin-top:.7rem;font-size:.78rem;color:var(--soft);}
.est b{color:var(--ink)}
footer{margin-top:2rem;padding-top:.9rem;border-top:3px solid var(--ink);
  font-size:.78rem;color:var(--soft);max-width:66ch;}
@media print{
  @page{ size:landscape; margin:10mm; }
  .wrap{padding:0;max-width:none}
  body{font-size:10pt}
  .gridwrap{overflow:visible;break-after:page}
  .gridwrap:last-of-type{break-after:auto}
  table.diary{min-width:0}
}
`;

export function renderPatient(days, cfg, canonical, recipeBook, mealsById = {}, opts = {}) {
  const DAYS_PER_WEEK = 7;
  const SLOTS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const supplements = (cfg.supplements ?? []).filter(s => s.dose);

  const weeks = [...new Set(days.map(d => d.week))].sort((a, b) => a - b);

  const grids = weeks.map(w => {
    const inWeek = days.filter(d => d.week === w);
    // Seven columns always: it is a week grid. Days not yet built stay blank.
    const cols = Array.from({ length: DAYS_PER_WEEK },
      (_, i) => inWeek.find(d => ((d.day - 1) % DAYS_PER_WEEK) === i) ?? null);

    // How many numbered slots this week actually uses.
    const used = Math.max(1, ...inWeek.map(d => d.detail.length));

    const mealRows = SLOTS.slice(0, Math.max(used, 4)).map((label, r) => `
      <tr>
        <th class="rowlab marker">Meal #<span class="n">${label}</span></th>
        ${cols.map(d => {
          if (!d) return `<td class="cell empty"></td>`;
          const m = d.detail[r];
          if (!m) return `<td class="cell"></td>`;
          return `<td class="cell"><div class="mname">${esc(m.name)}</div>${
            m.items?.length ? `<div class="mitems">${m.items.map(esc).join(' &middot; ')}</div>` : ''
          }</td>`;
        }).join('')}
      </tr>`).join('');

    const suppRow = `
      <tr class="supp">
        <th class="rowlab marker">Supplements</th>
        ${cols.map(d => d
          ? `<td>${supplements.map(s =>
              `<div class="sname">${esc(s.name.replace(/\s*\(.*\)$/, ''))}</div>
               <div class="sdose">${esc(s.dose)} &middot; ${esc(s.timing ?? 'daily')}</div>`).join('')}</td>`
          : `<td class="empty"></td>`).join('')}
      </tr>`;

    const waterRow = `
      <tr class="tally">
        <th class="rowlab marker">Water</th>
        ${cols.map(d => `<td>${d ? '<i class="dot"></i>'.repeat(8) : ''}</td>`).join('')}
      </tr>`;

    const carbRow = `
      <tr class="tally">
        <th class="rowlab marker">Carb total</th>
        ${cols.map(d => d
          ? `<td class="carb">${d.macros.carb} g<small>target ${cfg.macros.carbohydrate.min}\u2013${cfg.macros.carbohydrate.max}</small></td>`
          : `<td class="blank">&mdash;</td>`).join('')}
      </tr>`;

    const shop = canonical ? buildGroceryList(inWeek, canonical) : null;
    const shopBlock = shop ? `
      <div class="shop">
        <div class="masthead"><h1 class="marker" style="font-size:1.5rem">Shopping List</h1>
          <span class="of marker" style="font-size:.95rem">Week ${w} &middot; one trip</span>
          <span class="rule"></span></div>
        <div class="shopgrid">
          ${shop.byDept.map(d => `<div class="dept">
            <h4 class="marker">${esc(d.label)}</h4>
            <ul>${d.rows.map(r => `<li><span class="tick"></span><span class="it">${esc(r.item)}</span><span class="pr">$${r.price.toFixed(2)}</span></li>`).join('')}</ul>
          </div>`).join('')}
        </div>
        <p class="est"><b>${shop.count} items &middot; about $${shop.low}–$${shop.high} for the week.</b>
          Estimate only. Prices vary by store, brand and week.</p>
      </div>` : '';

    // Only the recipes this week actually needs, so the sheet stays self-contained
    // without printing a whole cookbook.
    const all = recipeBook?.recipes ?? {};
    const names = Object.keys(all);
    // Meals declare the recipes they need. No fuzzy matching: a near-miss puts the
    // wrong recipe on a patient's sheet.
    const needed = [...new Set(inWeek.flatMap(d => d.detail.flatMap(m =>
      (mealsById[m.mealId]?.recipes) ?? [])))].filter(n => !n.startsWith('__MISSING__'));
    const missing = [...new Set(inWeek.flatMap(d => d.detail.flatMap(m =>
      (mealsById[m.mealId]?.recipes) ?? [])))].filter(n => n.startsWith('__MISSING__'))
      .map(n => n.replace('__MISSING__',''));
    const recipeBlock = needed.length ? `
      <div class="shop recipes">
        <div class="masthead"><h1 class="marker" style="font-size:1.5rem">Recipes</h1>
          <span class="of marker" style="font-size:.95rem">Week ${w}</span>
          <span class="rule"></span></div>
        ${needed.map(n => { const r = all[n]; return `<div class="rx">
          <h4>${esc(r.title)}${r.serves ? ` <span>serves ${r.serves}</span>` : ''}</h4>
          <div class="rxcols">
            <ul>${(r.ingredients ?? []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>
            <ol>${(r.steps ?? []).map(i => `<li>${esc(i)}</li>`).join('')}</ol>
          </div>
          ${r.nutrition ? `<p class="rxn">Per serving: ${esc(r.nutrition)}</p>` : ''}
        </div>`; }).join('')}
        ${missing.length ? `<p class="rxn">Recipe not yet on file: ${missing.map(esc).join(', ')}. Ask at your next visit.</p>` : ''}
      </div>` : '';

    return `<div class="gridwrap">
      <div class="masthead">
        <h1 class="marker">Weekly Food Diary</h1>
        <span class="of marker">Week ${w}</span>
        <span class="rule"></span>
      </div>
      <table class="diary">
        <thead><tr>
          <th class="corner"></th>
          ${cols.map((d, i) => `<th class="marker">Day <span style="color:var(--coral)">${d ? d.day : (w - 1) * DAYS_PER_WEEK + i + 1}</span></th>`).join('')}
        </tr></thead>
        <tbody>${mealRows}${suppRow}${waterRow}${carbRow}</tbody>
      </table>
      ${shopBlock}
      ${recipeBlock}
    </div>`;
  }).join('');

  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Inter:wght@400;500;600;700&display=swap">`;

  const stamp = opts.draft ? `<div class="draftbar">${esc(opts.draft)}</div>` : '';
  const body = `<div class="wrap">
    ${stamp}
    <p class="intro">Your meals for the week, and what to tick off each day. Swap anything that does not work for you, and bring questions to your next visit.</p>
    ${grids}
    <footer>This is general education, not personal medical advice. Follow the instructions your
      Pounds provider gave you.<br>West Hartford &middot; Glastonbury &middot; Southington</footer>
  </div>`;

  return ARTIFACT
    ? `<title>Weekly Food Diary</title>\n${fonts}\n<style>${PATIENT_CSS}</style>\n${body}`
    : `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weekly Food Diary</title>
${fonts}
<style>${PATIENT_CSS}</style></head><body>${body}</body></html>`;
}
