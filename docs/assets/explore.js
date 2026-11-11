(async function () {
  const { make, rebuild, base, axisStyle, impactLine, fmtNum, load } = window.IPL;
  window.IPL.initThemeToggle();

  const D = await load(['meta', 'seasons', 'phases', 'explore_teams', 'explore_venues', 'explore_batting', 'explore_bowling']);
  const IMP = D.meta.impact_season;
  const years = D.meta.seasons.map(String);
  const league = Object.fromEntries(D.seasons.map((s) => [s.season, s]));
  const leaguePhase = {};
  D.phases.forEach((p) => { (leaguePhase[p.season] = leaguePhase[p.season] || {})[p.phase] = p.run_rate; });

  const valueAxis = (t, extra) => axisStyle(t, Object.assign({ type: 'value', scale: true }, extra || {}));
  const seasonAxis = (t) => axisStyle(t, { type: 'category', data: years, boundaryGap: false, splitLine: { show: false } });
  const line = (name, data, color, extra) => Object.assign({ name, type: 'line', data, connectNulls: false, symbol: 'circle', symbolSize: 6,
    lineStyle: { width: 2, color }, itemStyle: { color } }, extra || {});
  const opt = (sel, items, selected) => {
    sel.innerHTML = items.map(([v, l]) => `<option value="${v}"${String(v) === String(selected) ? ' selected' : ''}>${l}</option>`).join('');
  };
  const qs = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- tabs (remember the last one) ----------
  const tabs = document.querySelectorAll('.tabs button');
  function showTab(name) {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== 'panel-' + name; });
    try { localStorage.setItem('ipl-tab', name); } catch (e) { /* ignore */ }
    window.dispatchEvent(new Event('resize'));
  }
  tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  let savedTab = null;
  try { savedTab = localStorage.getItem('ipl-tab'); } catch (e) { /* ignore */ }

  // =====================================================================
  // TEAMS
  // =====================================================================
  const T = D.explore_teams;
  const teamMetrics = [
    ['avg_first_innings', 'Avg first-innings total', (s) => s.avg_first_innings],
    ['run_rate', 'Batting run rate', (s) => s.run_rate],
    ['economy', 'Runs conceded per over', (s) => s.run_rate],
    ['sixes_per_match', 'Sixes hit per match', (s) => s.sixes_per_match / 2],
    ['dot_pct', 'Dot-ball % (batting)', (s) => s.dot_pct],
    ['win_pct', 'Win %', () => 50],
    ['highest', 'Highest total', (s) => s.highest_total],
    ['Powerplay', 'Powerplay run rate', (s) => leaguePhase[s.season].Powerplay],
    ['Death', 'Death-overs run rate', (s) => leaguePhase[s.season].Death],
  ];
  const teamCounts = {};
  T.forEach((r) => { teamCounts[r.team] = (teamCounts[r.team] || 0) + r.matches; });
  const lastSeason = Math.max(...T.map((r) => r.season));
  const current = new Set(T.filter((r) => r.season === lastSeason).map((r) => r.team));
  const teamList = Object.keys(teamCounts).sort((a, b) => (current.has(b) - current.has(a)) || a.localeCompare(b));
  opt(qs('team-select'), teamList.map((t) => [t, current.has(t) ? t : t + ' (defunct)']), 'Mumbai Indians');
  opt(qs('team-metric'), teamMetrics.map(([k, l]) => [k, l]), 'avg_first_innings');
  opt(qs('team-season'), years.slice().reverse().map((y) => [y, y]), lastSeason);

  function teamChart(t) {
    const team = qs('team-select').value;
    const [key, label, lf] = teamMetrics.find((m) => m[0] === qs('team-metric').value);
    const rows = Object.fromEntries(T.filter((r) => r.team === team).map((r) => [r.season, r]));
    qs('team-chart-title').textContent = `${label}: ${team} vs league`;
    return Object.assign(base(t), {
      xAxis: seasonAxis(t),
      yAxis: valueAxis(t),
      tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => (v == null ? '–' : (+v).toFixed(1)) }),
      series: [
        line('League', years.map((y) => +lf(league[y]).toFixed(2)), t.muted, { lineStyle: { width: 2, type: 'dashed', color: t.muted }, showSymbol: false }),
        line(team, years.map((y) => (rows[y] && rows[y][key] != null ? +rows[y][key].toFixed(2) : null)), t.series[0], { markLine: impactLine(t, IMP) }),
      ],
    });
  }
  function teamPhaseChart(t) {
    const team = qs('team-select').value;
    const rows = Object.fromEntries(T.filter((r) => r.team === team).map((r) => [r.season, r]));
    return Object.assign(base(t), {
      xAxis: seasonAxis(t),
      yAxis: valueAxis(t),
      tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => (v == null ? '–' : (+v).toFixed(2)) }),
      series: ['Powerplay', 'Middle', 'Death'].map((p, i) => line(p, years.map((y) => (rows[y] ? +rows[y][p].toFixed(2) : null)), t.series[i], i === 0 ? { markLine: impactLine(t, IMP) } : {})),
    });
  }
  function teamRankChart(t) {
    const season = +qs('team-season').value;
    const [key, label] = teamMetrics.find((m) => m[0] === qs('team-metric').value);
    const sel = qs('team-select').value;
    const rows = T.filter((r) => r.season === season && r[key] != null).sort((a, b) => a[key] - b[key]);
    qs('team-rank-title').textContent = `${label}: all teams in ${season}`;
    return Object.assign(base(t), {
      legend: { show: false },
      grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
      tooltip: Object.assign(base(t).tooltip, { axisPointer: { type: 'shadow' }, valueFormatter: (v) => (+v).toFixed(1) }),
      yAxis: axisStyle(t, { type: 'category', data: rows.map((r) => r.team), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11 } }),
      xAxis: valueAxis(t, { scale: false }),
      series: [{ type: 'bar', name: label, data: rows.map((r) => ({ value: +r[key].toFixed(2), itemStyle: { color: r.team === sel ? t.series[0] : t.seq[1], borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p) => (+p.value).toFixed(1) } }],
    });
  }
  function teamTable() {
    const team = qs('team-select').value;
    const rows = T.filter((r) => r.team === team).sort((a, b) => b.season - a.season);
    qs('t-team').innerHTML = '<table class="data"><thead><tr><th>Season</th><th>Matches</th><th>Wins</th><th>Avg 1st inns</th><th>Highest</th><th>Run rate</th><th>Conceded/over</th><th>Sixes/match</th><th>Dot %</th></tr></thead><tbody>' +
      rows.map((r) => `<tr><td>${r.season}</td><td>${r.matches}</td><td>${r.wins}</td><td>${fmtNum(r.avg_first_innings)}</td><td>${r.highest}</td><td>${fmtNum(r.run_rate, 2)}</td><td>${fmtNum(r.economy, 2)}</td><td>${fmtNum(r.sixes_per_match)}</td><td>${fmtNum(r.dot_pct)}</td></tr>`).join('') + '</tbody></table>';
  }
  const cTeam = make('c-team', teamChart);
  const cTeamPhase = make('c-team-phase', teamPhaseChart);
  const cTeamRank = make('c-team-rank', teamRankChart);
  teamTable();
  const refreshTeams = () => { rebuild(cTeam, teamChart); rebuild(cTeamPhase, teamPhaseChart); rebuild(cTeamRank, teamRankChart); teamTable(); };
  ['team-select', 'team-metric', 'team-season'].forEach((id) => qs(id).addEventListener('change', refreshTeams));

  // =====================================================================
  // VENUES
  // =====================================================================
  const V = D.explore_venues;
  const venueMetrics = [
    ['avg_first_innings', 'Avg first-innings total', (s) => s.avg_first_innings],
    ['run_rate', 'Run rate', (s) => s.run_rate],
    ['sixes_per_match', 'Sixes per match', (s) => s.sixes_per_match],
    ['runs_per_wicket', 'Runs per wicket', (s) => s.runs_per_wicket],
    ['bat_first_win_pct', 'Batting-first win %', (s) => s.bat_first_win_pct],
  ];
  const vCounts = {};
  V.forEach((r) => { vCounts[r.venue] = (vCounts[r.venue] || 0) + r.matches; });
  const venueList = Object.keys(vCounts).filter((v) => vCounts[v] >= 5).sort((a, b) => vCounts[b] - vCounts[a]);
  opt(qs('venue-select'), venueList.map((v) => [v, `${v} (${vCounts[v]})`]), venueList[0]);
  opt(qs('venue-metric'), venueMetrics.map(([k, l]) => [k, l]), 'avg_first_innings');
  const periods = [['all', 'All seasons'], ['2008-2012', '2008–12'], ['2013-2017', '2013–17'], ['2018-2022', '2018–22'], ['2023-2100', '2023 onward']].concat(years.slice().reverse().map((y) => [y + '-' + y, y]));
  opt(qs('venue-period'), periods, '2023-2100');

  function venueChart(t) {
    const v = qs('venue-select').value;
    const [key, label, lf] = venueMetrics.find((m) => m[0] === qs('venue-metric').value);
    const rows = Object.fromEntries(V.filter((r) => r.venue === v && r.matches >= 3).map((r) => [r.season, r]));
    qs('venue-chart-title').textContent = `${label}: ground vs league`;
    return Object.assign(base(t), {
      xAxis: seasonAxis(t),
      yAxis: valueAxis(t),
      tooltip: Object.assign(base(t).tooltip, { valueFormatter: (x) => (x == null ? '–' : (+x).toFixed(1)) }),
      series: [
        line('League', years.map((y) => +lf(league[y]).toFixed(2)), t.muted, { lineStyle: { width: 2, type: 'dashed', color: t.muted }, showSymbol: false }),
        line(v.split(',')[0], years.map((y) => (rows[y] && rows[y][key] != null ? +rows[y][key].toFixed(2) : null)), t.series[0], { markLine: impactLine(t, IMP) }),
      ],
    });
  }
  function venueTable() {
    const v = qs('venue-select').value;
    const rows = V.filter((r) => r.venue === v).sort((a, b) => b.season - a.season);
    qs('t-venue').innerHTML = '<table class="data"><thead><tr><th>Season</th><th>Matches</th><th>Avg 1st inns</th><th>Run rate</th><th>Sixes/match</th><th>Runs/wkt</th><th>Bat-first win %</th></tr></thead><tbody>' +
      rows.map((r) => `<tr><td>${r.season}</td><td>${r.matches}</td><td>${fmtNum(r.avg_first_innings)}</td><td>${fmtNum(r.run_rate, 2)}</td><td>${fmtNum(r.sixes_per_match)}</td><td>${fmtNum(r.runs_per_wicket)}</td><td>${fmtNum(r.bat_first_win_pct, 0)}</td></tr>`).join('') + '</tbody></table>';
  }
  function venueRankChart(t) {
    const [a, b] = qs('venue-period').value === 'all' ? [0, 9999] : qs('venue-period').value.split('-').map(Number);
    const [key, label] = venueMetrics.find((m) => m[0] === qs('venue-metric').value);
    const sel = qs('venue-select').value;
    const agg = {};
    V.filter((r) => r.season >= a && r.season <= b && r[key] != null).forEach((r) => {
      const x = (agg[r.venue] = agg[r.venue] || { w: 0, s: 0 });
      x.w += r.matches; x.s += r[key] * r.matches;
    });
    const rows = Object.entries(agg).filter(([, x]) => x.w >= 8).map(([v, x]) => ({ venue: v, value: x.s / x.w, n: x.w })).sort((p, q) => p.value - q.value).slice(-20);
    qs('venue-rank-title').textContent = `${label}: ground ranking`;
    return Object.assign(base(t), {
      legend: { show: false },
      grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
      tooltip: Object.assign(base(t).tooltip, { axisPointer: { type: 'shadow' }, formatter: (ps) => { const r = rows[ps[0].dataIndex]; return `<b>${esc(r.venue)}</b><br>${label}: ${r.value.toFixed(1)}<br>${r.n} matches`; } }),
      yAxis: axisStyle(t, { type: 'category', data: rows.map((r) => r.venue.split(',')[0]), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11 } }),
      xAxis: valueAxis(t, { scale: false }),
      series: [{ type: 'bar', data: rows.map((r) => ({ value: +r.value.toFixed(2), itemStyle: { color: r.venue === sel ? t.series[0] : t.seq[1], borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p) => (+p.value).toFixed(1) } }],
    });
  }
  let cVenue = null; let cVenueRank = null;
  function initVenues() {
    if (cVenue) return;
    cVenue = make('c-venue', venueChart);
    cVenueRank = make('c-venue-rank', venueRankChart);
    venueTable();
  }
  const refreshVenues = () => { if (!cVenue) return; rebuild(cVenue, venueChart); rebuild(cVenueRank, venueRankChart); venueTable(); };
  ['venue-select', 'venue-metric', 'venue-period'].forEach((id) => qs(id).addEventListener('change', refreshVenues));

  // =====================================================================
  // PLAYERS
  // =====================================================================
  const toObjs = (blob) => blob.rows.map((r) => Object.fromEntries(blob.columns.map((c, i) => [c, r[i]])));
  const BAT = toObjs(D.explore_batting);
  const BOWL = toObjs(D.explore_bowling);
  BAT.forEach((r) => { r.sr = r.balls ? (r.runs / r.balls) * 100 : null; r.avg = r.outs ? r.runs / r.outs : null; r.dot_pct = r.balls ? (r.dots / r.balls) * 100 : null; });
  BOWL.forEach((r) => { r.econ = r.balls ? (r.conceded / r.balls) * 6 : null; r.bavg = r.wickets ? r.conceded / r.wickets : null; r.dot_pct = r.balls ? (r.dots / r.balls) * 100 : null; });
  const totals = (rows, k) => { const m = {}; rows.forEach((r) => { m[r.player] = (m[r.player] || 0) + r[k]; }); return m; };
  const batBalls = totals(BAT, 'balls');
  const bowlBalls = totals(BOWL, 'balls');
  opt(qs('lb-season'), [['all', 'All seasons']].concat(years.slice().reverse().map((y) => [y, y])), lastSeason);
  const mode = () => qs('player-mode').value;

  function fillDatalist() {
    const src = mode() === 'bat' ? batBalls : bowlBalls;
    const names = Object.keys(src).filter((n) => src[n] >= 60).sort((a, b) => src[b] - src[a]);
    qs('player-list').innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
    return names;
  }
  let names = fillDatalist();
  qs('player-input').value = 'V Kohli';

  function playerRows() {
    const p = qs('player-input').value.trim();
    const src = mode() === 'bat' ? BAT : BOWL;
    return Object.fromEntries(src.filter((r) => r.player === p).map((r) => [r.season, r]));
  }
  function playerA(t) {
    const rows = playerRows();
    const bat = mode() === 'bat';
    qs('player-a-title').textContent = bat ? 'Runs per season' : 'Wickets per season';
    qs('player-a-sub').textContent = qs('player-input').value.trim() || 'Choose a player';
    return Object.assign(base(t), {
      legend: { show: false },
      xAxis: axisStyle(t, { type: 'category', data: years, splitLine: { show: false } }),
      yAxis: valueAxis(t, { scale: false }),
      tooltip: Object.assign(base(t).tooltip, { axisPointer: { type: 'shadow' } }),
      series: [{ type: 'bar', name: bat ? 'Runs' : 'Wickets', data: years.map((y) => (rows[y] ? (bat ? rows[y].runs : rows[y].wickets) : null)),
        itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] }, markLine: impactLine(t, IMP) }],
    });
  }
  function playerB(t) {
    const rows = playerRows();
    const bat = mode() === 'bat';
    qs('player-b-title').textContent = bat ? 'Strike rate per season' : 'Economy per season';
    qs('player-b-sub').textContent = bat ? 'Runs per 100 balls, with the league batting strike rate' : 'Runs conceded per over, with the league run rate';
    const lg = years.map((y) => (bat ? +((league[y].runs - league[y].extras) / league[y].balls * 100).toFixed(1) : +league[y].run_rate.toFixed(2)));
    return Object.assign(base(t), {
      xAxis: seasonAxis(t),
      yAxis: valueAxis(t),
      tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => (v == null ? '–' : (+v).toFixed(bat ? 1 : 2)) }),
      series: [
        line('League', lg, t.muted, { lineStyle: { width: 2, type: 'dashed', color: t.muted }, showSymbol: false }),
        line(qs('player-input').value.trim() || 'Player', years.map((y) => (rows[y] ? +(bat ? rows[y].sr : rows[y].econ).toFixed(2) : null)), t.series[1], { markLine: impactLine(t, IMP) }),
      ],
    });
  }
  function playerTable() {
    const rows = Object.values(playerRows()).sort((a, b) => b.season - a.season);
    const bat = mode() === 'bat';
    qs('player-table-title').textContent = `${qs('player-input').value.trim() || 'Player'}: ${bat ? 'batting' : 'bowling'} by season`;
    if (!rows.length) { qs('t-player').innerHTML = '<p class="sub">No matching player. Pick a name from the suggestions.</p>'; return; }
    qs('t-player').innerHTML = bat
      ? '<table class="data"><thead><tr><th>Season</th><th>Team</th><th>Inns</th><th>Runs</th><th>Balls</th><th>SR</th><th>Avg</th><th>4s</th><th>6s</th><th>Dot %</th></tr></thead><tbody>' +
        rows.map((r) => `<tr><td>${r.season}</td><td>${esc(r.team)}</td><td>${r.inns}</td><td>${r.runs}</td><td>${r.balls}</td><td>${fmtNum(r.sr)}</td><td>${fmtNum(r.avg)}</td><td>${r.fours}</td><td>${r.sixes}</td><td>${fmtNum(r.dot_pct)}</td></tr>`).join('') + '</tbody></table>'
      : '<table class="data"><thead><tr><th>Season</th><th>Team</th><th>Inns</th><th>Overs</th><th>Wkts</th><th>Econ</th><th>Avg</th><th>Dot %</th><th>6s conceded</th></tr></thead><tbody>' +
        rows.map((r) => `<tr><td>${r.season}</td><td>${esc(r.team)}</td><td>${r.inns}</td><td>${Math.floor(r.balls / 6)}.${r.balls % 6}</td><td>${r.wickets}</td><td>${fmtNum(r.econ, 2)}</td><td>${fmtNum(r.bavg)}</td><td>${fmtNum(r.dot_pct)}</td><td>${r.sixes}</td></tr>`).join('') + '</tbody></table>';
  }

  // Leaderboard with sortable columns
  let sortKey = null; let sortDir = -1;
  function leaderboard() {
    const bat = mode() === 'bat';
    const season = qs('lb-season').value;
    const minBalls = +qs('lb-min').value;
    const src = bat ? BAT : BOWL;
    let rows;
    if (season === 'all') {
      const agg = {};
      src.forEach((r) => {
        const a = (agg[r.player] = agg[r.player] || { player: r.player, team: r.team, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, dots: 0, inns: 0, conceded: 0, wickets: 0, latest: 0 });
        ['runs', 'balls', 'outs', 'fours', 'sixes', 'dots', 'inns', 'conceded', 'wickets'].forEach((k) => { a[k] += r[k] || 0; });
        if (r.season > a.latest) { a.latest = r.season; a.team = r.team; }
      });
      rows = Object.values(agg);
      rows.forEach((r) => { r.sr = r.runs / r.balls * 100; r.avg = r.outs ? r.runs / r.outs : null; r.econ = r.conceded / r.balls * 6; r.bavg = r.wickets ? r.conceded / r.wickets : null; r.dot_pct = r.dots / r.balls * 100; });
    } else {
      rows = src.filter((r) => String(r.season) === season);
    }
    rows = rows.filter((r) => r.balls >= minBalls);
    const cols = bat
      ? [['player', 'Player'], ['team', 'Team'], ['runs', 'Runs'], ['balls', 'Balls'], ['sr', 'SR'], ['avg', 'Avg'], ['sixes', '6s'], ['dot_pct', 'Dot %']]
      : [['player', 'Player'], ['team', 'Team'], ['wickets', 'Wkts'], ['balls', 'Balls'], ['econ', 'Econ'], ['bavg', 'Avg'], ['dot_pct', 'Dot %']];
    if (!sortKey || !cols.some((c) => c[0] === sortKey)) { sortKey = bat ? 'runs' : 'wickets'; sortDir = -1; }
    rows.sort((a, b) => {
      const x = a[sortKey]; const y = b[sortKey];
      if (typeof x === 'string') return sortDir * x.localeCompare(y);
      return sortDir * ((x == null ? -Infinity : x) - (y == null ? -Infinity : y));
    });
    rows = rows.slice(0, 50);
    const arrow = (k) => (k === sortKey ? (sortDir < 0 ? ' ↓' : ' ↑') : '');
    qs('t-leader').innerHTML = `<table class="data"><thead><tr><th>#</th>${cols.map(([k, l]) => `<th data-sort="${k}">${l}${arrow(k)}</th>`).join('')}</tr></thead><tbody>` +
      rows.map((r, i) => `<tr><td>${i + 1}</td>${cols.map(([k]) => {
        if (k === 'player') return `<td style="text-align:left"><a href="#" data-player="${esc(r.player)}">${esc(r.player)}</a></td>`;
        if (k === 'team') return `<td style="text-align:left">${esc(r.team)}</td>`;
        return `<td>${fmtNum(r[k], k === 'econ' ? 2 : undefined)}</td>`;
      }).join('')}</tr>`).join('') + '</tbody></table>';
    qs('t-leader').querySelectorAll('th[data-sort]').forEach((th) => th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'econ' || k === 'bavg' || (k === 'dot_pct' && bat) ? 1 : -1; }
      leaderboard();
    }));
    qs('t-leader').querySelectorAll('a[data-player]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      qs('player-input').value = a.dataset.player;
      refreshPlayers();
      qs('panel-players').scrollIntoView({ behavior: 'smooth' });
    }));
  }

  let cPA = null; let cPB = null;
  function initPlayers() {
    if (cPA) return;
    cPA = make('c-player-a', playerA);
    cPB = make('c-player-b', playerB);
    playerTable();
    leaderboard();
  }
  function refreshPlayers() { if (!cPA) return; rebuild(cPA, playerA); rebuild(cPB, playerB); playerTable(); }
  qs('player-input').addEventListener('change', refreshPlayers);
  qs('player-input').addEventListener('input', () => { if (names.includes(qs('player-input').value.trim())) refreshPlayers(); });
  qs('player-mode').addEventListener('change', () => {
    names = fillDatalist();
    if (!names.includes(qs('player-input').value.trim())) qs('player-input').value = mode() === 'bat' ? 'V Kohli' : 'JJ Bumrah';
    sortKey = null;
    refreshPlayers(); leaderboard();
  });
  ['lb-season', 'lb-min'].forEach((id) => qs(id).addEventListener('change', leaderboard));

  // Charts in hidden panels have no size, so build them when first shown.
  tabs.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tab === 'venues') initVenues();
    if (b.dataset.tab === 'players') initPlayers();
  }));
  if (savedTab && savedTab !== 'teams') {
    showTab(savedTab);
    if (savedTab === 'venues') initVenues();
    if (savedTab === 'players') initPlayers();
  }
})();
