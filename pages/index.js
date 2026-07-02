import { useEffect, useRef, useState, useCallback, useMemo, Fragment } from 'react';
import { calculateQuantScore, buildReportData, fmtScore, EMPTY_METRICS, round3, METRIC_FIELD_META } from '../lib/quantScore';
import { formatKstEventDate, formatKstEventDateShort, formatKstTime, importanceStars, todayKstDateStr, addDaysKst, groupEventsByDate, eventDedupeKey } from '../lib/eventTimeline';
import { US_SECTORS, KR_SECTORS } from '../lib/sectorStocks';

const LOCAL_WL_KEY = 'stock_dash_extra_watchlist';

function readLocalWatchlist() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_WL_KEY) || '{}');
    return {
      kr: raw.kr || [],
      us: raw.us || [],
      hiddenKr: raw.hiddenKr || [],
      hiddenUs: raw.hiddenUs || [],
    };
  } catch {
    return { kr: [], us: [], hiddenKr: [], hiddenUs: [] };
  }
}

function saveLocalWatchlist(data) {
  localStorage.setItem(LOCAL_WL_KEY, JSON.stringify(data));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: data }));
  }
}

function buildStockApiUrl(localWl) {
  const wl = localWl || readLocalWatchlist();
  const params = new URLSearchParams();
  const extraKr = (wl.kr || []).map((x) => x.code).filter(Boolean);
  const extraUs = (wl.us || []).map((x) => x.sym).filter(Boolean);
  if (extraKr.length) params.set('extraKr', extraKr.join(','));
  if (extraUs.length) params.set('extraUs', extraUs.join(','));
  const qs = params.toString();
  return qs ? `/api/stock?${qs}` : '/api/stock';
}

function watchlistToSuggestions(kr, us) {
  const out = [];
  const seen = new Set();
  (kr || []).forEach((x) => {
    const dropdown = `kr:${x.code}`;
    if (seen.has(dropdown)) return;
    seen.add(dropdown);
    out.push({
      market: 'kr',
      code: x.code,
      label: x.label,
      display: `${x.label} (${x.code})`,
      dropdown,
    });
  });
  (us || []).forEach((x) => {
    const dropdown = `us:${x.sym}`;
    if (seen.has(dropdown)) return;
    seen.add(dropdown);
    out.push({
      market: 'us',
      sym: x.sym,
      label: x.label,
      display: `${x.label} (${x.sym})`,
      dropdown,
    });
  });
  return out;
}

function mergeSuggestions(primary, secondary) {
  const seen = new Set();
  const out = [];
  [...primary, ...secondary].forEach((s) => {
    if (!s?.dropdown || seen.has(s.dropdown)) return;
    seen.add(s.dropdown);
    out.push(s);
  });
  return out;
}

function filterHiddenWatchlist(items, hiddenSet, key) {
  return (items || []).filter((x) => !hiddenSet.has(x[key]));
}

function addToLocalWatchlist(local, entry) {
  const next = {
    kr: [...(local.kr || [])],
    us: [...(local.us || [])],
    hiddenKr: [...(local.hiddenKr || [])],
    hiddenUs: [...(local.hiddenUs || [])],
  };
  if (entry.market === 'kr') {
    next.hiddenKr = next.hiddenKr.filter((c) => c !== entry.code);
    if (!next.kr.some((x) => x.code === entry.code)) {
      next.kr.push({ code: entry.code, label: entry.label });
    }
  } else {
    next.hiddenUs = next.hiddenUs.filter((s) => s !== entry.sym);
    if (!next.us.some((x) => x.sym === entry.sym)) {
      next.us.push({ sym: entry.sym, label: entry.label });
    }
  }
  return next;
}

function removeFromLocalWatchlist(local, entry) {
  const next = {
    kr: [...(local.kr || [])],
    us: [...(local.us || [])],
    hiddenKr: [...(local.hiddenKr || [])],
    hiddenUs: [...(local.hiddenUs || [])],
  };
  if (entry.market === 'kr') {
    next.kr = next.kr.filter((x) => x.code !== entry.code);
    if (!next.hiddenKr.includes(entry.code)) next.hiddenKr.push(entry.code);
  } else {
    next.us = next.us.filter((x) => x.sym !== entry.sym);
    if (!next.hiddenUs.includes(entry.sym)) next.hiddenUs.push(entry.sym);
  }
  return next;
}

function mergeWatchlistByKey(base, extra, key) {
  const seen = new Set((base || []).map((x) => x[key]));
  return [...(base || []), ...(extra || []).filter((x) => !seen.has(x[key]))];
}

function enrichWatchlistPrices(items, heatMap, key, fallbackHeatMap) {
  return (items || []).map((item) => {
    const id = item[key];
    const heat = heatMap?.[id] ?? fallbackHeatMap?.[id];
    return {
      ...item,
      price: heat?.price ?? item.price ?? null,
      chg: heat?.chg ?? item.chg ?? null,
      session: heat?.session ?? item.session ?? null,
    };
  });
}

async function fetchQuickWatchlistQuotes(entries) {
  const us = (entries || []).filter((e) => e.market === 'us' && e.sym).map((e) => e.sym);
  const kr = (entries || []).filter((e) => e.market === 'kr' && e.code).map((e) => e.code);
  if (!us.length && !kr.length) return null;
  const params = new URLSearchParams({ quick: '1' });
  if (us.length) params.set('quoteUs', [...new Set(us)].join(','));
  if (kr.length) params.set('quoteKr', [...new Set(kr)].join(','));
  const r = await fetch(`/api/stock?${params.toString()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}

function mergeStockHeat(prev, patch) {
  if (!patch) return prev;
  return {
    ...prev,
    heatUS: { ...(prev?.heatUS ?? {}), ...(patch.heatUS ?? {}) },
    heatKR: { ...(prev?.heatKR ?? {}), ...(patch.heatKR ?? {}) },
    heatUSExtended: { ...(prev?.heatUSExtended ?? {}), ...(patch.heatUSExtended ?? {}) },
    heatKRExtended: { ...(prev?.heatKRExtended ?? {}), ...(patch.heatKRExtended ?? {}) },
  };
}

function watchlistBaseItems(items, key) {
  return (items || []).map((item) => ({
    [key]: item[key],
    label: item.label,
  }));
}

// ── 유틸 ──────────────────────────────────────────────
const fmtT = (v) => v == null ? '--' : `$${v.toFixed(3)}T`;

const UP = '#ff6b6b';
const DOWN = '#93c5fd';
const FLAT = '#94a3b8';

function ChangeLabel({ value, small=false }) {
  if (value == null) return <span style={{color:FLAT,fontSize:small?10:11}}>--</span>;
  const pos = value >= 0;
  return <span style={{color:pos?UP:DOWN,fontSize:small?10:11,fontFamily:'Pretendard',fontWeight:700}}>
    {pos?'▲ +':'▼ '}{Math.abs(value).toFixed(2)}%
  </span>;
}

function heatBg(chg) {
  if (chg == null) return '#1e293b';
  if (chg >= 2) return 'rgba(255,107,107,0.42)';
  if (chg >= 0.5) return 'rgba(255,107,107,0.28)';
  if (chg > 0) return 'rgba(255,107,107,0.16)';
  if (chg > -0.5) return 'rgba(147,197,253,0.16)';
  if (chg > -2) return 'rgba(147,197,253,0.28)';
  return 'rgba(147,197,253,0.42)';
}

// 차트/상세 페이지 링크 (티커 클릭 시)
const CHART = {
  yahoo: (sym) => `https://finance.yahoo.com/chart/${encodeURIComponent(sym)}`,
  naverIndex: (code) => `https://finance.naver.com/sise/sise_index.naver?code=${code}`,
  naverStock: (code) => `https://finance.naver.com/item/main.naver?code=${code}`,
  naverFx: () => 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW',
  naverWti: () => 'https://finance.naver.com/marketindex/materialDetail.naver?marketindexCd=CMDT_WTI',
  naverNightFut: () => 'https://m.stock.naver.com/domestic/index/FUT/total',
};

function TickerCard({ item, bare = false }) {
  const clickable = !!item.chartUrl;
  return (
    <div
      className={clickable && !bare ? 'ticker-card' : undefined}
      onClick={() => clickable && window.open(item.chartUrl, '_blank', 'noopener,noreferrer')}
      style={{
        display:'flex', flexDirection:'column', gap:2,
        cursor: clickable ? 'pointer' : 'default',
        justifyContent:'center',
      }}
    >
      <span style={{fontSize:10,fontWeight:700,color:item.labelColor ?? '#94a3b8',lineHeight:1.2}}>{item.label}</span>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:4, flexWrap:'wrap' }}>
        <span style={{fontSize:13,fontWeight:900,color:'#fff',fontFamily:'Pretendard',lineHeight:1.2,whiteSpace:'nowrap'}}>
          {item.val == null ? '--' : `${item.prefix ?? (item.krw ? '₩' : '')}${item.val.toLocaleString('ko-KR', { maximumFractionDigits: item.digits ?? 2 })}`}
        </span>
        <ChangeLabel value={item.chg} small />
      </div>
      {item.hint && item.val == null && <span style={{fontSize:8,color:'#64748b',lineHeight:1.2}}>{item.hint}</span>}
      {item.sourceLabel && <span style={{fontSize:8,color:'#475569',fontFamily:'Pretendard',lineHeight:1.2}}>{item.sourceLabel}</span>}
    </div>
  );
}

function fmtFlow(v) {
  if (v == null || !Number.isFinite(v)) return '--';
  const abs = Math.abs(v).toLocaleString('ko-KR');
  if (v > 0) return `+${abs}`;
  if (v < 0) return `-${abs}`;
  return '0';
}

/** 수급 패널 숫자 — 다크 배경 가독성 (하늘색 계열 마이너스 / 밝은 레드 플러스) */
const FLOW_VAL_UP = '#ff8080';
const FLOW_VAL_DOWN = '#bae6fd';

function flowColor(v) {
  if (v == null) return FLAT;
  if (v > 0) return FLOW_VAL_UP;
  if (v < 0) return FLOW_VAL_DOWN;
  return FLAT;
}

function symlog(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return 0;
  return Math.sign(v) * Math.log10(1 + Math.abs(v));
}

const FLOW_COL = { foreign: '#bae6fd', institution: '#fb923c', individual: '#fde68a' };
const FLOW_LEGEND = [
  { label: '외국인', color: FLOW_COL.foreign },
  { label: '기관', color: FLOW_COL.institution },
  { label: '개인', color: FLOW_COL.individual },
];

function FlowLegend() {
  return (
    <div className="flow-legend">
      {FLOW_LEGEND.map((item) => (
        <span key={item.label} className="flow-legend-item">
          <span className="flow-legend-swatch" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function symlogAxisRange(data, padRatio = 0.2) {
  const vals = data.filter((v) => v != null && Number.isFinite(v));
  if (!vals.length) return {};
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 0.5;
  const pad = span * padRatio;
  return { min: min - pad, max: max + pad };
}

function aggregateFlowByHour(history) {
  const buckets = new Map();
  for (const row of history) {
    const hour = `${row.time.slice(0, 2)}:00`;
    buckets.set(hour, { ...row, time: hour });
  }
  return [...buckets.values()].sort((a, b) => a.time.localeCompare(b.time));
}

function sliceFlowHistory(history, granularity) {
  const base = granularity === 'hour' ? aggregateFlowByHour(history) : history;
  const limit = granularity === 'hour' ? 8 : 60;
  return base.slice(-limit);
}

function InvestorFlowPanel({ title, flowData, chartUrl, chartId }) {
  const [granularity, setGranularity] = useState('minute');
  const latest = flowData?.latest;
  const history = flowData?.history ?? [];
  const displayHistory = useMemo(
    () => sliceFlowHistory(history, granularity),
    [history, granularity]
  );
  const recentRows = [...displayHistory].reverse().slice(0, 6);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!displayHistory.length) return undefined;
    let destroyed = false;

    const init = async () => {
      const ApexCharts = (await import('apexcharts')).default;
      if (destroyed) return;
      const el = document.getElementById(chartId);
      if (!el) return;

      if (chartRef.current) {
        try { chartRef.current.destroy(); } catch {}
        chartRef.current = null;
      }
      el.innerHTML = '';

      const categories = displayHistory.map((r) => r.time);
      const foreignData = displayHistory.map((r) => symlog(r.foreign));
      const institutionData = displayHistory.map((r) => symlog(r.institution));
      const individualData = displayHistory.map((r) => symlog(r.individual));

      const c = new ApexCharts(el, {
        chart: { type: 'line', height: 178, toolbar: { show: false }, background: 'transparent', animations: { enabled: false } },
        grid: { strokeDashArray: 3, borderColor: '#1e2d42', padding: { top: 6, bottom: 8, left: 4, right: 4 } },
        stroke: { curve: 'smooth', width: 2.5 },
        colors: [FLOW_COL.foreign, FLOW_COL.institution, FLOW_COL.individual],
        series: [
          { name: '외국인', data: foreignData },
          { name: '기관', data: institutionData },
          { name: '개인', data: individualData },
        ],
        xaxis: {
          categories,
          labels: { style: { colors: '#527193', fontFamily: 'Pretendard', fontSize: '8px' }, rotate: 0, hideOverlappingLabels: true },
          tickAmount: granularity === 'minute' ? 8 : 6,
          axisBorder: { show: false },
          axisTicks: { show: false },
          title: { text: 'KST', style: { color: '#475569', fontSize: '8px' } },
        },
        yaxis: [
          {
            seriesName: '외국인',
            ...symlogAxisRange(foreignData),
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
          },
          {
            seriesName: '기관',
            opposite: true,
            ...symlogAxisRange(institutionData),
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
          },
          {
            seriesName: '개인',
            opposite: true,
            ...symlogAxisRange(individualData),
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
          },
        ],
        legend: { show: false },
        dataLabels: { enabled: false },
        tooltip: {
          theme: 'dark',
          shared: true,
          intersect: false,
          y: {
            formatter: (_v, { seriesIndex, dataPointIndex }) => {
              const row = displayHistory[dataPointIndex];
              if (!row) return '--';
              const vals = [row.foreign, row.institution, row.individual];
              return `${fmtFlow(vals[seriesIndex])}억`;
            },
          },
        },
      });
      await c.render();
      chartRef.current = c;
    };

    init();
    return () => {
      destroyed = true;
      try { chartRef.current?.destroy(); } catch {}
      chartRef.current = null;
    };
  }, [chartId, displayHistory, granularity]);

  const summary = [
    { label: '외국인', val: latest?.foreign },
    { label: '기관', val: latest?.institution },
    { label: '개인', val: latest?.individual },
  ];

  const granBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={(e) => { e.stopPropagation(); setGranularity(id); }}
      style={{
        background: granularity === id ? '#2563eb' : '#1e293b',
        color: granularity === id ? '#fff' : '#94a3b8',
        border: '1px solid #334155',
        borderRadius: 6,
        padding: '3px 10px',
        fontSize: 10,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="ticker-card card flow-panel"
      onClick={() => window.open(chartUrl, '_blank', 'noopener,noreferrer')}
      style={{ cursor: 'pointer' }}
    >
      <div className="flow-panel-head">
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{title} 수급</span>
        <span className="flow-panel-time">
          {latest?.time ? `${latest.time} 기준 · 누적` : '장중 데이터 대기'}
        </span>
      </div>
      <div className="flow-summary">
        {summary.map((r) => (
          <div key={r.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>{r.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'Pretendard', color: flowColor(r.val) }}>
              {fmtFlow(r.val)}
            </div>
            <div style={{ fontSize: 8, color: '#475569' }}>억</div>
          </div>
        ))}
      </div>
      {history.length > 0 ? (
        <>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flow-toolbar"
          >
            <FlowLegend />
            <div className="flow-gran-btns">
              {granBtn('minute', '분')}
              {granBtn('hour', '시간')}
            </div>
          </div>
          <div
            id={chartId}
            className="flow-chart-wrap"
            onClick={(e) => e.stopPropagation()}
            style={{ marginBottom: 8 }}
          />
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
            {granularity === 'hour' ? '시간별' : '분별'} 누적 (억)
          </div>
          <div className="flow-table-wrap">
          <div className="flow-table">
            <span style={{ color: '#475569' }}>시간</span>
            <span style={{ color: FLOW_COL.foreign, textAlign: 'right' }}>외국인</span>
            <span style={{ color: FLOW_COL.institution, textAlign: 'right' }}>기관</span>
            <span style={{ color: FLOW_COL.individual, textAlign: 'right' }}>개인</span>
            {recentRows.map((row) => (
              <Fragment key={row.time}>
                <span style={{ color: '#94a3b8' }}>{row.time}</span>
                <span style={{ color: flowColor(row.foreign), textAlign: 'right', fontWeight: 700 }}>{fmtFlow(row.foreign)}</span>
                <span style={{ color: flowColor(row.institution), textAlign: 'right', fontWeight: 700 }}>{fmtFlow(row.institution)}</span>
                <span style={{ color: flowColor(row.individual), textAlign: 'right', fontWeight: 700 }}>{fmtFlow(row.individual)}</span>
              </Fragment>
            ))}
          </div>
          </div>
        </>
      ) : null}
      <span style={{ fontSize: 9, color: '#334155', marginTop: 8, display: 'block' }}>클릭 → 네이버 상세</span>
    </div>
  );
}

function kstDateKeyFromUnix(unixSec) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(unixSec * 1000));
}

function kst0900Unix(dateKey) {
  return Math.floor(new Date(`${dateKey}T09:00:00+09:00`).getTime() / 1000);
}

function intraday0900MarkerPct(points) {
  if (!points?.length || points.length < 2) return null;
  const target = kst0900Unix(todayKstDateStr());
  const first = points[0].t;
  const last = points[points.length - 1].t;
  if (target == null || first == null || last == null) return null;
  if (target < first - 120 || target > last + 120) return null;

  let idx = 0;
  let best = Infinity;
  points.forEach((p, i) => {
    if (p.t == null) return;
    const diff = Math.abs(p.t - target);
    if (diff < best) {
      best = diff;
      idx = i;
    }
  });
  return (idx / (points.length - 1)) * 100;
}

function MiniIntradayChart({ id, label, subLabel, val, points, chg, chartUrl, digits = 2, embedded = false, unified = false, isLast = false, showOpenMarker = true }) {
  const chartRef = useRef(null);
  const markerPct = showOpenMarker ? intraday0900MarkerPct(points) : null;
  const chartHeight = unified ? 138 : embedded ? 72 : 88;

  useEffect(() => {
    if (!points?.length) return undefined;
    let destroyed = false;

    const init = async () => {
      const ApexCharts = (await import('apexcharts')).default;
      if (destroyed) return;
      const el = document.getElementById(id);
      if (!el) return;

      if (chartRef.current) {
        try { chartRef.current.destroy(); } catch {}
        chartRef.current = null;
      }
      el.innerHTML = '';

      const color = (chg ?? 0) >= 0 ? UP : DOWN;
      const values = points.map((p) => p.v);
      const base = values[0];
      const seriesData = base
        ? values.map((v) => +(((v - base) / base) * 100).toFixed(4))
        : values;
      const c = new ApexCharts(el, {
        chart: { type: 'area', height: chartHeight, sparkline: { enabled: true }, animations: { enabled: false }, background: 'transparent' },
        stroke: { curve: 'smooth', width: 1.5 },
        colors: [color],
        fill: { type: 'gradient', gradient: { shadeIntensity: 0.35, opacityFrom: 0.45, opacityTo: 0.05 } },
        series: [{ data: seriesData }],
        tooltip: { enabled: false },
      });
      await c.render();
      chartRef.current = c;
    };

    init();
    return () => {
      destroyed = true;
      try { chartRef.current?.destroy(); } catch {}
      chartRef.current = null;
    };
  }, [id, points, chg, embedded, unified]);

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: unified ? 3 : 4 }}>
      {unified ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', lineHeight: 1.3 }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', fontFamily: 'Pretendard', lineHeight: 1.2 }}>
              {val == null ? '--' : val.toLocaleString('ko-KR', { maximumFractionDigits: digits })}
            </span>
            <ChangeLabel value={chg} small={unified} />
          </div>
          {subLabel && (
            <span style={{ fontSize: 8, color: '#475569', fontFamily: 'Pretendard', lineHeight: 1.2 }}>{subLabel}</span>
          )}
        </>
      ) : (
        <>
          <div>
            <span style={{ fontSize: embedded ? 10 : 11, fontWeight: 700, color: '#94a3b8', lineHeight: 1.3 }}>{label}</span>
            {subLabel && (
              <span style={{ display: 'block', fontSize: 8, color: '#475569', marginTop: 2, fontFamily: 'Pretendard' }}>{subLabel}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', fontFamily: 'Pretendard', lineHeight: 1.2 }}>
              {val == null ? '--' : val.toLocaleString('ko-KR', { maximumFractionDigits: digits })}
            </span>
            <ChangeLabel value={chg} small={unified} />
          </div>
        </>
      )}
      {points?.length ? (
        <div style={{ position: 'relative', marginTop: unified ? 0 : 2 }}>
          <div id={id} />
          {markerPct != null && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: `${markerPct}%`,
                top: 0,
                bottom: 12,
                width: 0,
                pointerEvents: 'none',
                borderLeft: '1px solid rgba(71, 85, 105, 0.45)',
              }}
            />
          )}
          {markerPct != null && (
            <span
              style={{
                position: 'absolute',
                left: `${markerPct}%`,
                bottom: 0,
                transform: 'translateX(-50%)',
                fontSize: 7,
                fontWeight: 600,
                color: '#475569',
                fontFamily: 'Pretendard',
                letterSpacing: '0.02em',
                lineHeight: 1,
                pointerEvents: 'none',
              }}
            >
              09:00
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 900, color: '#475569', fontFamily: 'Pretendard', marginTop: unified ? 8 : embedded ? 12 : 20, textAlign: 'center' }}>--</div>
      )}
      {!embedded && <span style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>클릭 → 차트</span>}
    </div>
  );

  if (embedded && unified) {
    return (
      <div
        onClick={() => window.open(chartUrl, '_blank', 'noopener,noreferrer')}
        style={{
          cursor: 'pointer',
          padding: '10px 14px 8px',
          borderRight: unified && !isLast ? '1px solid #1a2740' : undefined,
          minHeight: unified ? 176 : 132,
        }}
      >
        {inner}
      </div>
    );
  }

  if (embedded) {
    return (
      <div
        onClick={() => window.open(chartUrl, '_blank', 'noopener,noreferrer')}
        style={{ cursor: 'pointer', padding: '8px 6px', borderRadius: 8, border: '1px solid #14243b', background: '#081220' }}
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      className="ticker-card"
      onClick={() => window.open(chartUrl, '_blank', 'noopener,noreferrer')}
      style={{ cursor: 'pointer', minHeight: 118 }}
    >
      {inner}
    </div>
  );
}

function IntradayCluster({ stock: s }) {
  const charts = [
    {
      id: 'chart-kospi-intra',
      label: '코스피',
      subLabel: '당일 1분 · KST 09~15 · Yahoo',
      val: s.kospi,
      points: s.intraday?.kospi,
      chg: s.kospiChg,
      digits: 2,
      chartUrl: CHART.naverIndex('KOSPI'),
      showOpenMarker: true,
    },
    {
      id: 'chart-kosdaq-intra',
      label: '코스닥',
      subLabel: '당일 1분 · KST 09~15 · Yahoo',
      val: s.kosdaq,
      points: s.intraday?.kosdaq,
      chg: s.kosdaqChg,
      digits: 2,
      chartUrl: CHART.naverIndex('KOSDAQ'),
      showOpenMarker: true,
    },
    {
      id: 'chart-nq-fut-intra',
      label: '나스닥100 선물',
      subLabel: '24h · 2분봉 · KST 05:00~ · Yahoo NQ=F',
      val: s.nasdaqFut,
      points: s.intraday?.nasdaqFut,
      chg: s.nasdaqFutChg,
      digits: 1,
      chartUrl: CHART.yahoo('NQ=F'),
      showOpenMarker: true,
    },
  ];

  return (
    <div className="intraday-cluster card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.08em', textTransform: 'uppercase' }}>당일 분봉</span>
          <span style={{ display: 'block', fontSize: 8, color: '#475569', marginTop: 2, fontFamily: 'Pretendard' }}>
            KR 지수: 장중 1분 · NQ 선물: 24h (세션 기준 상이)
          </span>
        </div>
        <span style={{ fontSize: 9, color: '#475569' }}>클릭 → 차트</span>
      </div>
      <div
        className="intra-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          borderRadius: 8,
          border: '1px solid #1a2740',
          background: '#121a28',
          overflow: 'hidden',
        }}
      >
        {charts.map((c, i) => (
          <div key={c.id} style={{ minWidth: 0 }}>
            <MiniIntradayChart embedded unified isLast={i === charts.length - 1} {...c} />
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtExtendedSession(session) {
  if (!session) return null;
  const map = {
    PRE: 'Pre',
    POST: 'After',
    REGULAR: 'RTH',
    NXT: 'NXT',
    BEFORE_MARKET: '프리',
    AFTER_MARKET: '애프터',
  };
  return map[session] || session;
}

function WatchlistGrid({ items, onClick, onDelete, krw = false, showSession = false }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:6 }}>
      {items.map((item) => (
        <div key={item.code || item.sym} onClick={() => onClick(item)}
          style={{
            position: 'relative',
            background: heatBg(item.chg),
            border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:8,
            padding:'6px 7px',
            cursor:'pointer',
            minHeight:54,
            display:'flex',
            flexDirection:'column',
            justifyContent:'center',
            gap:3,
          }}
        >
          {onDelete && (
            <button
              type="button"
              title="관심종목에서 제거"
              onClick={(e) => { e.stopPropagation(); onDelete(item); }}
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 16,
                height: 16,
                padding: 0,
                border: 'none',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.45)',
                color: '#fca5a5',
                fontSize: 11,
                lineHeight: '16px',
                cursor: 'pointer',
                fontWeight: 900,
              }}
            >
              ×
            </button>
          )}
          <div style={{ fontSize:9, fontWeight:800, color:'#f8fafc', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {item.label}
            {showSession && item.session && (
              <span style={{ marginLeft: 3, fontSize: 7, fontWeight: 700, color: '#94a3b8' }}>
                {fmtExtendedSession(item.session)}
              </span>
            )}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:4 }}>
            <span style={{ fontSize:11, fontWeight:900, fontFamily:'Pretendard', color:'#fff', whiteSpace:'nowrap' }}>
              {item.price == null ? '--' : `${krw ? '₩' : '$'}${item.price.toLocaleString('ko-KR', { maximumFractionDigits: krw ? 0 : 2 })}`}
            </span>
            <span style={{ fontSize:9, fontWeight:800, fontFamily:'Pretendard', color: item.chg == null ? FLAT : (item.chg >= 0 ? UP : DOWN), flexShrink:0 }}>
              {item.chg == null ? '--' : `${item.chg >= 0 ? '+' : ''}${item.chg.toFixed(2)}%`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function sectorAvgChg(items) {
  const valid = items.filter((i) => i.chg != null && Number.isFinite(i.chg));
  if (!valid.length) return null;
  const totalMcap = valid.reduce((s, i) => s + (i.mcap || 1), 0);
  return valid.reduce((s, i) => s + i.chg * (i.mcap || 1), 0) / totalMcap;
}

function findSectorAvg(sectors, name) {
  const sec = sectors.find((s) => s.sector === name);
  return sec ? sectorAvgChg(sec.items) : null;
}

function fmtSectorPct(v) {
  if (v == null || !Number.isFinite(v)) return '--';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function sectorPctColor(v) {
  if (v == null) return FLAT;
  return v >= 0 ? UP : DOWN;
}

const SECTOR_COMPARE_PAIRS = [
  { label: '반도체', us: '반도체', kr: '반도체/전자', usRep: 'MU', krRep: '삼성전자' },
  { label: '자동차', us: '자동차', kr: '자동차', usRep: 'TSLA', krRep: '현대차' },
  { label: '방산', us: '방산', kr: '방산', usRep: 'LMT', krRep: '한화에어로' },
  { label: '2차전지/화학', us: '2차전지/화학', kr: '2차전지/화학', usRep: 'ALB', krRep: 'LG에너지솔루션' },
  { label: '에너지', us: '에너지', kr: '에너지/정유', usRep: 'XOM', krRep: '두산에너빌리티' },
  { label: '헬스케어', us: '헬스케어', kr: '바이오/제약', usRep: 'LLY', krRep: '삼바' },
  { label: '소재', us: '소재', kr: '철강/소재', usRep: 'FCX', krRep: 'POSCO홀딩스' },
  { label: '금융', us: '금융/은행', kr: '은행/지주', usRep: 'JPM', krRep: 'KB금융' },
  { label: '증권', us: '증권', kr: '증권', usRep: 'GS', krRep: '미래에셋증권' },
  { label: '소비재', us: '경기소비재', kr: '소비재', usRep: 'NKE', krRep: 'LG생활건강' },
  { label: '유통/필수', us: '필수소비재', kr: '유통', usRep: 'WMT', krRep: '이마트' },
  { label: '광통신', us: '광통신/미디어', kr: '광통신', usRep: 'VZ', krRep: 'SK텔레콤' },
];

const US_SECTOR_ONLY = [
  { sector: '빅테크/소프트웨어', rep: 'MSFT' },
  { sector: '산업/중공업', rep: 'CAT' },
  { sector: '유틸리티', rep: 'NEE' },
  { sector: '부동산(REIT)', rep: 'AMT' },
];
const KR_SECTOR_ONLY = [
  { sector: '인터넷/엔터', rep: 'NAVER' },
  { sector: '조선', rep: 'HD한국조선' },
];

function fmtSectorLabel(label, usRep, krRep) {
  if (usRep && krRep) return `${label} (${usRep}/${krRep})`;
  if (usRep) return `${label} (${usRep})`;
  if (krRep) return `${label} (${krRep})`;
  return label;
}

function SectorMiniRow({ sector, avg, rep }) {
  const barW = avg == null ? 0 : Math.min(100, Math.abs(avg) * 18);
  const label = rep ? `${sector} (${rep})` : sector;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', minHeight: 20 }}>
      <span style={{ flex: 1, fontSize: 9, fontWeight: 700, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ width: 36, height: 4, borderRadius: 2, background: '#1a2740', flexShrink: 0, overflow: 'hidden' }}>
        {barW > 0 && (
          <span style={{ display: 'block', height: '100%', width: `${barW}%`, borderRadius: 2, background: avg >= 0 ? UP : DOWN, opacity: 0.85 }} />
        )}
      </span>
      <span style={{ width: 46, textAlign: 'right', fontSize: 10, fontWeight: 800, fontFamily: 'Pretendard', color: sectorPctColor(avg), flexShrink: 0 }}>
        {fmtSectorPct(avg)}
      </span>
    </div>
  );
}

function SectorComparePanel({ usSectors, krSectors }) {
  const paired = SECTOR_COMPARE_PAIRS.map((p) => {
    const us = findSectorAvg(usSectors, p.us);
    const kr = findSectorAvg(krSectors, p.kr);
    return { label: p.label, usRep: p.usRep, krRep: p.krRep, us, kr, spread: us != null && kr != null ? us - kr : null };
  }).sort((a, b) => Math.abs(b.spread ?? 0) - Math.abs(a.spread ?? 0));

  const usExtra = US_SECTOR_ONLY.map(({ sector, rep }) => ({ sector, rep, avg: findSectorAvg(usSectors, sector) }))
    .filter((r) => r.avg != null)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  const krExtra = KR_SECTOR_ONLY.map(({ sector, rep }) => ({ sector, rep, avg: findSectorAvg(krSectors, sector) }))
    .filter((r) => r.avg != null)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ borderRadius: 8, border: '1px solid #1a2740', overflow: 'hidden', background: '#0a121f' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.75fr 0.75fr 0.75fr', gap: 4, padding: '5px 8px', background: '#121a28', borderBottom: '1px solid #1a2740' }}>
          <span style={{ fontSize: 8, fontWeight: 800, color: '#64748b' }}>섹터</span>
          <span style={{ fontSize: 8, fontWeight: 800, color: '#64748b', textAlign: 'right' }}>🇺🇸 US</span>
          <span style={{ fontSize: 8, fontWeight: 800, color: '#64748b', textAlign: 'right' }}>🇰🇷 KR</span>
          <span style={{ fontSize: 8, fontWeight: 800, color: '#64748b', textAlign: 'right' }}>괴리</span>
        </div>
        {paired.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 0.75fr 0.75fr 0.75fr',
              gap: 4,
              padding: '4px 8px',
              borderBottom: '1px solid rgba(26,39,64,0.6)',
              alignItems: 'center',
              background: row.spread != null ? heatBg(row.spread * 0.35) : 'transparent',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 800, color: '#e2e8f0' }}>{fmtSectorLabel(row.label, row.usRep, row.krRep)}</span>
            <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Pretendard', color: sectorPctColor(row.us), textAlign: 'right' }}>{fmtSectorPct(row.us)}</span>
            <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Pretendard', color: sectorPctColor(row.kr), textAlign: 'right' }}>{fmtSectorPct(row.kr)}</span>
            <span style={{ fontSize: 10, fontWeight: 900, fontFamily: 'Pretendard', color: sectorPctColor(row.spread), textAlign: 'right' }}>
              {row.spread == null ? '--' : `${row.spread >= 0 ? '+' : ''}${row.spread.toFixed(2)}%p`}
            </span>
          </div>
        ))}
      </div>

      {(usExtra.length > 0 || krExtra.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #1a2740', background: '#0a121f' }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: '#64748b', marginBottom: 4 }}>🇺🇸 미국 전용</div>
            {usExtra.map((r) => <SectorMiniRow key={r.sector} sector={r.sector} rep={r.rep} avg={r.avg} />)}
          </div>
          <div style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #1a2740', background: '#0a121f' }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: '#64748b', marginBottom: 4 }}>🇰🇷 한국 전용</div>
            {krExtra.map((r) => <SectorMiniRow key={r.sector} sector={r.sector} rep={r.rep} avg={r.avg} />)}
          </div>
        </div>
      )}
    </div>
  );
}

const QUANT_FIELDS = [
  'revenueYoY', 'revenueQoQ', 'revenueYoYQuarter', 'epsGrowthNextYear', 'opm', 'cashConversion', 'fPER', 'peg',
  'debtRatio', 'currentRatio', 'return3mo', 'sp500Return3mo', 'drawdownFrom52wHigh',
].map((key) => ({
  key,
  label: METRIC_FIELD_META[key]?.label || key,
  unit: METRIC_FIELD_META[key]?.unit || '',
  krOnly: ['revenueQoQ', 'revenueYoYQuarter'].includes(key),
  scoreHint: ['revenueYoY', 'revenueQoQ', 'revenueYoYQuarter'].includes(key) ? '가중' : null,
  step: key === 'fPER' || key === 'peg' ? 0.01 : key === 'currentRatio' ? 0.01 : 0.1,
}));

function parseMetricInput(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function metricsToForm(metrics) {
  const out = {};
  Object.keys(EMPTY_METRICS).forEach((k) => {
    if (k === 'maAligned') {
      out[k] = metrics[k] == null ? '' : metrics[k] ? '1' : '0';
    } else if (metrics[k] == null) {
      out[k] = '';
    } else if (k === 'peg') {
      out[k] = (Math.round(metrics[k] * 10) / 10).toFixed(1);
    } else {
      out[k] = String(round3(metrics[k]));
    }
  });
  return out;
}

function formToMetrics(form) {
  return {
    revenueYoY: parseMetricInput(form.revenueYoY),
    revenueQoQ: parseMetricInput(form.revenueQoQ),
    revenueYoYQuarter: parseMetricInput(form.revenueYoYQuarter),
    epsGrowthNextYear: parseMetricInput(form.epsGrowthNextYear),
    opm: parseMetricInput(form.opm),
    cashConversion: parseMetricInput(form.cashConversion),
    fPER: parseMetricInput(form.fPER),
    peg: parseMetricInput(form.peg),
    debtRatio: parseMetricInput(form.debtRatio),
    currentRatio: parseMetricInput(form.currentRatio),
    maAligned: form.maAligned === '' ? null : form.maAligned === '1',
    drawdownFrom52wHigh: parseMetricInput(form.drawdownFrom52wHigh),
    return3mo: parseMetricInput(form.return3mo),
    sp500Return3mo: parseMetricInput(form.sp500Return3mo),
  };
}

const SCORE_BOLD = { color: '#f8fafc', fontWeight: 800 };

function ScoreFrac({ score, max, excluded }) {
  if (excluded) return <strong style={SCORE_BOLD}>N/A</strong>;
  if (score == null) return <strong style={SCORE_BOLD}>N/A/{max}</strong>;
  return (
    <strong style={SCORE_BOLD}>
      {fmtScore(score)}/{max}
    </strong>
  );
}

function ScoreBar({ score, max = 100 }) {
  const pct = Math.max(0, Math.min(100, (Number(score) / max) * 100));
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
  return (
    <span
      title={`${fmtScore(score)}/${max} (${Math.round(pct)}%)`}
      style={{
        display: 'inline-block',
        width: 52,
        height: 12,
        background: '#1e293b',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid #334155',
        verticalAlign: 'middle',
      }}
    >
      <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: color }} />
    </span>
  );
}

function QuantReportView({ data }) {
  if (!data) return null;
  return (
    <div style={{
      background: '#070f18',
      border: '1px solid #1a2740',
      borderRadius: 8,
      padding: '12px 14px',
      fontSize: 11,
      lineHeight: 1.5,
      color: '#e2e8f0',
      fontFamily: 'Pretendard',
    }}>
      <div style={{ color: '#94a3b8' }}>━━━━━━━━━━━━</div>
      <div style={{ color: '#f1f5f9', fontWeight: 700 }}>💎 투자 등급 💎</div>
      <div style={{ color: '#94a3b8' }}>━━━━━━━━━━━━</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#f8fafc' }}>
          종합 <strong style={SCORE_BOLD}>{fmtScore(data.total)}점</strong> ({data.grade})
        </span>
        <ScoreBar score={data.total} max={100} />
      </div>
      <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>{data.adjustmentNote}</div>
      {data.derivativeMode && (
        <div style={{ color: '#bae6fd', fontSize: 10, marginBottom: 4 }}>
          ETF·레버리지 → 3M·SPY·이평 대체 채점
        </div>
      )}
      <div style={{ marginBottom: 8, color: '#cbd5e1', fontSize: 10 }}>
        {data.summary.map((s, i) => (
          <span key={s.label}>
            {i > 0 && ' · '}
            {s.label}{' '}
            {s.excluded ? (
              <strong style={SCORE_BOLD}>N/A</strong>
            ) : (
              <ScoreFrac score={s.score} max={s.max} />
            )}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 4, marginBottom: 6, color: '#bae6fd', fontWeight: 700, fontSize: 10 }}>■ 항목별 스코어링</div>
      {data.items.map((item) => (
        <div key={item.label} style={{ marginBottom: 8 }}>
          <div style={{ color: '#f1f5f9' }}>
            - {item.label}{' '}
            <ScoreFrac score={item.score} max={item.max} />
            {' '}
            <span style={{ color: '#94a3b8', fontSize: 9 }}>({item.criteria})</span>
          </div>
          <div style={{ paddingLeft: 2, fontSize: 10, lineHeight: 1.5, marginTop: 3 }}>
            <span style={{ color: '#e2e8f0' }}>{item.facts}</span>
            <span style={{ color: '#64748b', margin: '0 5px' }}>|</span>
            <span style={{ color: '#93c5fd' }}>{item.comment}</span>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 4, color: '#94a3b8' }}>📌 {data.stockName}</div>
    </div>
  );
}

const EVENT_PERIOD_OPTIONS = [
  { days: 14, label: '2주' },
  { days: 7, label: '1주' },
  { days: 35, label: '한달' },
];

const EVENT_VISIBLE_CAP = 5;

function EventRow({ ev }) {
  const isMacro = ev.category === '매크로';
  const isKr = ev.category === '국내이슈';
  const noteShort = ev.note ? (ev.note.length > 28 ? `${ev.note.slice(0, 28)}…` : ev.note) : '';
  return (
    <div
      title={[ev.title, ev.note].filter(Boolean).join(' · ')}
      style={{
        display: 'grid',
        gridTemplateColumns: '42px 1fr auto',
        gap: '2px 5px',
        alignItems: 'center',
        padding: '3px 0',
        borderBottom: '1px solid rgba(15,23,42,0.8)',
        lineHeight: 1.25,
      }}
    >
      <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'Pretendard' }}>
        {(ev.timeKst || '—').slice(0, 5)}
      </span>
      <span style={{
        fontSize: 9,
        color: '#e2e8f0',
        fontWeight: 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {ev.title}
      </span>
      <span style={{ fontSize: 7, lineHeight: 1 }}>{importanceStars(ev.importance)}</span>
      {noteShort && (
        <span style={{
          gridColumn: '2 / 4',
          fontSize: 7,
          color: isMacro ? '#64748b' : isKr ? '#ca8a04' : '#7c6f9a',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {noteShort}
        </span>
      )}
    </div>
  );
}

function EventDayCard({ day }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = day.events.length > EVENT_VISIBLE_CAP;
  const visible = expanded ? day.events : day.events.slice(0, EVENT_VISIBLE_CAP);

  return (
    <div style={{
      background: day.isToday ? 'rgba(37,99,235,0.05)' : '#0a121f',
      border: day.isToday ? '1px solid rgba(37,99,235,0.55)' : '1px solid #1a2740',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 72,
    }}>
      <div style={{
        padding: '5px 7px',
        borderBottom: day.events.length ? '1px solid #1a2740' : undefined,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: day.isToday ? 'rgba(37,99,235,0.08)' : 'transparent',
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          color: day.isToday ? '#60a5fa' : '#94a3b8',
          fontFamily: 'Pretendard',
        }}>
          {formatKstEventDateShort(day.date)}
        </span>
        {day.events.length > 0 && (
          <span style={{
            fontSize: 7,
            color: day.isToday ? '#93c5fd' : '#64748b',
            background: '#111827',
            borderRadius: 999,
            padding: '0 5px',
          }}>
            {day.events.length}
          </span>
        )}
      </div>
      <div style={{ padding: '3px 6px 5px', flex: 1 }}>
        {day.events.length === 0 ? (
          <span style={{ fontSize: 8, color: '#334155' }}>—</span>
        ) : (
          <>
            {visible.map((ev) => (
              <EventRow key={eventDedupeKey(ev)} ev={ev} />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                style={{
                  marginTop: 3,
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: 8,
                  cursor: 'pointer',
                  padding: '2px 0',
                  fontFamily: 'Pretendard',
                }}
              >
                {expanded ? '접기' : `+${day.events.length - EVENT_VISIBLE_CAP} 더보기`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EventTimelinePanel() {
  const [events, setEvents] = useState([]);
  const [viewRange, setViewRange] = useState(null);
  const [periodDays, setPeriodDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async (days, refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const q = refresh ? `&refresh=1` : '';
      const r = await fetch(`/api/events?days=${days}${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '일정 조회 실패');
      setEvents(d.events || []);
      setViewRange(d.viewRange || d.range || null);
    } catch (e) {
      setError(e.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(periodDays); }, [periodDays, loadEvents]);

  const rangeStart = viewRange?.start || todayKstDateStr();
  const rangeEnd = viewRange?.end || addDaysKst(todayKstDateStr(), periodDays - 1);
  const periodLabel = EVENT_PERIOD_OPTIONS.find((x) => x.days === periodDays)?.label || `${periodDays}일`;
  const calendarDaysWithEvents = useMemo(
    () => groupEventsByDate(events, rangeStart, periodDays).filter((d) => d.events.length > 0),
    [events, rangeStart, periodDays],
  );
  const totalEvents = events.length;

  return (
    <div className="card" style={{ marginBottom: 24, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>
          📅 주요 이벤트 · {periodLabel} 캘린더
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            style={{ background: '#0a121f', border: '1px solid #1a2740', borderRadius: 6, padding: '4px 8px', fontSize: 10, color: '#e2e8f0', fontFamily: 'Pretendard' }}
          >
            {EVENT_PERIOD_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>{opt.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 10, color: '#475569', fontFamily: 'Pretendard' }}>
            KST · {formatKstEventDate(rangeStart)} ~ {formatKstEventDate(rangeEnd)}
            {totalEvents > 0 && ` · ${totalEvents}건`}
          </span>
          <button type="button" onClick={() => loadEvents(periodDays, true)} disabled={loading} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '3px 8px', fontSize: 9, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? '…' : '새로고침'}
          </button>
        </div>
      </div>
      {error && <div style={{ fontSize: 10, color: '#f87171', marginBottom: 8 }}>{error}</div>}
      {loading && !events.length ? (
        <div style={{ fontSize: 11, color: '#64748b' }}>일정 불러오는 중…</div>
      ) : totalEvents === 0 ? (
        <div style={{ fontSize: 11, color: '#64748b' }}>선택 기간 내 예정된 이벤트가 없습니다.</div>
      ) : (
        <div
          className="event-calendar-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
            gap: 6,
          }}
        >
          {calendarDaysWithEvents.map((day) => (
            <EventDayCard key={day.date} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuantScorePanel({ watchlistKr, watchlistUs, onWatchlistChange }) {
  const [dropdown, setDropdown] = useState('');
  const [query, setQuery] = useState('');
  const [pickedDropdown, setPickedDropdown] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(metricsToForm(EMPTY_METRICS));
  const [stockLabel, setStockLabel] = useState('');
  const [resolvedMeta, setResolvedMeta] = useState(null);
  const [sources, setSources] = useState([]);
  const [metricSources, setMetricSources] = useState({});
  const [metricPeriods, setMetricPeriods] = useState({});
  const [market, setMarket] = useState('us');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [addingWl, setAddingWl] = useState(false);
  const [removingWl, setRemovingWl] = useState(false);
  const lastFetchedKey = useRef('');
  const searchWrapRef = useRef(null);

  const symKey = pickedDropdown || dropdown || query.trim();

  const resetScoreView = useCallback(() => {
    setExpanded(false);
    setReportData(null);
    setResolvedMeta(null);
    setSources([]);
    setMetricPeriods({});
    setStockLabel('');
    lastFetchedKey.current = '';
  }, []);

  const loadSuggestions = useCallback(async (q) => {
    const trimmed = (q || '').trim();
    try {
      const body = {
        q: trimmed,
        limit: trimmed ? 24 : 40,
        all: !trimmed,
        extraKr: watchlistKr.map((x) => ({ code: x.code, label: x.label })),
        extraUs: watchlistUs.map((x) => ({ sym: x.sym, label: x.label })),
      };
      const r = await fetch('/api/symbol-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setSuggestions(d.suggestions || []);
    } catch {
      setSuggestions(trimmed ? [] : watchlistToSuggestions(watchlistKr, watchlistUs));
    }
  }, [watchlistKr, watchlistUs]);

  useEffect(() => {
    if (dropdown) {
      setSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      if (!showSuggest && !query.trim()) return;
      loadSuggestions(query);
    }, query.trim() ? 200 : 0);
    return () => clearTimeout(timer);
  }, [query, dropdown, showSuggest, loadSuggestions]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pickSuggestion = (s) => {
    resetScoreView();
    setDropdown(s.dropdown);
    setPickedDropdown(s.dropdown);
    setQuery(s.display);
    setShowSuggest(false);
    setError('');
  };

  const onSearchFocus = () => {
    if (dropdown) return;
    setShowSuggest(true);
    loadSuggestions(query);
  };

  const runScore = useCallback((label, metrics, meta = {}) => {
    const result = calculateQuantScore(metrics, {
      market: meta.market || market,
      metricSources: meta.metricSources || metricSources,
      stockName: label || meta.stockName,
    });
    setReportData(buildReportData(label || '종목', result));
  }, [market, metricSources]);

  const onScore = useCallback(async () => {
    setError('');
    if (!symKey && !stockLabel) {
      setError('종목을 선택하거나 입력해주세요.');
      return;
    }

    if (symKey && symKey !== lastFetchedKey.current) {
      setLoading(true);
      try {
        const r = await fetch('/api/quant-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, dropdown: pickedDropdown || dropdown || undefined }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || '조회 실패');
        lastFetchedKey.current = symKey;
        setForm(metricsToForm(d.metrics));
        setStockLabel(d.resolved?.label || query);
        setResolvedMeta(d.resolved || null);
        setSources(d.sources || []);
        setMetricSources(d.metricSources || {});
        setMetricPeriods(d.metricPeriods || {});
        setMarket(d.resolved?.market || 'us');
        setExpanded(true);
        runScore(d.resolved?.label || query, d.metrics, { market: d.resolved?.market, metricSources: d.metricSources });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    runScore(stockLabel || query, formToMetrics(form));
    setExpanded(true);
  }, [symKey, stockLabel, query, pickedDropdown, dropdown, form, runScore]);

  const onAddWatchlist = useCallback(async () => {
    if (!resolvedMeta) return;
    setAdminMsg('');
    if (!adminPin.trim()) {
      setAdminMsg('관리자 PIN을 입력하세요.');
      return;
    }
    setAddingWl(true);
    try {
      const body = resolvedMeta.market === 'kr'
        ? { adminPin, market: 'kr', code: resolvedMeta.code, label: resolvedMeta.label }
        : { adminPin, market: 'us', sym: resolvedMeta.sym, label: resolvedMeta.label };
      const r = await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '추가 실패');

      const local = addToLocalWatchlist(readLocalWatchlist(), {
        market: resolvedMeta.market,
        code: resolvedMeta.code,
        sym: resolvedMeta.sym,
        label: resolvedMeta.label,
      });
      saveLocalWatchlist(local);
      onWatchlistChange?.(local, [{
        market: resolvedMeta.market,
        code: resolvedMeta.code,
        sym: resolvedMeta.sym,
      }]);
      setAdminMsg(d.added === false ? d.message || '이미 등록됨' : '관심종목에 추가했습니다.');
    } catch (e) {
      setAdminMsg(e.message);
    } finally {
      setAddingWl(false);
    }
  }, [resolvedMeta, adminPin, onWatchlistChange]);

  const onRemoveWatchlist = useCallback(async () => {
    if (!resolvedMeta) return;
    setAdminMsg('');
    if (!adminPin.trim()) {
      setAdminMsg('관리자 PIN을 입력하세요.');
      return;
    }
    setRemovingWl(true);
    try {
      const body = resolvedMeta.market === 'kr'
        ? { action: 'remove', adminPin, market: 'kr', code: resolvedMeta.code }
        : { action: 'remove', adminPin, market: 'us', sym: resolvedMeta.sym };
      const r = await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '삭제 실패');

      const local = removeFromLocalWatchlist(readLocalWatchlist(), {
        market: resolvedMeta.market,
        code: resolvedMeta.code,
        sym: resolvedMeta.sym,
      });
      saveLocalWatchlist(local);
      onWatchlistChange?.(local);
      setAdminMsg('관심종목에서 제거했습니다.');
    } catch (e) {
      setAdminMsg(e.message);
    } finally {
      setRemovingWl(false);
    }
  }, [resolvedMeta, adminPin, onWatchlistChange]);

  const onField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const inputStyle = {
    width: '100%',
    background: '#0a121f',
    border: '1px solid #1a2740',
    borderRadius: 6,
    padding: '5px 7px',
    fontSize: 11,
    color: '#e2e8f0',
    fontFamily: 'Pretendard',
  };

  return (
    <div className="card" style={{ marginBottom: 24, padding: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <select
          value={dropdown}
          onChange={(e) => {
            resetScoreView();
            setPickedDropdown('');
            setDropdown(e.target.value);
            setQuery('');
            setShowSuggest(false);
          }}
          style={{ ...inputStyle, width: 'auto', minWidth: 180, flex: '1 1 180px' }}
        >
          <option value="">관심종목 선택…</option>
          <optgroup label="🇰🇷 국내">
            {watchlistKr.map((x) => (
              <option key={x.code} value={`kr:${x.code}`}>{x.label} ({x.code})</option>
            ))}
          </optgroup>
          <optgroup label="🇺🇸 미국">
            {watchlistUs.map((x) => (
              <option key={x.sym} value={`us:${x.sym}`}>{x.label} ({x.sym})</option>
            ))}
          </optgroup>
        </select>
        <div ref={searchWrapRef} style={{ position: 'relative', flex: '2 1 200px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              resetScoreView();
              setPickedDropdown('');
              setQuery(e.target.value);
              setDropdown('');
              setShowSuggest(true);
            }}
            onFocus={onSearchFocus}
            placeholder="티커 · 6자리코드 · 한글종목명 (LG…)"
            style={{ ...inputStyle, width: '100%' }}
          />
          {showSuggest && suggestions.length > 0 && !dropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
              background: '#0a121f', border: '1px solid #334155', borderRadius: 8, maxHeight: 260, overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}>
              {!query.trim() && (
                <div style={{ padding: '6px 10px', fontSize: 9, color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                  관심종목 · 인기종목 · 입력 시 필터
                </div>
              )}
              {suggestions.map((s) => (
                <button
                  key={s.dropdown}
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'transparent', border: 'none', borderBottom: '1px solid #1e293b',
                    color: '#e2e8f0', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  <span style={{ color: '#64748b', marginRight: 6, fontSize: 10 }}>{s.market === 'kr' ? '🇰🇷' : '🇺🇸'}</span>
                  <span style={{ fontWeight: 700 }}>{s.label}</span>
                  <span style={{ color: '#64748b', marginLeft: 6 }}>{s.market === 'kr' ? s.code : s.sym}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onScore} disabled={loading} style={{ background: loading ? '#1e3a5f' : '#0f766e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 11, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? '산출 중…' : '점수 산출'}
        </button>
      </div>

      {error && <div style={{ fontSize: 10, color: '#f87171', marginBottom: 8 }}>{error}</div>}

      {expanded && (
        <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
        {QUANT_FIELDS.filter((f) => !f.krOnly || market === 'kr').map((f) => (
          <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>
              {f.label}{f.unit ? ` (${f.unit})` : ''}
              {metricPeriods[f.key] && (
                <span style={{ marginLeft: 4, color: '#38bdf8', fontWeight: 600 }}>{metricPeriods[f.key]}</span>
              )}
              {f.scoreHint && market === 'kr' && (
                <span style={{ marginLeft: 4, color: '#64748b', fontWeight: 500 }}>{f.scoreHint}</span>
              )}
            </span>
            <input
              type="number"
              step={f.step}
              value={form[f.key]}
              onChange={(e) => onField(f.key, e.target.value)}
              style={inputStyle}
            />
          </label>
        ))}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>이평 정배열</span>
          <select value={form.maAligned} onChange={(e) => onField('maAligned', e.target.value)} style={inputStyle}>
            <option value="">N/A</option>
            <option value="1">충족</option>
            <option value="0">미충족</option>
          </select>
        </label>
      </div>

      {reportData && <QuantReportView data={reportData} />}

      {resolvedMeta && reportData && (
        <div style={{ marginTop: 10, padding: 10, background: '#0a121f', border: '1px solid #1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>관리자 · 관심종목 추가/삭제 (PIN 필요)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="관리자 PIN"
              style={{ ...inputStyle, width: 120 }}
            />
            <button
              type="button"
              onClick={onAddWatchlist}
              disabled={addingWl || removingWl}
              style={{ background: '#1e3a5f', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 12px', fontSize: 10, fontWeight: 700, cursor: addingWl ? 'wait' : 'pointer' }}
            >
              {addingWl ? '추가 중…' : `⭐ ${resolvedMeta.label} 관심종목 추가`}
            </button>
            <button
              type="button"
              onClick={onRemoveWatchlist}
              disabled={addingWl || removingWl}
              style={{ background: '#3f1d1d', color: '#fecaca', border: '1px solid #7f1d1d', borderRadius: 8, padding: '7px 12px', fontSize: 10, fontWeight: 700, cursor: removingWl ? 'wait' : 'pointer' }}
            >
              {removingWl ? '삭제 중…' : `🗑 ${resolvedMeta.label} 관심종목 제거`}
            </button>
          </div>
          {adminMsg && <div style={{ fontSize: 10, color: adminMsg.includes('추가') || adminMsg.includes('제거') ? '#34d399' : '#f87171', marginTop: 6 }}>{adminMsg}</div>}
        </div>
      )}
        </>
      )}
    </div>
  );
}

const NEWS_CAT_ORDER = ['us', 'kr', 'macro', 'economy', 'fx'];
const NEWS_CAT_COLOR = { us:'#8b5cf6', kr:'#ef4444', macro:'#38bdf8', economy:'#f59e0b', fx:'#2dd4bf' };

const CHART_DESC = {
  net:{color:'#00e87a',label:'실질 가용 순유동성',    desc:'Fed자산 − TGA − RRP. 시중에 실제로 풀린 돈의 양. 수치가 늘어날수록 주식·코인 등 위험자산에 우호적인 환경.'},
  fed:{color:'#ff4a5a',label:'Fed 총자산',desc:'연준이 보유한 국채·MBS 총합. 늘어나면(양적완화) 유동성 공급↑, 줄어들면(양적긴축) 유동성 회수.'},
  tga:{color:'#2563eb',label:'TGA 재무부 잔고',  desc:'정부의 "통장 잔고". 잔고가 줄면 정부가 돈을 풀고 있다는 뜻(유동성↑), 늘면 세금 등으로 돈을 거둬들이는 중(유동성↓).'},
  rrp:{color:'#a855f7',label:'RRP 역레포 잔고',      desc:'MMF(머니마켓펀드)가 연준에 단기로 맡겨둔 돈. 잔고가 줄면 그 돈이 시중으로 흘러나와 유동성을 보충.'},
};

function formatChartDate(dateStr, period) {
  if (!dateStr) return '';
  if (period === 'month') return dateStr.slice(0, 7);
  return dateStr.slice(5);
}

const LIQ_PERIOD_DELTA_LABEL = { day: '전일', week: '전주', month: '전월' };

function calcSeriesChange(seriesData) {
  if (!Array.isArray(seriesData) || seriesData.length < 2) return null;
  const cur = seriesData.at(-1)?.y;
  const prev = seriesData.at(-2)?.y;
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  const abs = +(cur - prev).toFixed(3);
  const pct = prev !== 0 ? +((abs / prev) * 100).toFixed(2) : null;
  return { abs, pct, cur, prev };
}

function formatLiqDelta(change, period = 'week') {
  if (!change) return null;
  const label = LIQ_PERIOD_DELTA_LABEL[period] ?? '전기';
  const color = change.abs >= 0 ? '#00e87a' : '#ff6b6b';
  const absStr = `${change.abs >= 0 ? '+' : '-'}$${Math.abs(change.abs).toFixed(3)}T`;
  const pctStr = change.pct != null ? ` (${change.pct >= 0 ? '+' : ''}${change.pct.toFixed(2)}%)` : '';
  return { label, text: `${label} ${change.abs >= 0 ? '▲' : '▼'} ${absStr}${pctStr}`, color };
}

function buildApexConfig(color, seriesData, name, period = 'week') {
  return {
    chart:{type:'area',height:130,toolbar:{show:false},background:'transparent',animations:{enabled:false},sparkline:{enabled:false}},
    grid:{strokeDashArray:4,borderColor:'#14243b',padding:{top:4,bottom:4,left:8,right:12}},
    stroke:{curve:'smooth',width:2},
    colors:[color],
    fill:{type:'gradient',gradient:{shade:'dark',type:'vertical',shadeIntensity:0.35,gradientToColors:['transparent'],stops:[0,100]}},
    series:[{name,data:seriesData.map((d) => d.y)}],
    xaxis:{categories:seriesData.map((d) => formatChartDate(d.x, period)),labels:{style:{colors:'#527193',fontFamily:'Pretendard',fontSize:'8px'},rotate:0,hideOverlappingLabels:true},tickAmount:4,axisBorder:{show:false},axisTicks:{show:false}},
    yaxis:{labels:{style:{colors:'#527193',fontFamily:'Pretendard',fontSize:'9px'},formatter:(v) => `$${v.toFixed(2)}T`}},
    theme:{mode:'dark'},
    tooltip:{theme:'dark',x:{show:true},y:{formatter:(v) => `$${v.toFixed(3)}T`}},
    dataLabels:{enabled:false},
  };
}

export default function Dashboard() {
  const [stock, setStock] = useState({});
  const [heatUS, setHeatUS] = useState({});
  const [heatKR, setHeatKR] = useState({});
  const [liquidity, setLiquidity] = useState({});
  const [news, setNews] = useState({ headlines: {}, categories: {} });
  const [liqPeriod, setLiqPeriod] = useState('week');
  const [syncTime, setSyncTime] = useState('대기 중...');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const chartsRef = useRef({});
  const chartsInitRef = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const [localWatchlist, setLocalWatchlist] = useState({ kr: [], us: [], hiddenKr: [], hiddenUs: [] });
  const [wlAdminPin, setWlAdminPin] = useState('');
  const [wlAdminMsg, setWlAdminMsg] = useState('');
  const [watchlistSession, setWatchlistSession] = useState('extended');
  const sessionAutoRef = useRef(false);
  useEffect(() => {
    if (sessionAutoRef.current) return;
    const us = Object.values(stock.heatUSExtended || {});
    if (!us.length) return;
    const live = us.some((v) => v?.session === 'PRE' || v?.session === 'POST');
    if (live) setWatchlistSession('extended');
    sessionAutoRef.current = true;
  }, [stock.heatUSExtended]);
  useEffect(() => {
    if (!mounted) return;
    setLocalWatchlist(readLocalWatchlist());
  }, [mounted]);

  const displayWatchlistKr = useMemo(() => {
    const hidden = new Set(localWatchlist.hiddenKr || []);
    const wlSource = watchlistSession === 'extended' ? stock.watchlistExtended?.kr : stock.watchlist?.kr;
    const base = watchlistBaseItems(filterHiddenWatchlist(wlSource ?? stock.watchlist?.kr, hidden, 'code'), 'code');
    const merged = mergeWatchlistByKey(base, localWatchlist.kr, 'code');
    const heat = watchlistSession === 'extended' ? stock.heatKRExtended : stock.heatKR;
    const fallback = watchlistSession === 'extended' ? stock.heatKR : null;
    return enrichWatchlistPrices(merged, heat, 'code', fallback);
  }, [stock.watchlist?.kr, stock.watchlistExtended?.kr, stock.heatKR, stock.heatKRExtended, localWatchlist.kr, localWatchlist.hiddenKr, watchlistSession]);
  const displayWatchlistUs = useMemo(() => {
    const hidden = new Set(localWatchlist.hiddenUs || []);
    const wlSource = watchlistSession === 'extended' ? stock.watchlistExtended?.us : stock.watchlist?.us;
    const base = watchlistBaseItems(filterHiddenWatchlist(wlSource ?? stock.watchlist?.us, hidden, 'sym'), 'sym');
    const merged = mergeWatchlistByKey(base, localWatchlist.us, 'sym');
    const heat = watchlistSession === 'extended' ? stock.heatUSExtended : stock.heatUS;
    const fallback = watchlistSession === 'extended' ? stock.heatUS : null;
    return enrichWatchlistPrices(merged, heat, 'sym', fallback);
  }, [stock.watchlist?.us, stock.watchlistExtended?.us, stock.heatUS, stock.heatUSExtended, localWatchlist.us, localWatchlist.hiddenUs, watchlistSession]);

  const quantWatchlistKr = displayWatchlistKr;
  const quantWatchlistUs = displayWatchlistUs;

  const fetchNews = useCallback(async (marketSnap) => {
    try {
      const market = {
        nasdaqChg: marketSnap?.nasdaqChg,
        sp500Chg: marketSnap?.sp500Chg,
        soxChg: marketSnap?.soxChg,
        nvdaChg: marketSnap?.nvdaChg,
        kospiChg: marketSnap?.kospiChg,
        kosdaqChg: marketSnap?.kosdaqChg,
        kospi200Chg: marketSnap?.kospi200Chg,
        kosdaq150Chg: marketSnap?.kosdaq150Chg,
        samsungChg: marketSnap?.samsungChg,
        hynixChg: marketSnap?.hynixChg,
        vixChg: marketSnap?.vixChg,
        wtiChg: marketSnap?.wtiChg,
        usdkrwChg: marketSnap?.usdkrwChg,
      };
      const r = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ market }),
      });
      if (!r.ok) throw new Error(`news ${r.status}`);
      setNews(await r.json());
    } catch {
      setNews((prev) => ({ ...prev, error: true }));
    }
  }, []);

  const fetchStockAndHeatmap = useCallback(async (localWl) => {
    try {
      const base = buildStockApiUrl(localWl);
      const sep = base.includes('?') ? '&' : '?';
      const r = await fetch(`${base}${sep}_t=${Date.now()}`, { cache: 'no-store' });
      const d = await r.json();
      setStock(d);
      const usMap = {};
      Object.entries(d.heatUS ?? {}).forEach(([sym, v]) => { usMap[sym] = v?.chg ?? null; });
      setHeatUS(usMap);
      const krMap = {};
      Object.entries(d.heatKR ?? {}).forEach(([code, v]) => { krMap[code] = v?.chg ?? null; });
      setHeatKR(krMap);
      return d;
    } catch { return {}; }
  }, []);

  const refreshWatchlistQuotes = useCallback(async (local, entries) => {
    setLocalWatchlist(local);
    const quick = await fetchQuickWatchlistQuotes(entries);
    if (quick) {
      setStock((prev) => mergeStockHeat(prev, quick));
    }
    return fetchStockAndHeatmap(local);
  }, [fetchStockAndHeatmap]);

  const handleWatchlistChange = useCallback((local, entries) => {
    refreshWatchlistQuotes(local, entries);
  }, [refreshWatchlistQuotes]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onWlUpdate = (e) => {
      const next = e.detail || readLocalWatchlist();
      refreshWatchlistQuotes(next);
    };
    window.addEventListener('watchlist-updated', onWlUpdate);
    return () => window.removeEventListener('watchlist-updated', onWlUpdate);
  }, [mounted, refreshWatchlistQuotes]);

  const removeWatchlistItem = useCallback(async (item, market) => {
    setWlAdminMsg('');
    if (!wlAdminPin.trim()) {
      setWlAdminMsg('관리자 PIN을 입력하세요.');
      return;
    }
    try {
      const body = market === 'kr'
        ? { action: 'remove', adminPin: wlAdminPin, market: 'kr', code: item.code }
        : { action: 'remove', adminPin: wlAdminPin, market: 'us', sym: item.sym };
      const r = await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '삭제 실패');
      const local = removeFromLocalWatchlist(readLocalWatchlist(), {
        market,
        code: item.code,
        sym: item.sym,
      });
      saveLocalWatchlist(local);
      handleWatchlistChange(local);
      setWlAdminMsg(`${item.label} 제거 완료`);
    } catch (e) {
      setWlAdminMsg(e.message);
    }
  }, [wlAdminPin, handleWatchlistChange]);

  const fetchLiquidity = useCallback(async (period = liqPeriod) => {
    try {
      const r = await fetch(`/api/liquidity?period=${period}`);
      setLiquidity(await r.json());
    } catch {}
  }, [liqPeriod]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setSyncTime('동기화 중...');
    const stockData = await fetchStockAndHeatmap(readLocalWatchlist());
    await Promise.all([fetchLiquidity(), fetchNews(stockData)]);
    setSyncTime(new Date().toLocaleTimeString('ko-KR'));
    setLoading(false);
  }, [fetchStockAndHeatmap, fetchLiquidity, fetchNews]);

  useEffect(() => { if (mounted) fetchAll(); }, [mounted, fetchAll]);

  useEffect(() => {
    if (!mounted) return;
    const timer = setInterval(async () => {
      const stockData = await fetchStockAndHeatmap(readLocalWatchlist());
      fetchNews(stockData);
    }, 60000);
    return () => clearInterval(timer);
  }, [mounted, fetchStockAndHeatmap, fetchNews]);

  useEffect(() => {
    if (!mounted || !liquidity?.series) return;
    let destroyed = false;

    const init = async () => {
      const ApexCharts = (await import('apexcharts')).default;
      if (destroyed) return;
      const { series } = liquidity;
      const period = liquidity.period ?? liqPeriod;

      for (const key of ['net', 'fed', 'tga', 'rrp']) {
        const existing = chartsRef.current[key];
        if (existing) {
          try { existing.destroy(); } catch {}
          chartsRef.current[key] = null;
        }
        const el = document.getElementById(`chart-${key}`);
        if (!el) continue;
        el.innerHTML = '';
        const meta = CHART_DESC[key];
        try {
          const c = new ApexCharts(el, buildApexConfig(meta.color, series[key] ?? [], meta.label, period));
          await c.render();
          chartsRef.current[key] = c;
        } catch {}
      }
      chartsInitRef.current = true;
    };

    init();
    return () => { destroyed = true; };
  }, [mounted, liquidity, liqPeriod]);

  const handleLiqPeriod = async (period) => {
    setLiqPeriod(period);
    chartsInitRef.current = false;
    await fetchLiquidity(period);
  };

  const cur = liquidity?.current ?? {};
  const s = stock;
  const flowBizdate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');

  const marketTickers = [
    { label:'나스닥100 (QQQ)', val:s.nasdaq, chg:s.nasdaqChg, chartUrl: CHART.yahoo('QQQ') },
    { label:'S&P 500 (SPY)', val:s.sp500, chg:s.sp500Chg, chartUrl: CHART.yahoo('SPY') },
    { label:'필라델피아 반도체', val:s.sox, chg:s.soxChg, chartUrl: CHART.yahoo('SOXX') },
    { label:'CBOE VIX (공포지수)', val:s.vix, chg:s.vixChg, digits:2, prefix:'', labelColor:'#fb923c', chartUrl: CHART.yahoo('%5EVIX') },
    { label:'국제유가 WTI', val:s.wti, chg:s.wtiChg, digits:2, prefix:'$', labelColor:'#f59e0b', chartUrl: CHART.yahoo('CL=F') },
    { label:'원/달러 환율', val:s.usdkrw, chg:s.usdkrwChg, digits:1, prefix:'₩', labelColor:'#2dd4bf', chartUrl: CHART.naverFx() },
  ];

  // 트리맵용 데이터 가공
  const usSectorsWithChg = US_SECTORS.map(sec => ({
    sector: sec.sector,
    items: sec.items.map(item => ({ ...item, chg: heatUS[item.sym] ?? null })),
  }));
  const krSectorsWithChg = KR_SECTORS.map(sec => ({
    sector: sec.sector,
    items: sec.items.map(item => ({ ...item, sym: item.code, chg: heatKR[item.code] ?? null })),
  }));

  if (!mounted) return null;

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#070f18;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:400;color:#cbd5e1}
        .card{background:#0f1929;border:1px solid #243044;border-radius:12px;padding:14px}
        .pulse{animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .apexcharts-tooltip{background:#111e31!important;border:1px solid #1e3656!important;color:#fff!important}
        .grid4{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
        .ticker-board{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:10px}
        .intraday-cluster{margin-bottom:10px}
        @media(max-width:1100px){
          .grid4{grid-template-columns:repeat(4,1fr)!important}
          .ticker-board{grid-template-columns:repeat(4,1fr)}
          .event-calendar-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))!important}
        }
        @media(max-width:640px){.grid4{grid-template-columns:repeat(2,1fr)!important}.ticker-board{grid-template-columns:repeat(2,1fr)}.intra-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.grid2{grid-template-columns:1fr!important}.liq4{grid-template-columns:1fr!important}.heatmap-row{grid-template-columns:1fr!important}.news-grid{grid-template-columns:1fr!important}.event-calendar-grid{grid-template-columns:1fr!important}.flow-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.flow-panel{padding:8px 6px!important}.flow-legend{gap:6px}.flow-legend-item{font-size:8px}.flow-legend-swatch{width:12px;height:2px}.flow-toolbar{padding:5px 6px!important;gap:4px}.flow-panel-head{margin-bottom:6px}.flow-panel-time{font-size:8px}.flow-summary{gap:4px;margin-bottom:8px}.flow-table{font-size:9px;grid-template-columns:36px minmax(44px,1fr) minmax(44px,1fr) minmax(44px,1fr)}.flow-gran-btns button{padding:2px 6px!important;font-size:9px!important}.dash{padding:8px 8px 72px}}
        .dash{width:100%;max-width:1440px;margin:0 auto;padding:10px 14px 72px}
        .heatmap-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .news-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
        .headline-card{display:block;text-decoration:none;color:inherit;transition:transform .15s,border-color .15s}
        .headline-card:hover{border-color:rgba(59,130,246,0.45)!important;transform:translateY(-1px)}
        .ticker-card{background:#0f1929;border:1px solid #243044;border-radius:8px;padding:7px 9px;transition:border-color .15s,transform .15s}
        .flow-chart-wrap{background:#121a28;border:1px solid #1a2740;border-radius:8px;padding:2px 0 0;overflow:hidden}
        .flow-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:24px}
        .flow-panel{min-width:0;padding:10px 12px!important}
        .flow-panel-head{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:nowrap}
        .flow-panel-time{font-size:9px;color:#475569;font-family:Pretendard;white-space:nowrap;flex-shrink:0}
        .flow-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:10px}
        .flow-toolbar{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;padding:6px 8px;border-radius:8px;background:#121a28;border:1px solid #1a2740;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .flow-legend{display:flex;gap:10px;align-items:center;flex-wrap:nowrap;flex-shrink:0}
        .flow-legend-item{display:inline-flex;align-items:center;gap:5px;font-size:9px;color:#94a3b8;line-height:1;white-space:nowrap}
        .flow-legend-swatch{display:inline-block;width:16px;height:3px;border-radius:1px;flex-shrink:0}
        .flow-gran-btns{display:flex;gap:4px;align-items:center;flex-shrink:0;margin-left:auto}
        .flow-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .flow-table{display:grid;grid-template-columns:42px minmax(52px,1fr) minmax(52px,1fr) minmax(52px,1fr);gap:2px 6px;font-size:10px;font-family:Pretendard;min-width:100%}
        .ticker-card:hover{border-color:rgba(59,130,246,0.45);transform:translateY(-1px)}
        @media(max-width:1100px){.news-grid{grid-template-columns:repeat(3,1fr)}.heatmap-row{grid-template-columns:1fr}}
        @media(max-width:720px){.news-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <div className="dash" ref={containerRef}>

        {/* 헤더 */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #1e293b',paddingBottom:20,marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:18,fontWeight:900,color:'#fff',display:'flex',alignItems:'center',gap:8}}>
              <span style={{color:'#3b82f6'}}>Greg_Jeon</span>
              <span style={{color:'#475569',fontWeight:400}}>|</span>
              📊 Macro & Stock Live Dashboard
            </h1>
            <p style={{fontSize:11,color:'#64748b',marginTop:4,fontFamily:'Pretendard'}}>
              최종 동기화: <span style={{color:UP,fontWeight:700}}>{syncTime}</span>
              <span style={{marginLeft:8,color:'#475569'}}>· 시세 60초 자동갱신 · FRED 1시간 캐시</span>
            </p>
          </div>
          <button onClick={fetchAll} disabled={loading} style={{background:loading?'#1e3a5f':'#2563eb',color:'#fff',border:'none',borderRadius:8,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:loading?'wait':'pointer',display:'flex',alignItems:'center',gap:4}}>
            <span style={loading?{display:'inline-block',animation:'spin 1s linear infinite'}:{}}>↻</span>
            Update
          </button>
        </div>

        <IntradayCluster stock={s} />
        <div className="flow-row">
          <InvestorFlowPanel
            title="코스피"
            flowData={s.investorFlow?.kospi}
            chartId="flow-chart-kospi"
            chartUrl={`https://finance.naver.com/sise/investorDealTrendTime.naver?sosok=01&bizdate=${flowBizdate}`}
          />
          <InvestorFlowPanel
            title="코스닥"
            flowData={s.investorFlow?.kosdaq}
            chartId="flow-chart-kosdaq"
            chartUrl={`https://finance.naver.com/sise/investorDealTrendTime.naver?sosok=02&bizdate=${flowBizdate}`}
          />
        </div>

        {/* ── 관심종목 (목록: pages/api/stock.js WATCHLIST_KR / WATCHLIST_US) ── */}
        <div style={{marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>⭐ 관심종목</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', background: '#0a121f', border: '1px solid #1a2740', borderRadius: 8, padding: 2 }}>
              {[
                { id: 'regular', label: '정규장' },
                { id: 'extended', label: '비정규장' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWatchlistSession(opt.id)}
                  style={{
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: watchlistSession === opt.id ? (opt.id === 'extended' ? '#1e3a5f' : '#14532d') : 'transparent',
                    color: watchlistSession === opt.id ? '#f8fafc' : '#64748b',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span style={{fontSize:10,color:'#475569',fontFamily:'Pretendard'}}>
              {watchlistSession === 'extended' ? 'NXT·프리/애프터 · US Pre/Post' : 'KRX · US Regular'}
            </span>
          </div>
        </div>
        <div className="card" style={{marginBottom:24,padding:12}}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input
              type="password"
              value={wlAdminPin}
              onChange={(e) => setWlAdminPin(e.target.value)}
              placeholder="관리자 PIN (삭제)"
              style={{ width: 120, background: '#0a121f', border: '1px solid #1a2740', borderRadius: 6, padding: '5px 7px', fontSize: 11, color: '#e2e8f0', fontFamily: 'Pretendard' }}
            />
            <span style={{ fontSize: 9, color: '#64748b' }}>PIN 입력 후 × 클릭으로 관심종목 제거</span>
            {wlAdminMsg && (
              <span style={{ fontSize: 9, color: wlAdminMsg.includes('완료') || wlAdminMsg.includes('제거') ? '#34d399' : '#f87171' }}>{wlAdminMsg}</span>
            )}
          </div>
          <div style={{fontSize:10,fontWeight:800,color:'#ef4444',marginBottom:8}}>🇰🇷 국내</div>
          <WatchlistGrid items={displayWatchlistKr} krw showSession={watchlistSession === 'extended'}
            onDelete={wlAdminPin.trim() ? (item) => removeWatchlistItem(item, 'kr') : undefined}
            onClick={(t) => window.open(`https://finance.naver.com/item/main.naver?code=${t.code}`, '_blank')} />
          <div style={{fontSize:10,fontWeight:800,color:'#8b5cf6',margin:'14px 0 8px'}}>🇺🇸 미국</div>
          <WatchlistGrid items={displayWatchlistUs} showSession={watchlistSession === 'extended'}
            onDelete={wlAdminPin.trim() ? (item) => removeWatchlistItem(item, 'us') : undefined}
            onClick={(t) => window.open(`https://finance.yahoo.com/quote/${t.sym}`, '_blank')} />
        </div>

        {/* ── 퀀트 스코어 ── */}
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>📊 QUANT SCORE · 퀀트 스코어</h3>
          <span style={{ fontSize: 10, color: '#475569', fontFamily: 'Pretendard' }}>B방식 · 자동로드 + 수정 · 100점 만점</span>
        </div>
        <QuantScorePanel
          watchlistKr={quantWatchlistKr}
          watchlistUs={quantWatchlistUs}
          onWatchlistChange={handleWatchlistChange}
        />

        {/* LIVE MARKET TICKER — 실시간 헤드라인 바로 위 */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,marginTop:8}}>
          <h2 style={{fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:'0.1em',textTransform:'uppercase',margin:0}}>🌐 LIVE MARKET TICKER</h2>
          <span style={{fontSize:10,color:'#475569',fontFamily:'Pretendard'}}>클릭 → 차트 · 미국: Yahoo · 한국: 네이버</span>
        </div>
        <div className="ticker-board">
          {marketTickers.map((item, i) => (
            <TickerCard key={i} item={item} />
          ))}
        </div>

        {/* 브리핑 — 분야별 실시간 헤드라인 (주식 우선) */}
        <div style={{background:'linear-gradient(135deg,#0b1b32,#081220)',border:'1px solid rgba(37,99,235,0.2)',borderRadius:16,padding:20,marginBottom:24}}>
          <h2 style={{fontSize:11,fontWeight:700,color:'#3b82f6',letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 14px',display:'flex',alignItems:'center',gap:8}}>
            <span className="pulse" style={{width:6,height:6,borderRadius:'50%',background:'#3b82f6',display:'inline-block'}}/>
            실시간 헤드라인
          </h2>
          <div className="news-grid">
            {NEWS_CAT_ORDER.map((id) => {
              const hl = news.headlines?.[id];
              const block = news.categories?.[id];
              const label = hl?.label ?? block?.label ?? id;
              const linkUrl = hl?.url || block?.items?.[0]?.url;
              return (
                <div key={id}
                  onClick={() => linkUrl && window.open(linkUrl, '_blank', 'noopener,noreferrer')}
                  className={linkUrl ? 'headline-card' : undefined}
                  style={{background:'rgba(4,12,20,0.6)',border:'1px solid #1e293b',borderRadius:10,padding:'12px',minHeight:100,display:'flex',flexDirection:'column',gap:8,cursor:linkUrl?'pointer':'default'}}>
                  <div style={{fontSize:10,fontWeight:800,color:NEWS_CAT_COLOR[id] ?? '#94a3b8',letterSpacing:'0.06em'}}>{label}</div>
                  {hl?.headline ? (
                    <div style={{fontSize:11,color:'#f1f5f9',fontWeight:600,lineHeight:1.45,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                      {hl.headline}
                    </div>
                  ) : (
                    <span style={{ fontSize:11,color:'#64748b' }}>{news.error ? '뉴스 로드 실패 · 새로고침' : '뉴스 불러오는 중...'}</span>
                  )}
                  {hl?.mover && (
                    <div style={{fontSize:10,color:'#94a3b8',fontFamily:'Pretendard',marginTop:'auto'}}>
                      <span style={{color: hl.mover.chg >= 0 ? UP : DOWN, fontWeight:700}}>
                        {hl.mover.label} {hl.mover.chg >= 0 ? '+' : ''}{hl.mover.chg?.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {(block?.items ?? []).length > 1 && (
                    <div style={{borderTop:'1px solid #1e293b',paddingTop:6,display:'flex',flexDirection:'column',gap:4}} onClick={(e) => e.stopPropagation()}>
                      {block.items.slice(1, 3).map((n, i) => (
                        <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                          style={{fontSize:10,color:'#94a3b8',textDecoration:'none',lineHeight:1.35,display:'-webkit-box',WebkitLineClamp:1,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                          · {n.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 미국·한국 히트맵 (2열 풀폭) ── */}
        <div style={{marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>🔥 섹터별 등락률</h3>
          <span style={{fontSize:10,color:'#475569',fontFamily:'Pretendard'}}>동일 섹터 US↔KR · 괴리 큰 순 · %p=포인트 차</span>
        </div>
        <div className="card" style={{ marginBottom: 20, padding: 8 }}>
          <SectorComparePanel usSectors={usSectorsWithChg} krSectors={krSectorsWithChg} />
        </div>

        <EventTimelinePanel />

        {/* ── 순유동성: 맨 아래 ── */}
        <div style={{marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>💧 Fed 유동성 (거시환경)</h3>
          <span style={{fontSize:10,color:'#475569',fontFamily:'Pretendard'}}>FRED · 1시간 캐시</span>
        </div>
        <div className="card" style={{marginBottom:24}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4,flexWrap:'wrap',gap:10}}>
            <div>
              <span style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>REALTIME NET LIQUIDITY INDEX</span>
              <div style={{fontSize:28,fontFamily:'Pretendard',fontWeight:900,color:'#00e87a',marginTop:4}}>{fmtT(cur.netLiquidity)}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
              <span style={{fontSize:10,color:'#475569',fontFamily:'Pretendard'}}>출처: FRED / US Treasury</span>
              <div style={{display:'flex',gap:4}}>
                {[{id:'day',label:'일'},{id:'week',label:'주'},{id:'month',label:'월'}].map((p) => (
                  <button key={p.id} onClick={() => handleLiqPeriod(p.id)} style={{
                    background: liqPeriod === p.id ? '#2563eb' : '#1e293b',
                    color: liqPeriod === p.id ? '#fff' : '#94a3b8',
                    border:'1px solid #334155', borderRadius:6, padding:'4px 14px',
                    fontSize:11, fontWeight:700, cursor:'pointer',
                  }}>{p.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{fontSize:11,color:'#94a3b8',marginBottom:12,lineHeight:1.6}}>
            <b style={{color:'#00e87a'}}>순유동성</b> = Fed 총자산 − TGA − RRP. {liquidity.periodLabel ?? '최근 12주'} 추이를 4개 지표로 분할 표시합니다.
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16,paddingBottom:12,borderBottom:'1px solid #1e293b',textAlign:'center'}}>
            {[{label:'Fed 총자산',val:cur.fed,color:'#ff4a5a'},{label:'TGA 재무부',val:cur.tga,color:'#2563eb'},{label:'RRP 역레포',val:cur.rrp,color:'#a855f7'},{label:'미국 MMF',val:cur.mmf,color:'#f59e0b'}].map((item,i)=>(
              <div key={i}><span style={{fontSize:10,color:'#64748b',display:'block',marginBottom:2}}>{item.label}</span><span style={{fontSize:12,fontFamily:'Pretendard',fontWeight:700,color:item.color}}>{fmtT(item.val)}</span></div>
            ))}
          </div>
          <div className="grid2 liq4" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
            {['net','fed','tga','rrp'].map((key) => {
              const meta = CHART_DESC[key];
              const delta = formatLiqDelta(calcSeriesChange(liquidity?.series?.[key]), liqPeriod);
              return (
                <div key={key} style={{background:'rgba(4,12,20,0.4)',borderRadius:8,padding:'8px 10px',border:'1px solid #1e293b'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:2}}>
                    <div style={{fontSize:10,fontWeight:700,color:meta.color,display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:7,height:7,borderRadius:'50%',background:meta.color,display:'inline-block',flexShrink:0}}/>{meta.label}
                    </div>
                    {delta && (
                      <span style={{fontSize:9,fontWeight:800,fontFamily:'Pretendard',color:delta.color,whiteSpace:'nowrap',flexShrink:0}} title={delta.text}>
                        {delta.text}
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:9,color:'#64748b',marginBottom:6,lineHeight:1.4}}>{meta.desc}</div>
                  <div id={`chart-${key}`} style={{width:'100%',height:130}}/>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </>
  );
}