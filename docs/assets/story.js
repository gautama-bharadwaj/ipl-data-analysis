(async function () {
  const { make, base, axisStyle, impactLine, tableView, fmtNum, load } = window.IPL;
  window.IPL.initThemeToggle();

  const D = await load(['meta', 'seasons', 'totals', 'phases', 'overs', 'changepoint', 'pitch', 'boundaries', 'mindset', 'impact']);
  const meta = D.meta;
  const S = D.seasons;
  const years = S.map((x) => String(x.season));
  const IMP = meta.impact_season;
  const bySeason = (arr, key) => arr.map((x) => x[key]);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

  // ---------- hero ----------
  document.getElementById('n-balls').textContent = meta.deliveries.toLocaleString();
  document.getElementById('n-matches').textContent = meta.matches.toLocaleString();
  document.getElementById('date-range').textContent = meta.first_date.slice(0, 4) + '–' + meta.last_date.slice(0, 4);
  const pre = S.filter((x) => x.season >= 2008 && x.season < IMP);
  const post = S.filter((x) => x.season >= IMP);
  const last = S[S.length - 1];
  const tiles = [
    { label: `Avg first-innings total, ${last.season}`, value: Math.round(last.avg_first_innings), unit: 'runs',
      delta: `<b>+${Math.round(last.avg_first_innings - mean(pre.map((x) => x.avg_first_innings)))}</b> vs the 2008–22 average` },
    { label: `First innings of 200+, ${last.season}`, value: Math.round(last.pct_200_plus) + '%', unit: '',
      delta: `was <b>${Math.round(mean(pre.map((x) => x.pct_200_plus)))}%</b> on average in 2008–22` },
    { label: `Sixes per match, ${last.season}`, value: last.sixes_per_match.toFixed(1), unit: '',
      delta: `was <b>${mean(pre.map((x) => x.sixes_per_match)).toFixed(1)}</b> in 2008–22` },
    { label: 'Season where the data breaks', value: D.changepoint.break_season, unit: '',
      delta: `run rate <b>${D.changepoint.rr_before}</b> → <b>${D.changepoint.rr_after}</b> per over` },
  ];
  document.getElementById('hero-tiles').innerHTML = tiles.map((t) =>
    `<div class="tile"><div class="label">${t.label}</div><div class="value">${t.value} <small>${t.unit}</small></div><div class="delta">${t.delta}</div></div>`).join('');

  const seasonAxis = (t) => axisStyle(t, { type: 'category', data: years, boundaryGap: false, axisLabel: { color: t.muted, fontSize: 11, interval: 'auto' }, splitLine: { show: false } });
  const valueAxis = (t, extra) => axisStyle(t, Object.assign({ type: 'value', scale: true, nameTextStyle: { color: t.muted, fontSize: 11, align: 'left' } }, extra || {}));
  const line = (name, data, color, extra) => Object.assign({
    name, type: 'line', data, symbol: 'circle', symbolSize: 6, showSymbol: false,
    lineStyle: { width: 2, color }, itemStyle: { color },
    emphasis: { focus: 'series' },
  }, extra || {});
  const endLabel = (t) => ({ show: true, formatter: '{a}', color: t.ink2, fontSize: 11, distance: 6 });

  // ---------- 1. the jump ----------
  make('c-first-innings', (t) => Object.assign(base(t), {
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'runs' }),
    series: [
      line('Average', bySeason(S, 'avg_first_innings').map((v) => +v.toFixed(1)), t.series[0], { markLine: impactLine(t, IMP), showSymbol: true }),
      line('Median', bySeason(S, 'median_first_innings'), t.series[1]),
    ],
  }));
  tableView('c-first-innings', ['Season', 'Average', 'Median', 'Highest total'], S.map((x) => [x.season, x.avg_first_innings, x.median_first_innings, x.highest_total]));

  make('c-200', (t) => Object.assign(base(t), {
    xAxis: Object.assign(seasonAxis(t), { boundaryGap: true }),
    yAxis: valueAxis(t, { scale: false, axisLabel: { color: t.muted, formatter: '{value}%' } }),
    series: [
      { name: '200+', type: 'bar', data: bySeason(S, 'pct_200_plus').map((v) => +v.toFixed(1)), itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] }, barGap: '10%', markLine: impactLine(t, IMP) },
      { name: '220+', type: 'bar', data: bySeason(S, 'pct_220_plus').map((v) => +v.toFixed(1)), itemStyle: { color: t.series[1], borderRadius: [4, 4, 0, 0] } },
    ],
    tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => v + '%' }),
  }));
  tableView('c-200', ['Season', '% 200+', '% 220+', '200+ totals (any innings)', '250+ totals'], S.map((x) => [x.season, x.pct_200_plus, x.pct_220_plus, x.count_200_plus, x.count_250_plus]));

  make('c-totals-box', (t) => Object.assign(base(t), {
    legend: { show: false },
    tooltip: Object.assign(base(t).tooltip, {
      trigger: 'item',
      formatter: (p) => {
        const b = D.totals.box[p.dataIndex];
        return `<b>${b.season}</b> (${b.n} innings)<br>95th pct: ${b.p95.toFixed(0)}<br>75th pct: ${b.p75.toFixed(0)}<br>Median: ${b.p50.toFixed(0)}<br>25th pct: ${b.p25.toFixed(0)}<br>5th pct: ${b.p5.toFixed(0)}`;
      },
    }),
    xAxis: Object.assign(seasonAxis(t), { boundaryGap: true }),
    yAxis: valueAxis(t, { name: 'runs' }),
    series: [{
      type: 'boxplot',
      data: D.totals.box.map((b) => [b.p5, b.p25, b.p50, b.p75, b.p95]),
      itemStyle: { color: t.seq[0], borderColor: t.series[0], borderWidth: 1.5 },
      boxWidth: ['40%', '70%'],
      markLine: impactLine(t, IMP),
    }],
  }));

  make('c-totals-hist', (t) => Object.assign(base(t), {
    xAxis: axisStyle(t, { type: 'category', data: D.totals.bins.map((b) => String(b)), name: 'total', boundaryGap: false, splitLine: { show: false } }),
    yAxis: valueAxis(t, { scale: false, axisLabel: { color: t.muted, formatter: '{value}%' } }),
    tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => v.toFixed(1) + '%', formatter: undefined }),
    series: D.totals.eras.map((e, i) => line(e, D.totals.hist[e], [t.seq[1], t.seq[2], t.seq[3], t.series[1]][i], {
      smooth: 0.3, areaStyle: i === 3 ? { color: t.series[1], opacity: 0.12 } : undefined,
    })),
  }));

  // ---------- 2. when ----------
  document.getElementById('break-season').textContent = D.changepoint.break_season;
  document.getElementById('rr-before').textContent = D.changepoint.rr_before.toFixed(1);
  document.getElementById('rr-after').textContent = D.changepoint.rr_after.toFixed(1);
  const cp = D.changepoint;
  make('c-rr-break', (t) => Object.assign(base(t), {
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'runs per over' }),
    series: [
      line('Run rate', cp.rr_by_season.map((x) => +x.rr.toFixed(2)), t.series[0], { showSymbol: true }),
      line('Best-fit level', cp.rr_by_season.map((x) => (x.season < cp.break_season ? cp.rr_before : cp.rr_after)), t.muted,
        { step: 'end', lineStyle: { width: 2, type: 'dashed', color: t.muted }, itemStyle: { color: t.muted } }),
    ],
  }));
  make('c-fit', (t) => Object.assign(base(t), {
    legend: { show: false },
    xAxis: axisStyle(t, { type: 'category', data: cp.scan.map((x) => String(x.season)), splitLine: { show: false } }),
    yAxis: valueAxis(t, { scale: false, axisLabel: { color: t.muted, formatter: '{value}%' } }),
    tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => v.toFixed(1) + '%' }),
    series: [{
      name: 'Fit improvement', type: 'bar',
      data: cp.scan.map((x) => ({ value: x.fit_gain, itemStyle: { color: x.season === cp.break_season ? t.series[0] : t.seq[1], borderRadius: [4, 4, 0, 0] } })),
      label: { show: true, position: 'top', color: t.ink2, fontSize: 10, formatter: (p) => (p.name === String(cp.break_season) ? 'best' : '') },
    }],
  }));

  // ---------- 3. where ----------
  const phases = ['Powerplay', 'Middle', 'Death'];
  make('c-phase', (t) => Object.assign(base(t), {
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'runs per over' }),
    series: phases.map((p, i) => line(p, D.phases.filter((x) => x.phase === p).map((x) => +x.run_rate.toFixed(2)), t.series[i],
      Object.assign({ endLabel: endLabel(t) }, i === 0 ? { markLine: impactLine(t, IMP) } : {}))),
    grid: { left: 8, right: 70, top: 60, bottom: 8, containLabel: true },
  }));
  tableView('c-phase', ['Season', 'Powerplay', 'Middle', 'Death'], years.map((y) => [y].concat(phases.map((p) => D.phases.find((x) => String(x.season) === y && x.phase === p).run_rate))), (v, i) => (i === 0 ? v : fmtNum(v, 2)));

  const eraColors = (t) => [t.seq[1], t.seq[2], t.seq[3], t.series[1]];
  make('c-overs-era', (t) => Object.assign(base(t), {
    xAxis: axisStyle(t, { type: 'category', data: Array.from({ length: 20 }, (_, i) => String(i + 1)), name: 'over', boundaryGap: false, splitLine: { show: false } }),
    yAxis: valueAxis(t, { name: 'runs per over' }),
    series: meta.eras.map((e, i) => line(e, D.overs.by_era.filter((x) => x.era === e).map((x) => +x.run_rate.toFixed(2)), eraColors(t)[i], { lineStyle: { width: i === 3 ? 3 : 2, color: eraColors(t)[i] } })),
  }));

  const heat = D.overs.by_season.map((x) => [x.over, years.indexOf(String(x.season)), +x.run_rate.toFixed(2)]);
  make('c-overs-heat', (t) => Object.assign(base(t), {
    legend: { show: false },
    grid: { left: 8, right: 16, top: 8, bottom: 56, containLabel: true },
    tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (p) => `<b>${years[p.value[1]]}</b>, over ${p.value[0] + 1}<br>${p.value[2].toFixed(2)} runs per over` }),
    xAxis: axisStyle(t, { type: 'category', data: Array.from({ length: 20 }, (_, i) => String(i + 1)), name: 'over', splitLine: { show: false } }),
    yAxis: axisStyle(t, { type: 'category', data: years, splitLine: { show: false } }),
    visualMap: { min: 5, max: 13, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 160,
      inRange: { color: t.seq }, textStyle: { color: t.ink2, fontSize: 11 }, text: ['13 rpo', '5 rpo'] },
    series: [{ type: 'heatmap', data: heat, itemStyle: { borderColor: t.surface, borderWidth: 1 }, emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } } }],
  }));

  make('c-sixes', (t) => Object.assign(base(t), {
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { scale: false, name: 'per match' }),
    series: [
      line('Fours', bySeason(S, 'fours_per_match').map((v) => +v.toFixed(1)), t.series[1]),
      line('Sixes', bySeason(S, 'sixes_per_match').map((v) => +v.toFixed(1)), t.series[0], { markLine: impactLine(t, IMP), showSymbol: true }),
    ],
  }));
  make('c-boundary-share', (t) => Object.assign(base(t), {
    legend: { show: false },
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { axisLabel: { color: t.muted, formatter: '{value}%' } }),
    tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => v + '%' }),
    series: [line('Runs from boundaries', bySeason(S, 'boundary_run_share').map((v) => +v.toFixed(1)), t.series[0], { showSymbol: true, markLine: impactLine(t, IMP), areaStyle: { color: t.series[0], opacity: 0.08 } })],
  }));

  // ---------- theory 1: pitches ----------
  const P = D.pitch;
  make('c-rpw', (t) => Object.assign(base(t), {
    legend: { show: false },
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'runs per wicket' }),
    series: [line('Runs per wicket', bySeason(S, 'runs_per_wicket').map((v) => +v.toFixed(2)), t.series[0], { showSymbol: true, markLine: impactLine(t, IMP) })],
  }));
  make('c-ppw', (t) => Object.assign(base(t), {
    legend: { show: false },
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { scale: false, max: 2.5, name: 'wickets in overs 1–6' }),
    series: [line('Powerplay wickets per innings', P.pp_wickets_per_innings.map((x) => +x.value.toFixed(2)), t.series[0], { showSymbol: true, markLine: impactLine(t, IMP) })],
  }));
  const sg = P.same_ground.slice().sort((a, b) => a.after - a.before - (b.after - b.before));
  const shortVenue = (v) => v.split(',')[0].replace(' Stadium', '').replace(' Intl', '');
  make('c-same-ground', (t) => Object.assign(base(t), {
    grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
    tooltip: Object.assign(base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps) => { const v = sg[ps[0].dataIndex]; return `<b>${v.venue}</b><br>2018–22: ${v.before} (${v.n_before} games)<br>2023–26: ${v.after} (${v.n_after} games)<br>Change: +${(v.after - v.before).toFixed(1)}`; } }),
    yAxis: axisStyle(t, { type: 'category', data: sg.map((v) => shortVenue(v.venue)), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11 } }),
    xAxis: valueAxis(t, { min: 140, name: 'runs' }),
    series: [
      { name: 'connector', type: 'custom', silent: true, tooltip: { show: false },
        renderItem: (params, api) => {
          const a = api.coord([api.value(0), params.dataIndex]);
          const b = api.coord([api.value(1), params.dataIndex]);
          return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: t.axis, lineWidth: 2 } };
        },
        data: sg.map((v) => [v.before, v.after]), encode: { x: [0, 1] } },
      { name: '2018–22', type: 'scatter', data: sg.map((v) => v.before), symbolSize: 11, itemStyle: { color: t.seq[1], borderColor: t.surface, borderWidth: 2 } },
      { name: '2023–26', type: 'scatter', data: sg.map((v) => v.after), symbolSize: 11, itemStyle: { color: t.series[1], borderColor: t.surface, borderWidth: 2 },
        label: { show: true, position: 'right', color: t.ink2, fontSize: 10, formatter: (p) => '+' + (sg[p.dataIndex].after - sg[p.dataIndex].before).toFixed(0) } },
    ],
    legend: { top: 0, left: 0, data: ['2018–22', '2023–26'], textStyle: { color: t.ink2, fontSize: 12 } },
  }));
  make('c-venue-adj', (t) => Object.assign(base(t), {
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'runs per over vs 2008' }),
    series: [
      line('Raw', P.venue_adjusted.map((x) => x.raw), t.seq[1]),
      line('Venue-adjusted', P.venue_adjusted.map((x) => x.adjusted), t.series[0], { showSymbol: true, markLine: impactLine(t, IMP) }),
    ],
  }));
  const vnames = [...new Set(P.venue_heat.map((x) => x.venue))].sort();
  make('c-venue-heat', (t) => Object.assign(base(t), {
    legend: { show: false },
    grid: { left: 8, right: 16, top: 8, bottom: 56, containLabel: true },
    tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (p) => `<b>${vnames[p.value[1]]}</b>, ${years[p.value[0]]}<br>${p.value[2].toFixed(2)} runs per over (${p.value[3]} innings)` }),
    xAxis: axisStyle(t, { type: 'category', data: years, splitLine: { show: false } }),
    yAxis: axisStyle(t, { type: 'category', data: vnames.map(shortVenue), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11 } }),
    visualMap: { min: 7, max: 10.5, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 160, inRange: { color: t.seq }, textStyle: { color: t.ink2, fontSize: 11 }, text: ['10.5 rpo', '7 rpo'], dimension: 2 },
    series: [{ type: 'heatmap', data: P.venue_heat.map((x) => [years.indexOf(String(x.season)), vnames.indexOf(x.venue), x.rr, x.n]), itemStyle: { borderColor: t.surface, borderWidth: 1 } }],
  }));

  // ---------- theory 2: boundaries ----------
  const VE = D.boundaries.venue_era_sixes;
  const vlist = [...new Set(VE.map((x) => x.venue))].sort((a, b) => {
    const g = (v) => (VE.find((x) => x.venue === v && x.era === '2023–26') || { sixes_per_match: 0 }).sixes_per_match;
    return g(a) - g(b);
  });
  make('c-venue-sixes', (t) => Object.assign(base(t), {
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    tooltip: Object.assign(base(t).tooltip, { axisPointer: { type: 'shadow' }, valueFormatter: (v) => (v == null ? '–' : v.toFixed(1)) }),
    yAxis: axisStyle(t, { type: 'category', data: vlist.map(shortVenue), splitLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11 } }),
    xAxis: valueAxis(t, { scale: false, name: 'sixes per match' }),
    series: meta.eras.map((e, i) => ({
      name: e, type: 'bar', barGap: '15%', barCategoryGap: '30%',
      data: vlist.map((v) => { const r = VE.find((x) => x.venue === v && x.era === e); return r ? +r.sixes_per_match.toFixed(1) : null; }),
      itemStyle: { color: eraColors(t)[i], borderRadius: [0, 3, 3, 0] },
    })),
  }));
  make('c-six-ratio', (t) => Object.assign(base(t), {
    legend: { show: false },
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'sixes per four' }),
    series: [line('Sixes per four', bySeason(S, 'six_four_ratio').map((v) => +v.toFixed(2)), t.series[0], { showSymbol: true, markLine: impactLine(t, IMP) })],
  }));
  make('c-balls-six', (t) => Object.assign(base(t), {
    legend: { show: false },
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'balls', inverse: false }),
    series: [line('Balls per six', bySeason(S, 'balls_per_six').map((v) => +v.toFixed(1)), t.series[1], { showSymbol: true })],
  }));

  // ---------- theory 3: mindset ----------
  const M = D.mindset;
  make('c-first10', (t) => Object.assign(base(t), {
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'strike rate' }),
    series: [
      line('After 20 balls (set)', M.settled_sr.map((x) => x.value), t.series[1], { endLabel: Object.assign(endLabel(t), { formatter: 'Set' }) }),
      line('First 10 balls', M.first10_sr.map((x) => x.value), t.series[0], { showSymbol: true, markLine: impactLine(t, IMP), endLabel: Object.assign(endLabel(t), { formatter: 'First 10' }) }),
    ],
    grid: { left: 8, right: 64, top: 60, bottom: 8, containLabel: true },
  }));
  tableView('c-first10', ['Season', 'SR first 10 balls', 'SR after 20 balls'], M.first10_sr.map((x, i) => [x.season, x.value, M.settled_sr[i].value]));
  make('c-sr150', (t) => Object.assign(base(t), {
    legend: { show: false },
    xAxis: Object.assign(seasonAxis(t), { boundaryGap: true }),
    yAxis: valueAxis(t, { scale: false, max: 100, axisLabel: { color: t.muted, formatter: '{value}%' } }),
    tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => v.toFixed(0) + '%' }),
    series: [{ name: 'SR 150+', type: 'bar', data: M.share_sr150.map((x) => ({ value: x.value, itemStyle: { color: x.season >= IMP ? t.series[0] : t.seq[1], borderRadius: [4, 4, 0, 0] } })), markLine: impactLine(t, IMP) }],
  }));
  const sd = M.sr_dist;
  make('c-sr-dist', (t) => Object.assign(base(t), {
    legend: { show: false },
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'strike rate' }),
    tooltip: Object.assign(base(t).tooltip, { formatter: (ps) => { const x = sd[ps[0].dataIndex]; return `<b>${x.season}</b><br>90th pct: ${x.p90}<br>75th pct: ${x.p75}<br>Median: ${x.p50}<br>25th pct: ${x.p25}<br>10th pct: ${x.p10}`; } }),
    series: [
      { name: 'p10', type: 'line', stack: 'outer', data: sd.map((x) => x.p10), lineStyle: { opacity: 0 }, symbol: 'none' },
      { name: 'p10–p90', type: 'line', stack: 'outer', data: sd.map((x) => x.p90 - x.p10), lineStyle: { opacity: 0 }, symbol: 'none', areaStyle: { color: t.series[0], opacity: 0.12 } },
      { name: 'p25', type: 'line', stack: 'inner', data: sd.map((x) => x.p25), lineStyle: { opacity: 0 }, symbol: 'none' },
      { name: 'p25–p75', type: 'line', stack: 'inner', data: sd.map((x) => x.p75 - x.p25), lineStyle: { opacity: 0 }, symbol: 'none', areaStyle: { color: t.series[0], opacity: 0.22 } },
      line('Median', sd.map((x) => x.p50), t.series[0], { showSymbol: true, markLine: impactLine(t, IMP) }),
    ],
  }));
  make('c-risk', (t) => Object.assign(base(t), {
    legend: { show: false },
    tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (p) => `<b>${p.data[2]}</b><br>Strike rate: ${p.data[0]}<br>Runs per wicket: ${p.data[1]}` }),
    xAxis: valueAxis(t, { name: 'strike rate', nameLocation: 'middle', nameGap: 24 }),
    yAxis: valueAxis(t, { name: 'runs per wicket' }),
    grid: { left: 8, right: 24, top: 36, bottom: 24, containLabel: true },
    series: [
      { type: 'line', data: M.risk_reward.map((x) => [x.sr, x.avg, x.season]), lineStyle: { color: t.axis, width: 1 }, symbol: 'none', silent: true, tooltip: { show: false } },
      { type: 'scatter', data: M.risk_reward.map((x) => [x.sr, x.avg, x.season]), symbolSize: 10,
        itemStyle: { color: (p) => (p.data[2] >= IMP ? t.series[1] : t.seq[2]), borderColor: t.surface, borderWidth: 2 },
        label: { show: true, formatter: (p) => ([2008, 2009, 2013, 2018, 2022, 2023, 2024, 2026].includes(p.data[2]) ? String(p.data[2]) : ''), position: 'right', color: t.ink2, fontSize: 10 } },
    ],
  }));

  // ---------- theory 4: impact player ----------
  const I = D.impact;
  const lowerIsBetter = new Set(['Dot-ball %']);
  document.getElementById('t-before-after').innerHTML = '<table class="data"><thead><tr><th>Measure</th><th>2020–22</th><th>2023–26</th><th>Change</th></tr></thead><tbody>' +
    I.before_after.map((r) => `<tr><td>${r.metric}</td><td>${r.before.toFixed(1)}</td><td>${r.after.toFixed(1)}</td><td class="${r.change_pct > 0 ? 'up' : 'down'}">${r.change_pct > 0 ? '+' : ''}${r.change_pct.toFixed(1)}%</td></tr>`).join('') + '</tbody></table>';

  const groups = ['Top order (1–3)', 'Middle order (4–7)', 'Lower order (8–11)'];
  make('c-pos-sr', (t) => Object.assign(base(t), {
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { name: 'strike rate' }),
    series: groups.map((g, i) => line(g, I.pos_sr.filter((x) => x.group === g).map((x) => x.value), t.series[i], i === 0 ? { showSymbol: true, markLine: impactLine(t, IMP) } : {})),
  }));
  tableView('c-pos-sr', ['Season'].concat(groups), years.map((y) => [y].concat(groups.map((g) => I.pos_sr.find((x) => String(x.season) === y && x.group === g).value))));

  const buckets = ['0–1 down', '2–3 down', '4–5 down', '6+ down'];
  make('c-wk-down', (t) => Object.assign(base(t), {
    tooltip: Object.assign(base(t).tooltip, { axisPointer: { type: 'shadow' }, valueFormatter: (v) => v.toFixed(2) + ' rpo' }),
    xAxis: axisStyle(t, { type: 'category', data: buckets, splitLine: { show: false } }),
    yAxis: valueAxis(t, { scale: false, min: 6, name: 'runs per over' }),
    series: meta.eras.map((e, i) => ({ name: e, type: 'bar', barGap: '10%',
      data: buckets.map((b) => (I.rr_by_wickets_down.find((x) => x.era === e && x.bucket === b) || {}).rr),
      itemStyle: { color: eraColors(t)[i], borderRadius: [4, 4, 0, 0] } })),
  }));
  make('c-depth', (t) => Object.assign(base(t), {
    xAxis: seasonAxis(t),
    yAxis: valueAxis(t, { scale: false, axisLabel: { color: t.muted, formatter: '{value}%' } }),
    tooltip: Object.assign(base(t).tooltip, { valueFormatter: (v) => v.toFixed(1) + '%' }),
    series: [
      line('No. 8 batted', I.depth.map((x) => x.no8_batted), t.series[0], { showSymbol: true, markLine: impactLine(t, IMP) }),
      line('All out', I.depth.map((x) => x.all_out), t.series[1], { showSymbol: true }),
    ],
  }));
  const roles = ['Batted only', 'Bowled only', 'Batted and bowled', 'Did neither'];
  const subYears = [...new Set(I.sub_roles.map((x) => x.season))].sort();
  make('c-sub-roles', (t) => Object.assign(base(t), {
    tooltip: Object.assign(base(t).tooltip, { axisPointer: { type: 'shadow' } }),
    xAxis: axisStyle(t, { type: 'category', data: subYears.map(String), splitLine: { show: false } }),
    yAxis: valueAxis(t, { scale: false, name: 'substitutes' }),
    series: roles.map((r, i) => ({ name: r, type: 'bar', stack: 'roles', barWidth: '50%',
      data: subYears.map((y) => (I.sub_roles.find((x) => x.season === y && x.role === r) || { count: 0 }).count),
      itemStyle: { color: [t.series[0], t.series[1], t.series[2], t.muted][i], borderColor: t.surface, borderWidth: 1 } })),
  }));
  make('c-chases', (t) => Object.assign(base(t), {
    tooltip: Object.assign(base(t).tooltip, { axisPointer: { type: 'shadow' } }),
    xAxis: Object.assign(seasonAxis(t), { boundaryGap: true }),
    yAxis: valueAxis(t, { scale: false, name: 'chases' }),
    series: [
      { name: 'Attempted', type: 'bar', data: bySeason(S, 'chases_200_attempted'), barGap: '-100%', itemStyle: { color: t.seq[0], borderRadius: [4, 4, 0, 0] }, markLine: impactLine(t, IMP) },
      { name: 'Won', type: 'bar', data: bySeason(S, 'chases_200_won'), itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] } },
    ],
  }));
  document.getElementById('t-top-subs').innerHTML = '<table class="data"><thead><tr><th>Player</th><th>Times used</th><th>Runs</th><th>Balls faced</th><th>Wickets</th></tr></thead><tbody>' +
    I.top_subs.map((r) => `<tr><td>${r.player_in}</td><td>${r.times}</td><td>${fmtNum(r.runs, 0)}</td><td>${fmtNum(r.balls, 0)}</td><td>${fmtNum(r.wk, 0)}</td></tr>`).join('') + '</tbody></table>';
})();
