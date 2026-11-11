// Shared chart helpers: theme tokens, ECharts defaults, table views.
(function () {
  const registry = [];

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function theme() {
    return {
      ink: cssVar('--ink'), ink2: cssVar('--ink-2'), muted: cssVar('--muted'),
      grid: cssVar('--grid'), axis: cssVar('--axis'), surface: cssVar('--surface'),
      accent: cssVar('--accent'),
      series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => cssVar('--s' + i)),
      seq: [0, 1, 2, 3, 4].map((i) => cssVar('--seq-' + i)),
      divMid: cssVar('--div-mid'), divNeg: cssVar('--div-neg'),
    };
  }

  function axisStyle(t, extra) {
    return Object.assign({
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: { color: t.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: t.grid } },
      nameTextStyle: { color: t.muted, fontSize: 11 },
    }, extra || {});
  }

  function base(t, extra) {
    return Object.assign({
      backgroundColor: 'transparent',
      textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: t.ink2 },
      grid: { left: 8, right: 16, top: 60, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: t.surface, borderColor: t.axis, borderWidth: 1,
        textStyle: { color: t.ink, fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: t.muted, type: 'dashed' } },
        confine: true,
      },
      legend: { top: 0, left: 0, textStyle: { color: t.ink2, fontSize: 12 }, icon: 'roundRect', itemWidth: 12, itemHeight: 4 },
      animationDuration: 600,
    }, extra || {});
  }

  // Vertical marker for the season the Impact Player rule arrived.
  function impactLine(t, season, label) {
    return {
      silent: true, symbol: 'none',
      lineStyle: { color: t.muted, type: 'dashed', width: 1 },
      label: { formatter: label || 'Impact Player', color: t.ink2, fontSize: 11, position: 'insideEndTop' },
      data: [{ xAxis: String(season) }],
    };
  }

  function make(el, build) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return null;
    const chart = echarts.init(el, null, { renderer: 'svg' });
    const entry = { el, chart, build };
    registry.push(entry);
    chart.setOption(build(theme()), true);
    return chart;
  }

  function rerender() {
    const t = theme();
    registry.forEach((e) => e.chart.setOption(e.build(t), true));
  }

  function rebuild(chart, build) {
    const e = registry.find((x) => x.chart === chart);
    if (e) { e.build = build; chart.setOption(build(theme()), true); }
  }

  window.addEventListener('resize', () => registry.forEach((e) => e.chart.resize()));
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender);
  }

  // Theme toggle (light / dark / follow system)
  function initThemeToggle() {
    const btn = document.querySelector('.theme-btn');
    if (!btn) return;
    let saved = null;
    try { saved = localStorage.getItem('ipl-theme'); } catch (e) { /* ignore */ }
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    const label = () => {
      const cur = document.documentElement.getAttribute('data-theme');
      btn.textContent = cur === 'dark' ? 'Dark' : cur === 'light' ? 'Light' : 'Auto';
    };
    label();
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'light' ? 'dark' : cur === 'dark' ? null : 'light';
      if (next) document.documentElement.setAttribute('data-theme', next);
      else document.documentElement.removeAttribute('data-theme');
      try { next ? localStorage.setItem('ipl-theme', next) : localStorage.removeItem('ipl-theme'); } catch (e) { /* ignore */ }
      label();
      rerender();
    });
  }

  // Collapsible table under a chart so every number is readable without color.
  function tableView(afterEl, columns, rows, fmt) {
    if (typeof afterEl === 'string') afterEl = document.getElementById(afterEl);
    if (!afterEl) return;
    const d = document.createElement('details');
    d.className = 'table-view';
    const head = columns.map((c) => `<th>${c}</th>`).join('');
    const body = rows.map((r) => '<tr>' + r.map((v, i) => `<td>${fmt ? fmt(v, i) : fmtNum(v)}</td>`).join('') + '</tr>').join('');
    d.innerHTML = `<summary>Show the numbers</summary><div class="table-scroll"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    afterEl.insertAdjacentElement('afterend', d);
  }

  function fmtNum(v, digits) {
    if (v === null || v === undefined || v === '') return '–';
    if (typeof v !== 'number') return v;
    if (Number.isInteger(v)) return v.toLocaleString();
    return v.toFixed(digits === undefined ? 1 : digits);
  }

  async function load(names) {
    const out = {};
    await Promise.all(names.map(async (n) => {
      const res = await fetch('data/' + n + '.json');
      out[n] = await res.json();
    }));
    return out;
  }

  window.IPL = { theme, base, axisStyle, impactLine, make, rebuild, rerender, tableView, fmtNum, load, initThemeToggle };
})();
