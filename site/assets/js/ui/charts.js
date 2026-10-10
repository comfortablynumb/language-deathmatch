/* ECharts wrappers. Languages sit on a labelled category axis, so bars use one series hue;
   brand colors only appear as identity dots next to text labels. */

const active = new Set();

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function theme() {
  return {
    text: token('--ldm-text'), text2: token('--ldm-text-2'), muted: token('--ldm-muted'),
    grid: token('--ldm-grid'), axis: token('--ldm-axis'), series: token('--ldm-series'),
    seriesSoft: token('--ldm-series-soft'), surface: token('--ldm-surface'),
  };
}

function tooltipStyle(t) {
  return {
    backgroundColor: '#1a1e27', borderColor: '#262b36', borderWidth: 1, padding: [10, 12],
    textStyle: { color: t.text, fontSize: 12, fontFamily: 'Inter, sans-serif' },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);',
  };
}

function valueAxis(t, opts) {
  return {
    type: opts.log ? 'log' : 'value',
    logBase: opts.logBase || 10,
    axisLabel: { color: t.muted, formatter: opts.format, hideOverlap: true },
    splitLine: { lineStyle: { color: t.grid, width: 1 } },
    axisLine: { show: false },
  };
}

function categoryAxis(t, categories) {
  return {
    type: 'category', data: categories, inverse: true,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: t.axis } },
    axisLabel: { color: t.text2, fontSize: 13, margin: 12 },
  };
}

function init(element, option) {
  const chart = echarts.init(element, null, { renderer: 'canvas' });
  chart.setOption({ textStyle: { fontFamily: 'Inter, sans-serif' }, animationDuration: 500, ...option });
  active.add(chart);
  return chart;
}

function height(count) {
  return `${Math.max(140, count * 44 + 48)}px`;
}

/**
 * Horizontal ranked bars. opts: { categories, values, labels, tooltips, format, log }.
 * labels[i] is the text at the bar tip; tooltips[i] is HTML for the hover tooltip.
 */
export function barChart(element, opts) {
  const t = theme();
  element.style.height = height(opts.categories.length);

  return init(element, {
    grid: { left: 8, right: 96, top: 4, bottom: 4, containLabel: true },
    xAxis: valueAxis(t, opts),
    yAxis: categoryAxis(t, opts.categories),
    tooltip: { ...tooltipStyle(t), trigger: 'item', formatter: (p) => opts.tooltips[p.dataIndex] },
    series: [{
      type: 'bar', data: opts.values, barMaxWidth: 20,
      itemStyle: { color: t.series, borderRadius: [0, 4, 4, 0] },
      emphasis: { itemStyle: { color: t.series, shadowBlur: 12, shadowColor: t.seriesSoft } },
      label: { show: true, position: 'right', color: t.text2, fontSize: 12, formatter: (p) => opts.labels[p.dataIndex] },
    }],
  });
}

/**
 * Horizontal box plot plus the individual samples.
 * opts: { categories, boxes: [[min,q1,median,q3,max]], samples: [[v...]], tooltips, format, log }.
 */
export function boxPlot(element, opts) {
  const t = theme();
  element.style.height = height(opts.categories.length);
  const points = opts.samples.flatMap((values, row) => values.map((v) => [v, row]));

  return init(element, {
    grid: { left: 8, right: 24, top: 4, bottom: 4, containLabel: true },
    xAxis: valueAxis(t, opts),
    yAxis: categoryAxis(t, opts.categories),
    tooltip: { ...tooltipStyle(t), trigger: 'item', formatter: (p) => opts.tooltips[p.seriesIndex === 0 ? p.dataIndex : p.value[1]] },
    series: [
      {
        type: 'boxplot', data: opts.boxes, boxWidth: [6, 18],
        itemStyle: { color: t.seriesSoft, borderColor: t.series, borderWidth: 1.5 },
      },
      {
        type: 'scatter', data: points, symbolSize: 8, z: 3,
        itemStyle: { color: t.series, opacity: 0.35, borderColor: t.surface, borderWidth: 1 },
      },
    ],
  });
}

export function dispose(chart) {
  active.delete(chart);
  chart.dispose();
}

export function disposeAll() {
  active.forEach((chart) => chart.dispose());
  active.clear();
}

export function resizeAll() {
  active.forEach((chart) => chart.resize());
}

let resizeTimer = null;

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeAll, 120);
});
