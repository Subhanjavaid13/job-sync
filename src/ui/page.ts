/**
 * The dashboard is one self-contained HTML page: no framework, no CDN, no
 * build step. All dynamic data is inserted with textContent (never innerHTML)
 * because job titles/companies come from external APIs.
 *
 * Palette: warm paper + deep pine accent. Every text/mark pair was validated
 * for WCAG contrast (see scripts note in IMPLEMENTATION_PLAN Part 7).
 */
export const pageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>job-sync dashboard</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%2319584D'/%3E%3C/svg%3E">
<style>
  :root {
    --paper: #F6F3EC;
    --card: #FCFBF7;
    --ink: #1B1811;
    --secondary: #575246;
    --muted: #8A8374;
    --hairline: #E5E0D2;
    --baseline: #C9C4B5;
    --pine: #19584D;
    --pine-dark: #14453C;
    --pine-soft: #E3EDE8;
    --amber-bg: #F4E7C8;
    --amber-ink: #6B4A00;
    --good: #2C6E31;
    --critical: #B3372B;
    --running: #8A5F00;
    --term-bg: #201D16;
    --term-ink: #E8E2D4;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  a { color: var(--pine); text-decoration: none; }
  a:hover { text-decoration: underline; }

  header {
    position: sticky; top: 0; z-index: 5; background: var(--card);
    border-bottom: 1px solid var(--hairline);
  }
  .topbar {
    max-width: 1100px; margin: 0 auto; padding: 0 24px;
    display: flex; align-items: center; gap: 22px; height: 54px;
  }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 650; font-size: 15px; }
  .brand-dot { width: 14px; height: 14px; border-radius: 4px; background: var(--pine); }
  nav { display: flex; gap: 4px; flex: 1; }
  nav button {
    appearance: none; border: 0; background: none; cursor: pointer;
    font: inherit; color: var(--secondary); padding: 16px 10px 14px;
    border-bottom: 2px solid transparent;
  }
  nav button:hover { color: var(--ink); }
  nav button[aria-current="true"] { color: var(--ink); font-weight: 600; border-bottom-color: var(--pine); }
  nav button:focus-visible, .btn:focus-visible, input:focus-visible, select:focus-visible {
    outline: 2px solid var(--pine); outline-offset: 2px;
  }

  .btn {
    appearance: none; cursor: pointer; font: inherit; font-weight: 600;
    border-radius: 8px; padding: 8px 14px; border: 1px solid transparent;
  }
  .btn-primary { background: var(--pine); color: #fff; }
  .btn-primary:hover { background: var(--pine-dark); }
  .btn-primary[disabled] { opacity: .55; cursor: not-allowed; }
  .btn-ghost { background: var(--card); color: var(--ink); border-color: var(--hairline); }
  .btn-ghost:hover { border-color: var(--baseline); }

  main { max-width: 1100px; margin: 0 auto; padding: 26px 24px 60px; }
  section[hidden] { display: none; }

  .cards { display: grid; gap: 16px; }
  .card {
    background: var(--card); border: 1px solid var(--hairline);
    border-radius: 10px; padding: 20px;
  }
  .card h2 { margin: 0 0 2px; font-size: 14.5px; font-weight: 650; }
  .card .sub { color: var(--muted); font-size: 12.5px; margin: 0 0 14px; }

  /* Stat tiles */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 16px; }
  .tile .label { color: var(--secondary); font-size: 12.5px; }
  .tile .value { font-size: 30px; font-weight: 650; line-height: 1.25; }
  .tile .hint { color: var(--muted); font-size: 12px; }
  .tile-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }

  /* Bar list (single series → single hue) */
  .bar-row { display: flex; align-items: center; gap: 12px; padding: 5px 0; border-radius: 6px; }
  .bar-row:hover { background: var(--paper); }
  .bar-label { width: 150px; flex: none; color: var(--secondary); text-transform: capitalize; }
  .bar-track { flex: 1; display: flex; align-items: center; border-left: 1px solid var(--baseline); padding-left: 2px; min-height: 20px; }
  .bar { height: 16px; background: var(--pine); border-radius: 0 4px 4px 0; flex: none; min-width: 2px; }
  .bar-row:hover .bar { filter: brightness(1.18); }
  .bar-value { margin-left: 8px; font-variant-numeric: tabular-nums; color: var(--ink); font-size: 13px; }

  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; padding: 6px 10px; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
  td { padding: 8px 10px; border-bottom: 1px solid var(--hairline); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: var(--paper); }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }

  .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
  .chip-source { background: var(--pine-soft); color: var(--pine); font-weight: 600; }
  .chip-score { background: var(--amber-bg); color: var(--amber-ink); }
  .chip-salary { background: var(--amber-bg); color: var(--amber-ink); font-weight: 600; }
  .st-ok { color: var(--good); } .st-failed { color: var(--critical); } .st-running { color: var(--running); }
  .chip-sample { border: 1px dashed var(--baseline); color: var(--muted); background: none; font-weight: 600; letter-spacing: .04em; }

  .filters { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
  input[type="search"], select {
    font: inherit; color: var(--ink); background: var(--card);
    border: 1px solid var(--hairline); border-radius: 8px; padding: 7px 10px;
  }
  input[type="search"] { width: 240px; }

  .empty { color: var(--muted); padding: 26px 0; text-align: center; }

  /* Leads board */
  .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(205px, 1fr)); gap: 12px; align-items: start; }
  .col { background: var(--paper); border: 1px solid var(--hairline); border-radius: 10px; padding: 10px; }
  .col h3 { margin: 2px 4px 10px; font-size: 12.5px; font-weight: 650; color: var(--secondary); display: flex; justify-content: space-between; }
  .col h3 .count { color: var(--muted); font-weight: 500; }
  .lead { background: var(--card); border: 1px solid var(--hairline); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
  .lead .t { font-weight: 600; font-size: 13.5px; margin-bottom: 4px; }
  .lead .s { color: var(--secondary); font-size: 12.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; }
  .lead .meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
  .lead .date { color: var(--muted); font-size: 11.5px; }
  .lead select { width: 100%; font-size: 12.5px; padding: 5px 8px; }
  .lead details { margin-top: 8px; }
  .lead summary { color: var(--muted); font-size: 11.5px; cursor: pointer; }
  .lead textarea {
    width: 100%; margin: 6px 0; font: 12.5px/1.4 inherit; color: var(--ink);
    background: var(--card); border: 1px solid var(--hairline); border-radius: 8px; padding: 7px 9px; resize: vertical;
  }
  .btn-sm { padding: 4px 10px; font-size: 12px; }

  .banner {
    border: 1px dashed var(--baseline); border-radius: 10px; padding: 10px 14px;
    color: var(--secondary); font-size: 13px; margin-bottom: 14px; background: var(--card);
  }

  .term {
    background: var(--term-bg); color: var(--term-ink); border-radius: 10px;
    padding: 14px 16px; font: 12px/1.6 ui-monospace, Consolas, monospace;
    max-height: 420px; overflow: auto; white-space: pre-wrap; word-break: break-word;
  }
  .runmeta { display: flex; gap: 14px; align-items: center; margin: 12px 0; flex-wrap: wrap; }
  .footer { color: var(--muted); font-size: 12px; margin-top: 34px; text-align: center; }
  .mt { margin-top: 16px; }
</style>
</head>
<body>
<header>
  <div class="topbar">
    <div class="brand"><span class="brand-dot"></span>job-sync</div>
    <nav>
      <button data-tab="overview" aria-current="true">Overview</button>
      <button data-tab="jobs">Jobs</button>
      <button data-tab="leads">Leads</button>
      <button data-tab="run">Run</button>
    </nav>
    <span id="topStatus" class="chip"></span>
    <button id="topRunBtn" class="btn btn-primary">Run now</button>
  </div>
</header>

<main>
  <section id="tab-overview">
    <div class="kpis">
      <div class="card tile"><div class="label">Jobs tracked</div><div class="value" id="kSeen">–</div><div class="hint">total in database</div></div>
      <div class="card tile"><div class="label">Emailed</div><div class="value" id="kEmailed">–</div><div class="hint">delivered to your inbox</div></div>
      <div class="card tile">
        <div class="label">New this week</div>
        <div class="tile-row"><div class="value" id="kWeek">–</div><svg id="spark" width="120" height="38" aria-hidden="true"></svg></div>
        <div class="hint">last 14 days trend</div>
      </div>
      <div class="card tile"><div class="label">Sources active</div><div class="value" id="kSources">–</div><div class="hint">boards contributing matches</div></div>
    </div>
    <div class="cards" style="grid-template-columns: 5fr 7fr;">
      <div class="card">
        <h2>Matches per source</h2>
        <p class="sub">where your tracked jobs came from</p>
        <div id="barList"></div>
      </div>
      <div class="card">
        <h2>Recent runs</h2>
        <p class="sub">local and cloud pipeline executions</p>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>Status</th><th>Started</th><th class="num">Duration</th><th class="num">Fetched</th><th class="num">Matched</th><th class="num">New</th><th class="num">Emailed</th></tr></thead>
          <tbody id="runsBody"></tbody>
        </table></div>
        <div id="runsEmpty" class="empty" hidden>No runs recorded yet — trigger one from the Run tab.</div>
      </div>
    </div>
  </section>

  <section id="tab-jobs" hidden>
    <div class="filters">
      <input type="search" id="jobSearch" placeholder="Search title or company…">
      <select id="jobSource"><option value="">All sources</option></select>
      <select id="jobOrder">
        <option value="recent">Newest first</option>
        <option value="score">Best match first</option>
      </select>
      <button class="btn btn-ghost" id="jobRefresh">Refresh</button>
    </div>
    <div class="card">
      <div style="overflow-x:auto"><table>
        <thead><tr><th class="num">Match</th><th>Title</th><th>Company</th><th>Source</th><th>Salary</th><th>Location</th><th class="num">Seen</th></tr></thead>
        <tbody id="jobsBody"></tbody>
      </table></div>
      <div id="jobsEmpty" class="empty" hidden>No jobs recorded yet. Older rows (before the dashboard existed) only carry an id — new runs store full details.</div>
    </div>
  </section>

  <section id="tab-leads" hidden>
    <div class="banner" id="leadsBanner" hidden>
      Showing <strong>sample preview data</strong> — the leads pipeline interface is ready, its data sources land next
      (see LEADS_PLAN.md: Reddit hiring posts, HN freelance threads, contract roles from the job sources, Freelancer.com).
      Status changes on samples are not saved.
    </div>
    <div class="board" id="leadsBoard"></div>
  </section>

  <section id="tab-run" hidden>
    <div class="card">
      <h2>Run the pipeline</h2>
      <p class="sub">fetch all sources → filter → dedupe → digest. The GitHub Actions cron also runs this every 2 hours in the cloud.</p>
      <div class="runmeta">
        <button id="runBtn" class="btn btn-primary">Run pipeline now</button>
        <span id="runInfo" class="chip"></span>
      </div>
      <pre class="term" id="runLog">No run triggered from the dashboard yet.</pre>
    </div>
  </section>

  <div class="footer">job-sync · local dashboard (127.0.0.1) · data from data/jobs.db</div>
</main>

<script>
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function fmtDate(iso) {
    if (!iso) return '–';
    var d = new Date(iso);
    if (isNaN(d)) return '–';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '–';
    var d = new Date(iso);
    if (isNaN(d)) return '–';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function getJSON(url) { return fetch(url).then(function (r) { return r.json(); }); }
  function postJSON(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); });
  }

  /* ---------- tabs ---------- */
  var tabs = ['overview', 'jobs', 'leads', 'run'];
  function showTab(name) {
    tabs.forEach(function (t) {
      $('#tab-' + t).hidden = t !== name;
      var btn = document.querySelector('nav button[data-tab="' + t + '"]');
      if (btn) btn.setAttribute('aria-current', t === name ? 'true' : 'false');
    });
    if (name === 'overview') loadOverview();
    if (name === 'jobs') loadJobs();
    if (name === 'leads') loadLeads();
    if (name === 'run') pollRun(true);
    if (history.replaceState) history.replaceState(null, '', '#' + name);
  }
  document.querySelectorAll('nav button').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });

  /* ---------- overview ---------- */
  function statusChip(status) {
    var icon = status === 'ok' ? '\\u25CF' : status === 'failed' ? '\\u2715' : '\\u25CC';
    var chip = el('span', 'chip st-' + status, icon + ' ' + status);
    return chip;
  }
  function loadOverview() {
    getJSON('/api/overview').then(function (d) {
      $('#kSeen').textContent = d.totals.seen;
      $('#kEmailed').textContent = d.totals.emailed;
      $('#kWeek').textContent = d.totals.newThisWeek;
      $('#kSources').textContent = d.totals.activeSources;
      drawSpark(d.perDay || []);

      var list = $('#barList');
      list.textContent = '';
      var max = 1;
      d.perSource.forEach(function (r) { if (r.count > max) max = r.count; });
      d.perSource.forEach(function (r) {
        var row = el('div', 'bar-row');
        row.appendChild(el('span', 'bar-label', r.source));
        var track = el('div', 'bar-track');
        var bar = el('div', 'bar');
        bar.style.width = Math.max(1, Math.round((r.count / max) * 82)) + '%';
        track.appendChild(bar);
        track.appendChild(el('span', 'bar-value', r.count));
        row.appendChild(track);
        list.appendChild(row);
      });
      if (d.perSource.length === 0) list.appendChild(el('div', 'empty', 'No data yet — run the pipeline once.'));

      var body = $('#runsBody');
      body.textContent = '';
      $('#runsEmpty').hidden = d.runs.length > 0;
      d.runs.forEach(function (r) {
        var tr = el('tr');
        var tdS = el('td'); tdS.appendChild(statusChip(r.status)); tr.appendChild(tdS);
        if (r.error) tdS.title = r.error;
        tr.appendChild(el('td', 'num', fmtDateTime(r.started_at)));
        var dur = '–';
        if (r.finished_at && r.started_at) {
          var ms = new Date(r.finished_at) - new Date(r.started_at);
          if (ms >= 0) dur = (ms / 1000).toFixed(1) + 's';
        }
        tr.appendChild(el('td', 'num', dur));
        tr.appendChild(el('td', 'num', r.fetched));
        tr.appendChild(el('td', 'num', r.matched));
        tr.appendChild(el('td', 'num', r.fresh));
        tr.appendChild(el('td', 'num', r.emailed));
        body.appendChild(tr);
      });
    });
  }
  function drawSpark(values) {
    var svg = $('#spark');
    svg.textContent = '';
    if (!values.length) return;
    var w = 120, h = 38, pad = 4;
    var max = 1;
    values.forEach(function (v) { if (v > max) max = v; });
    var pts = values.map(function (v, i) {
      var x = pad + (i * (w - pad * 2)) / (values.length - 1);
      var y = h - pad - (v / max) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var ns = 'http://www.w3.org/2000/svg';
    var line = document.createElementNS(ns, 'polyline');
    line.setAttribute('points', pts.join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#C9C4B5');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(line);
    var last = pts[pts.length - 1].split(',');
    var dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]); dot.setAttribute('r', '3.5');
    dot.setAttribute('fill', '#19584D'); dot.setAttribute('stroke', '#FCFBF7'); dot.setAttribute('stroke-width', '2');
    svg.appendChild(dot);
  }

  /* ---------- jobs ---------- */
  var sourcesLoaded = false;
  function loadJobs() {
    var q = encodeURIComponent($('#jobSearch').value || '');
    var src = encodeURIComponent($('#jobSource').value || '');
    var order = encodeURIComponent($('#jobOrder').value || 'recent');
    getJSON('/api/jobs?q=' + q + '&source=' + src + '&order=' + order).then(function (d) {
      if (!sourcesLoaded) {
        d.sources.forEach(function (s) {
          var o = el('option', null, s); o.value = s;
          $('#jobSource').appendChild(o);
        });
        sourcesLoaded = true;
      }
      var body = $('#jobsBody');
      body.textContent = '';
      $('#jobsEmpty').hidden = d.jobs.length > 0;
      d.jobs.forEach(function (j) {
        var tr = el('tr');
        var tdScore = el('td', 'num');
        tdScore.appendChild(el('span', 'chip chip-score', j.score != null ? j.score : '–'));
        tr.appendChild(tdScore);
        var tdTitle = el('td');
        if (j.url) {
          var a = el('a', null, j.title || j.id);
          a.href = j.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
          tdTitle.appendChild(a);
        } else {
          tdTitle.appendChild(el('span', null, j.title || j.id));
        }
        tr.appendChild(tdTitle);
        tr.appendChild(el('td', null, j.company || '–'));
        var tdSrc = el('td');
        if (j.source) tdSrc.appendChild(el('span', 'chip chip-source', j.source));
        else tdSrc.textContent = '–';
        tr.appendChild(tdSrc);
        var tdSal = el('td');
        if (j.salary) tdSal.appendChild(el('span', 'chip chip-salary', j.salary));
        else tdSal.textContent = '–';
        tr.appendChild(tdSal);
        tr.appendChild(el('td', null, j.location || '–'));
        tr.appendChild(el('td', 'num', fmtDate(j.first_seen)));
        body.appendChild(tr);
      });
    });
  }
  $('#jobRefresh').addEventListener('click', loadJobs);
  $('#jobSearch').addEventListener('keydown', function (e) { if (e.key === 'Enter') loadJobs(); });
  $('#jobSource').addEventListener('change', loadJobs);
  $('#jobOrder').addEventListener('change', loadJobs);

  /* ---------- leads ---------- */
  var COLS = [
    { key: 'new', label: 'New' },
    { key: 'shortlisted', label: 'Shortlisted' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'replied', label: 'Replied' },
    { key: 'closed', label: 'Closed' }
  ];
  function loadLeads() {
    getJSON('/api/leads').then(function (d) {
      $('#leadsBanner').hidden = !d.sample;
      var board = $('#leadsBoard');
      board.textContent = '';
      COLS.forEach(function (col) {
        var leads = d.leads.filter(function (l) {
          return col.key === 'closed' ? (l.status === 'won' || l.status === 'lost') : l.status === col.key;
        });
        var colEl = el('div', 'col');
        var h = el('h3', null, col.label);
        h.appendChild(el('span', 'count', leads.length));
        colEl.appendChild(h);
        leads.forEach(function (l) {
          var card = el('div', 'lead');
          var t = el('div', 't');
          if (l.url) {
            var a = el('a', null, l.title); a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            t.appendChild(a);
          } else t.textContent = l.title;
          card.appendChild(t);
          if (l.summary) card.appendChild(el('div', 's', l.summary));
          var meta = el('div', 'meta');
          if (d.sample) meta.appendChild(el('span', 'chip chip-sample', 'SAMPLE'));
          if (l.source) meta.appendChild(el('span', 'chip chip-source', l.source));
          if (l.budget) meta.appendChild(el('span', 'chip chip-salary', l.budget));
          meta.appendChild(el('span', 'date', fmtDate(l.posted_at)));
          if (l.updated_at && l.updated_at !== l.first_seen) {
            meta.appendChild(el('span', 'date', 'upd ' + fmtDate(l.updated_at)));
          }
          card.appendChild(meta);
          var sel = el('select');
          d.statuses.forEach(function (s) {
            var o = el('option', null, s); o.value = s; o.selected = s === l.status;
            sel.appendChild(o);
          });
          sel.addEventListener('change', function () {
            postJSON('/api/leads/status', { id: l.id, status: sel.value }).then(function () { loadLeads(); });
          });
          card.appendChild(sel);
          var det = el('details');
          det.appendChild(el('summary', null, l.notes ? 'Notes \\u00B7 saved' : 'Notes'));
          var ta = el('textarea');
          ta.value = l.notes || '';
          ta.rows = 3;
          ta.placeholder = 'Your notes on this lead\\u2026';
          var save = el('button', 'btn btn-ghost btn-sm', 'Save note');
          save.addEventListener('click', function () {
            postJSON('/api/leads/notes', { id: l.id, notes: ta.value }).then(function (r) {
              save.textContent = r.sample ? 'Not saved (sample)' : 'Saved \\u2713';
              setTimeout(function () { save.textContent = 'Save note'; }, 1600);
            });
          });
          det.appendChild(ta);
          det.appendChild(save);
          card.appendChild(det);
          colEl.appendChild(card);
        });
        if (leads.length === 0) colEl.appendChild(el('div', 'empty', '—'));
        board.appendChild(colEl);
      });
    });
  }

  /* ---------- run ---------- */
  var pollTimer = null;
  function renderRun(s) {
    var runBtns = [$('#runBtn'), $('#topRunBtn')];
    runBtns.forEach(function (b) { b.disabled = s.running; });
    var info = $('#runInfo');
    var top = $('#topStatus');
    if (s.running) {
      info.className = 'chip st-running'; info.textContent = '\\u25CC running since ' + fmtDateTime(s.startedAt);
      top.className = 'chip st-running'; top.textContent = '\\u25CC running';
    } else if (s.exitCode === null) {
      info.className = 'chip'; info.textContent = '';
      top.className = 'chip'; top.textContent = '';
    } else if (s.exitCode === 0) {
      info.className = 'chip st-ok'; info.textContent = '\\u25CF finished ok';
      top.className = 'chip st-ok'; top.textContent = '\\u25CF last run ok';
    } else {
      info.className = 'chip st-failed'; info.textContent = '\\u2715 failed (exit ' + s.exitCode + ')';
      top.className = 'chip st-failed'; top.textContent = '\\u2715 last run failed';
    }
    if (s.log) {
      var term = $('#runLog');
      var stick = term.scrollTop + term.clientHeight >= term.scrollHeight - 8;
      term.textContent = s.log;
      if (stick) term.scrollTop = term.scrollHeight;
    }
  }
  function pollRun(once) {
    getJSON('/api/run/status').then(function (s) {
      renderRun(s);
      if (s.running) {
        if (!pollTimer) pollTimer = setInterval(function () { pollRun(false); }, 1200);
      } else if (pollTimer && !once) {
        clearInterval(pollTimer); pollTimer = null;
        loadOverview();
      }
    });
  }
  function triggerRun() {
    postJSON('/api/run').then(function () { showTab('run'); pollRun(true); pollRun(false); });
  }
  $('#runBtn').addEventListener('click', triggerRun);
  $('#topRunBtn').addEventListener('click', triggerRun);

  /* ---------- boot ---------- */
  var initial = (location.hash || '#overview').slice(1);
  showTab(tabs.indexOf(initial) >= 0 ? initial : 'overview');
  pollRun(true);
})();
</script>
</body>
</html>
`;
