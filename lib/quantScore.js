export const METRIC_FIELD_META = {
  revenueYoY: { label: '매출 YoY', unit: '%', us: 'Yahoo · revenueGrowth', kr: '네이버 · 연간 실적 YoY' },
  revenueYoYQuarter: { label: '매출 YoY(분기)', unit: '%', us: null, kr: '네이버 · 분기 전년동기' },
  revenueQoQ: { label: '매출 QoQ', unit: '%', us: null, kr: '네이버 · 전분기 대비' },
  epsGrowthNextYear: { label: 'EPS 성장', unit: '%', us: 'Yahoo · earningsTrend +1y', kr: '네이버 · 실적→컨센 EPS' },
  opm: { label: '영업이익률 OPM', unit: '%', us: 'Yahoo · operatingMargins', kr: '네이버 · 영업이익률' },
  cashConversion: { label: '현금전환비율', unit: '%', us: 'Yahoo · OCF÷영업이익', kr: '직접입력 (미제공)' },
  fPER: { label: 'fPER', unit: '배', us: 'Yahoo · forwardPE', kr: '네이버 · 추정PER' },
  peg: { label: 'PEG', unit: '', us: 'Yahoo · pegRatio', kr: '계산 · fPER÷EPS성장' },
  debtRatio: { label: '부채비율', unit: '%', us: 'Yahoo · debtToEquity', kr: '네이버 · 부채비율' },
  currentRatio: { label: '유동비율', unit: '', us: 'Yahoo · currentRatio', kr: '네이버 · 당좌비율(÷100)' },
  return3mo: { label: '3M 수익률', unit: '%', us: 'Yahoo Chart · 63거래일', kr: 'Yahoo Chart · 63거래일' },
  sp500Return3mo: { label: 'SPY 3M', unit: '%', us: 'Yahoo Chart · SPY', kr: 'Yahoo Chart · SPY' },
  drawdownFrom52wHigh: { label: '52주고점 대비', unit: '%', us: 'Yahoo Chart · 52w high', kr: 'Yahoo Chart · 52w high' },
  maAligned: { label: '이평 정배열', unit: '', us: 'Yahoo · 20>50>200일선', kr: 'Yahoo · 20>50>200일선' },
};

export function defaultMetricSources(market = 'us') {
  const out = {};
  Object.entries(METRIC_FIELD_META).forEach(([k, v]) => {
    out[k] = market === 'kr' ? v.kr : v.us;
  });
  return out;
}

export const EMPTY_METRICS = {
  revenueYoY: null,
  revenueYoYQuarter: null,
  revenueQoQ: null,
  epsGrowthNextYear: null,
  opm: null,
  cashConversion: null,
  fPER: null,
  peg: null,
  debtRatio: null,
  currentRatio: null,
  maAligned: null,
  drawdownFrom52wHigh: null,
  return3mo: null,
  sp500Return3mo: null,
};

export function round3(v) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v * 1000) / 1000;
}

export function fmtMetric(v, suffix = '') {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return `${round3(v)}${suffix}`;
}

export function fmtScore(v) {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return String(Math.round(v));
}

function capScore(v, max) {
  return Math.round(clamp(v, 0, max));
}

function lerpClamped(x, x0, x1, y0, y1, yMax = y1) {
  return clamp(lerp(x, x0, x1, y0, y1), Math.min(y0, y1), Math.max(yMax, y0, y1));
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function pct(v) {
  if (v == null || !Number.isFinite(v)) return null;
  const n = round3(v);
  return n >= 0 ? `+${n}%` : `${n}%`;
}

/** 리포트·근거 문구용 — 소수점 없음 */
function pctInt(v) {
  if (v == null || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 0 ? `+${n}%` : `${n}%`;
}

function pctIntCompact(v) {
  if (v == null || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 0 ? `+${n}%` : `${n}%`;
}

function fmtPctLabel(label, v) {
  const p = pctIntCompact(v);
  return p != null ? `${label}${p}` : null;
}

function fmtMetricInt(v, suffix = '') {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return `${Math.round(v)}${suffix}`;
}

function fmtPeg(v) {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return (Math.round(v * 10) / 10).toFixed(1);
}

/** 항목별 만점 — 성장 25 · 밸류 25 · 수익 20 · 모멘 20 · 안전 10 */
const SCORE_MAX = {
  growth: 25,
  profitability: 20,
  valuation: 25,
  safety: 10,
  momentum: 20,
};
const CORE_WITHOUT_VAL_MAX = SCORE_MAX.growth + SCORE_MAX.profitability + SCORE_MAX.safety + SCORE_MAX.momentum;

function scaleScore(score, fromMax, toMax) {
  if (fromMax <= 0) return 0;
  return capScore(Math.round((score / fromMax) * toMax), toMax);
}

function packValuation(score, fromMax = 20) {
  return scaleScore(score, fromMax, SCORE_MAX.valuation);
}

function packSafety(score, fromMax = 15) {
  return scaleScore(score, fromMax, SCORE_MAX.safety);
}

/** 국장: QoQ·분기YoY 가중 > 연간YoY · 미장: 연간(TTM)만 */
export function blendRevenueGrowth(m, market = 'us') {
  const annual = m.revenueYoY;
  const qYoY = m.revenueYoYQuarter;
  const qoq = m.revenueQoQ;

  if (market !== 'kr') {
    return {
      value: annual,
      detail: annual != null ? `매출${pctIntCompact(annual)}` : '',
      parts: annual != null ? [{ label: '연간', value: annual, weight: 1 }] : [],
    };
  }

  const weights = [
    { key: 'qoq', value: qoq, weight: 0.4, label: 'QoQ' },
    { key: 'qYoY', value: qYoY, weight: 0.45, label: '분기YoY' },
    { key: 'annual', value: annual, weight: 0.15, label: '연간' },
  ].filter((x) => x.value != null && Number.isFinite(x.value));

  if (!weights.length) {
    return { value: null, detail: '', parts: [] };
  }

  const wSum = weights.reduce((s, x) => s + x.weight, 0);
  const value = weights.reduce((s, x) => s + x.value * x.weight, 0) / wSum;
  const detail = weights.map((x) => `${x.label}${pctIntCompact(x.value)}`).join(' ');

  return { value: round3(value), detail: `매출${pctIntCompact(value)} ${detail}`, parts: weights };
}

function growthRevForScore(m, meta = {}) {
  return blendRevenueGrowth(m, meta.market).value;
}

function interpretGrowth(m, item) {
  if (item.derivative) {
    if (m.return3mo == null) return '추세 데이터 없음';
    const alpha = m.return3mo != null && m.sp500Return3mo != null ? m.return3mo - m.sp500Return3mo : null;
    if (item.score >= 20) return `3M ${pctInt(m.return3mo)} · SPY 대비 우위 — 단기 추세 강세`;
    if (alpha != null && alpha >= 10) return `SPY 대비 ${pctInt(alpha)} — 상대 모멘텀 양호`;
    if (item.score >= 12) return '절대·상대 수익 모두 양호한 편';
    if (item.score >= 6) return '벤치마크 근접 — 추세 중립';
    return '단기 약세 — 벤치마크 하회';
  }

  const blend = blendRevenueGrowth(m, m._market);
  const rev = blend.value ?? m.revenueYoY;
  const eps = m.epsGrowthNextYear;
  const qoq = m.revenueQoQ;
  const qYoY = m.revenueYoYQuarter;
  const annual = m.revenueYoY;

  if (rev == null && eps == null) return '성장 지표 부재';

  if (rev != null && eps != null && rev <= 0 && eps <= 0) {
    return '매출·EPS 모두 역성장 — 성장성 최하위';
  }

  if (m._market === 'kr' && qoq != null && qoq >= 25 && rev != null && rev >= 25) {
    return `QoQ ${pctInt(qoq)} 가속 · 가중 매출 ${pctInt(rev)} — 최근 분기 회복이 점수 견인`;
  }
  if (m._market === 'kr' && qYoY != null && qYoY >= 25 && (qoq == null || qoq < 15)) {
    return `분기 YoY ${pctInt(qYoY)} 양호 — 전년 동기 대비 성장 반영`;
  }
  if (eps != null && eps >= 50 && rev != null && rev < 20) {
    return `EPS 전망 ${pctInt(eps)} 크지만 매출 가속 ${pctInt(rev)} — 매출이 발목 잡아 점수 제한`;
  }
  if (eps != null && eps >= 50 && rev != null && rev >= 30) {
    return `매출 ${pctInt(rev)} · EPS ${pctInt(eps)} — 성장·전망 모두 강해 고점수`;
  }
  if (rev != null && rev >= 40) {
    return `가중 매출 ${pctInt(rev)} — QoQ·분기 지표가 성장 점수 상단`;
  }
  if (annual != null && annual < 12 && rev != null && rev >= annual + 5) {
    return `연간 ${pctInt(annual)} 대비 최근 분기 ${pctInt(rev)} 개선 — 단기 회복 반영`;
  }
  if (rev != null && rev >= 15 && eps != null && eps >= 15) {
    return `매출 ${pctInt(rev)} · EPS ${pctInt(eps)} — 성장·전망 균형 양호`;
  }
  if (rev != null && rev >= 15) return `매출 성장 ${pctInt(rev)} — EPS보다 매출 쪽이 우세`;
  if (eps != null && eps >= 30) return `EPS 전망 ${pctInt(eps)} 우수 — 매출 성장은 상대적으로 약함`;
  if (rev != null && rev > 0) return `완만한 성장 ${pctInt(rev)} — 추가 가속 필요`;
  return '성장 모멘텀 부족 — 점수 하단';
}

function interpretProfitability(m, item) {
  if (item.derivative) {
    if (m.maAligned && item.score >= 16) return '정배열·고점 근접 — 추세 구조 양호';
    if (m.maAligned) return '이평 정배열 — 추세는 유지';
    if (item.score >= 10) return '추세 보통 — 조정·횡보 구간';
    return '추세 약화 — 깊은 조정 구간';
  }
  const opm = m.opm;
  if (opm == null) return '영업이익률 없음';
  const revBlend = blendRevenueGrowth(m, m._market).value ?? m.revenueYoY ?? 0;
  const rule40 = revBlend + (opm ?? 0);

  if (opm < 0) {
    return `OPM ${pctInt(opm)} 적자 — EPS 성장으로 일부 완화, 수익성은 취약`;
  }
  if (item.penalty) {
    return `Rule of 40 ${fmtMetricInt(rule40)} · 현금전환 저조 — 수익성 감점`;
  }
  if (item.score >= 18) return `OPM ${pctInt(opm)} · R40 ${fmtMetricInt(rule40)} — 매출·마진 합이 양호`;
  if (item.score >= 14) return `OPM ${pctInt(opm)} · R40 ${fmtMetricInt(rule40)} — 수익성 양호`;
  if (opm < 8) return `OPM ${pctInt(opm)} 낮음 · R40 ${fmtMetricInt(rule40)} — 마진 개선 필요`;
  return `OPM ${pctInt(opm)} · R40 ${fmtMetricInt(rule40)} — 수익성 보통 구간`;
}

function interpretValuation(m, item) {
  if (item.excluded) return 'PER·PEG 미제공 — 4항목 환산';
  const { fPER, peg } = m;
  if (fPER != null && fPER < 0) return `fPER ${fmtMetricInt(fPER, '배')} 적자 — 성장 기준 부분 점수`;
  if (peg != null && peg < 1) return `PEG ${fmtPeg(peg)} · fPER ${fmtMetricInt(fPER, '배')} — 성장 대비 저평가`;
  if (peg != null && peg >= 1.5) return `PEG ${fmtPeg(peg)} — 성장 대비 밸류 부담`;
  return `fPER ${fmtMetricInt(fPER, '배')} · PEG ${fmtPeg(peg)} — 밸류 중립`;
}

function interpretSafety(m, item) {
  if (item.derivative) {
    if (item.score >= 9) return '변동성 낮고 고점 근접 — 구조적 리스크 낮음';
    if (item.score >= 6) return '변동성 보통 — 추세 리스크 관리';
    return '변동성 큼 — 깊은 조정 구간';
  }
  const debt = m.debtRatio;
  const cur = m.currentRatio;
  if (cur != null && cur < 1.0) {
    return `유동 ${fmtMetricInt(cur)} · 부채 ${debt != null ? pctInt(debt) : '—'} — 단기 상환 리스크`;
  }
  if (debt != null && debt > 100) {
    return `부채 ${pctInt(debt)} 과다 — 레버리지 부담`;
  }
  if (item.score >= 9) return `부채 ${pctInt(debt)} · 유동 ${fmtMetricInt(cur)} — 재무 안정`;
  if (item.score >= 5) return '부채·유동 일부 미흡 — 보통 수준';
  return '재무 안전성 미달 — 방어 점수 낮음';
}

function interpretMomentum(m, item) {
  const ret = m.return3mo;
  const spy = m.sp500Return3mo;
  const dd = m.drawdownFrom52wHigh;
  const alpha = ret != null && spy != null ? ret - spy : null;

  if (m.maAligned && alpha != null && alpha >= 10) {
    return `정배열 · 3M ${pctInt(ret)} · SPY 대비 ${pctInt(alpha)} — 추세·상대 강세`;
  }
  if (m.maAligned) return `정배열 · 3M ${pctInt(ret)} — 추세는 유지`;
  if (dd != null && dd <= -50) {
    return `52주 고점 ${pctInt(dd)} · 역배열 — 급락 후 반등 여부 관찰`;
  }
  if (dd != null && dd <= -30) {
    return `고점 ${pctInt(dd)} 조정 · 3M ${pctInt(ret)} — 모멘텀 약세`;
  }
  if (ret != null && ret < -15) {
    return `3M ${pctInt(ret)} · SPY ${pctInt(spy)} — 단기 하락 우세`;
  }
  if (dd != null && dd >= -15) return `52주 고점 ${pctInt(dd)} 근접 — 추격 매수 구간`;
  return '추세 중립 — 방향성 뚜렷하지 않음';
}

function growthFacts(m, derivative = false) {
  if (derivative) {
    const bits = [];
    if (m.return3mo != null) bits.push(`3M ${pctInt(m.return3mo)}`);
    if (m.return3mo != null && m.sp500Return3mo != null) {
      bits.push(`vs SPY ${pctInt(m.return3mo - m.sp500Return3mo)}`);
    }
    return bits.length ? bits.join(' · ') : '—';
  }
  const blend = blendRevenueGrowth(m, m._market);
  const bits = [];
  if (blend.value != null) bits.push(fmtPctLabel('매출', blend.value));
  else if (m.revenueYoY != null) bits.push(fmtPctLabel('매출', m.revenueYoY));
  if (m._market === 'kr' && m.revenueQoQ != null) bits.push(fmtPctLabel('Q', m.revenueQoQ));
  if (m._market === 'kr' && m.revenueYoYQuarter != null) bits.push(fmtPctLabel('분기', m.revenueYoYQuarter));
  if (m.epsGrowthNextYear != null) bits.push(fmtPctLabel('EPS', m.epsGrowthNextYear));
  return bits.length ? bits.join(' · ') : '—';
}

function profitabilityFacts(m, derivative = false) {
  if (derivative) {
    const bits = [];
    if (m.maAligned != null) bits.push(m.maAligned ? '이평 정배열' : '정배열 아님');
    if (m.drawdownFrom52wHigh != null) bits.push(`52주고점 ${pct(m.drawdownFrom52wHigh)}`);
    return bits.length ? bits.join(' · ') : '추세 데이터 없음';
  }
  if (m.opm == null) return 'OPM —';
  const revBlend = blendRevenueGrowth(m, m._market).value ?? m.revenueYoY ?? 0;
  const rule40 = revBlend + m.opm;
  return `OPM ${pctInt(m.opm)} · R40 ${fmtMetricInt(rule40)}`;
}

function valuationFacts(m, item) {
  if (item.excluded) return 'PER·PEG —';
  return `fPER ${fmtMetricInt(m.fPER, '배')} · PEG ${fmtPeg(m.peg)}`;
}

function safetyFacts(m, derivative = false) {
  if (derivative) {
    return m.drawdownFrom52wHigh != null
      ? `52주고점 ${pct(m.drawdownFrom52wHigh)} · 재무제표 N/A`
      : '재무제표 없음 · 변동성 중립';
  }
  return `부채 ${m.debtRatio != null ? pctInt(m.debtRatio) : '—'} · 유동 ${fmtMetricInt(m.currentRatio)}`;
}

function momentumFacts(m) {
  const bits = [];
  if (m.maAligned != null) bits.push(m.maAligned ? '정배열' : '역배열');
  if (m.return3mo != null) bits.push(`3M ${pctInt(m.return3mo)}`);
  if (m.sp500Return3mo != null && m.return3mo != null && m.return3mo > m.sp500Return3mo) {
    bits.push(`vs SPY ${pctInt(m.return3mo - m.sp500Return3mo)}`);
  } else if (m.drawdownFrom52wHigh != null) {
    bits.push(`52w ${pctInt(m.drawdownFrom52wHigh)}`);
  }
  return bits.length ? bits.join(' · ') : '—';
}

const SCORE_CRITERIA = {
  growth: '국장 QoQ·분기YoY 가중 · EPS 반영',
  growthDerivative: '3M·SPY 알파',
  profitability: 'R40·OPM · 현금전환',
  profitabilityDerivative: '정배열·52주고점',
  valuation: 'PEG·fPER (만점25)',
  valuationExcluded: 'PER·PEG 제외 · 4항목 환산',
  safety: '부채·유동 (만점10)',
  safetyDerivative: '변동성 추정',
  momentum: '정배열·SPY·고점',
};

export function buildReportData(stockName, result) {
  const { total, grade, breakdown: b, valuationExcluded, adjustmentNote, metrics, derivativeMode } = result;
  const valMax = b.valuation.max;
  const deriv = derivativeMode === true;

  const growthItem = {
    label: deriv ? '성장성(추세)' : '성장성',
    score: b.growth.score,
    max: b.growth.max,
    criteria: deriv ? SCORE_CRITERIA.growthDerivative : SCORE_CRITERIA.growth,
    facts: growthFacts(metrics, deriv),
    comment: interpretGrowth(metrics, b.growth),
    sortMax: SCORE_MAX.growth,
  };

  const profitabilityItem = {
    label: deriv ? '수익성(추세)' : '수익성',
    score: b.profitability.score,
    max: b.profitability.max,
    criteria: deriv ? SCORE_CRITERIA.profitabilityDerivative : SCORE_CRITERIA.profitability,
    facts: profitabilityFacts(metrics, deriv),
    comment: interpretProfitability(metrics, b.profitability),
    sortMax: SCORE_MAX.profitability,
  };

  const valuationItem = valuationExcluded
    ? {
        label: '밸류에이션',
        score: null,
        max: valMax,
        criteria: SCORE_CRITERIA.valuationExcluded,
        facts: valuationFacts(metrics, b.valuation),
        comment: interpretValuation(metrics, b.valuation),
        sortMax: SCORE_MAX.valuation,
      }
    : {
        label: '밸류에이션',
        score: b.valuation.score,
        max: valMax,
        criteria: SCORE_CRITERIA.valuation,
        facts: valuationFacts(metrics, b.valuation),
        comment: interpretValuation(metrics, b.valuation),
        sortMax: SCORE_MAX.valuation,
      };

  const safetyItem = {
    label: deriv ? '재무 안전성(추세)' : '재무 안전성',
    score: b.safety.score,
    max: b.safety.max,
    criteria: deriv ? SCORE_CRITERIA.safetyDerivative : SCORE_CRITERIA.safety,
    facts: safetyFacts(metrics, deriv),
    comment: interpretSafety(metrics, b.safety),
    sortMax: SCORE_MAX.safety,
  };

  const momentumItem = {
    label: '모멘텀',
    score: b.momentum.score,
    max: b.momentum.max,
    criteria: SCORE_CRITERIA.momentum,
    facts: momentumFacts(metrics),
    comment: interpretMomentum(metrics, b.momentum),
    sortMax: SCORE_MAX.momentum,
  };

  const items = [growthItem, valuationItem, profitabilityItem, momentumItem, safetyItem]
    .sort((a, b) => b.sortMax - a.sortMax)
    .map(({ sortMax, ...rest }) => rest);

  const summary = [
    { label: '성장', score: b.growth.score, max: SCORE_MAX.growth },
    { label: '밸류', score: valuationExcluded ? null : b.valuation.score, max: SCORE_MAX.valuation, excluded: valuationExcluded },
    { label: '수익성', score: b.profitability.score, max: SCORE_MAX.profitability },
    { label: '모멘텀', score: b.momentum.score, max: SCORE_MAX.momentum },
    { label: '안전', score: b.safety.score, max: SCORE_MAX.safety },
  ];

  return {
    stockName: stockName || '종목',
    total,
    grade,
    adjustmentNote,
    valuationExcluded,
    derivativeMode: deriv,
    summary,
    items,
  };
}

export function getGrade(total) {
  if (total >= 90) return '강력 매수';
  if (total >= 75) return '매수';
  if (total >= 50) return '보유';
  return '관망';
}

function normalizeMetrics(raw) {
  return {
    revenueYoY: round3(raw.revenueYoY),
    revenueYoYQuarter: round3(raw.revenueYoYQuarter),
    revenueQoQ: round3(raw.revenueQoQ),
    epsGrowthNextYear: round3(raw.epsGrowthNextYear),
    opm: round3(raw.opm),
    cashConversion: round3(raw.cashConversion),
    fPER: raw.fPER != null ? round3(raw.fPER) : null,
    peg: raw.peg != null ? round3(raw.peg) : null,
    debtRatio: round3(raw.debtRatio),
    currentRatio: raw.currentRatio != null ? round3(raw.currentRatio) : null,
    maAligned: raw.maAligned ?? null,
    drawdownFrom52wHigh: round3(raw.drawdownFrom52wHigh),
    return3mo: round3(raw.return3mo),
    sp500Return3mo: round3(raw.sp500Return3mo),
  };
}

function growthReliefBonus(m, meta = {}) {
  const rev = growthRevForScore(m, meta) ?? m.revenueYoY;
  let bonus = 0;
  if (m.epsGrowthNextYear != null && m.epsGrowthNextYear >= 30) bonus += 4;
  else if (m.epsGrowthNextYear != null && m.epsGrowthNextYear >= 10) bonus += 2;
  if (rev != null && rev >= 20) bonus += 2;
  else if (rev != null && rev >= 10) bonus += 1;
  return bonus;
}

function growthMetricScore(v) {
  if (v == null) return null;
  if (v <= 0) return 0;
  if (v >= 80) return 25;
  if (v >= 30) return lerpClamped(v, 30, 80, 10, 25, 25);
  if (v >= 10) return lerpClamped(v, 10, 30, 4, 10, 10);
  return lerpClamped(v, 0, 10, 0, 4, 4);
}

function scoreGrowth(m, meta = {}) {
  const rev = growthRevForScore(m, meta);
  const eps = m.epsGrowthNextYear;
  const revS = growthMetricScore(rev) ?? 0;
  const epsS = growthMetricScore(eps) ?? 0;

  let score = 0;
  let reason = '';
  const revDetail = blendRevenueGrowth(m, meta.market).detail;

  if (rev == null && eps == null) {
    reason = '매출·EPS 성장 데이터 없음 → 0점';
  } else if (rev != null && eps != null && rev <= 0 && eps <= 0) {
    score = 2;
    reason = `${revDetail || `매출 ${pct(rev)}`} · EPS ${pct(eps)} → 둘 다 0% 이하 → ${fmtScore(score)}점`;
  } else if (rev != null && eps != null) {
    score = revS * 0.4 + epsS * 0.6;
    const bothStrong = rev >= 50 && eps >= 50;
    const bothMid = rev >= 30 && eps >= 30;

    if (Math.min(rev, eps) >= 100 || (rev >= 80 && eps >= 80)) {
      score = Math.max(score, lerpClamped(Math.min(rev, eps), 80, 150, 23, 25, 25));
    } else if (bothStrong) {
      score = Math.min(Math.max(score, 20), 22);
    } else if (bothMid) {
      score = Math.min(Math.max(score, 16), 20);
    } else if (rev >= 20 || eps >= 50) {
      score = Math.min(Math.max(score, 12), 18);
    } else {
      score = Math.min(score, 12);
    }

    score = capScore(score, 25);
    const band = score >= 23 ? '초고성장' : score >= 18 ? '고성장' : score >= 14 ? '성장 양호' : '저성장';
    reason = `${blendRevenueGrowth(m, meta.market).detail || `매출${pctIntCompact(rev)}`} · EPS${pctIntCompact(eps)} · ${band}`;
  } else {
    score = capScore(Math.max(revS, epsS) * 0.78, 18);
    const used = rev != null ? (revDetail || `매출 ${pct(rev)}`) : `EPS ${pct(eps)}`;
    reason = `${used} 단일 지표만 확보(만점 제한) → ${fmtScore(score)}점`;
  }

  return { score: capScore(score, 25), max: 25, reason };
}

function scoreProfitability(m, meta = {}) {
  const opm = m.opm;

  if (opm == null) {
    return { score: 0, max: 20, reason: '영업이익률 미입력 → 0점', penalty: false };
  }

  let score;
  let reason;

  if (opm < 0) {
    const base = lerp(opm, 0, -80, 7, 2);
    score = capScore(clamp(base + growthReliefBonus(m, meta), 3, 12), 20);
    reason = `OPM ${pct(opm)} 적자 · EPS ${pct(m.epsGrowthNextYear)} 완화 → ${fmtScore(score)}점`;
  } else {
    const revGrowth = growthRevForScore(m, meta) ?? m.revenueYoY ?? 0;
    const rule40 = revGrowth + opm;
    if (rule40 >= 40) score = capScore(lerpClamped(rule40, 40, 80, 16, 20, 20), 20);
    else score = capScore(lerpClamped(rule40, 0, 40, 6, 16, 16), 20);
    reason = `OPM ${pctInt(opm)} · 매출${pctIntCompact(revGrowth)} · R40 ${fmtMetricInt(rule40)}`;
  }

  let penalty = false;
  if (m.cashConversion != null && m.cashConversion < 30) {
    score = capScore(Math.max(2, score - 5), 20);
    penalty = true;
    reason += ` · 현금전환 ${pct(m.cashConversion)}<30% → -5점`;
  } else if (m.cashConversion == null) {
    reason += ' · 현금전환 N/A → 감점 없음';
  }

  return { score: capScore(score, 20), max: 20, reason, penalty };
}

function isValuationNA(m) {
  return m.fPER == null && m.peg == null;
}

function hasFundamentalGrowth(m) {
  return m.revenueYoY != null || m.epsGrowthNextYear != null;
}

function hasFundamentalProfitability(m) {
  return m.opm != null;
}

function hasFundamentalSafety(m) {
  return m.debtRatio != null || m.currentRatio != null;
}

function hasPriceMetrics(m) {
  return m.return3mo != null || m.drawdownFrom52wHigh != null || m.maAligned != null;
}

/** ETF·레버리지·ETN 등 재무제표 없는 상품 — 가격·추세 지표로 대체 채점 */
function isDerivativeMode(m, meta = {}) {
  if (meta.isDerivative === true) return true;
  if (meta.isDerivative === false) return false;

  const name = String(meta.stockName || meta.label || '');
  const nameHint = /ETF|ETN|레버|인버스|선물|채권|TRUST|FUND|SPDR|iShares|KODEX|TIGER|KOSEF|ARIRANG|HANARO|SOL|ACE|TIMEFOLIO|KBSTAR|PLUS|RISE|WON|파생|2X|3X|-U|-D|BULL|BEAR|INVERSE|LEVER/i.test(name);

  const fundamentalsMissing = !hasFundamentalGrowth(m)
    && !hasFundamentalProfitability(m)
    && isValuationNA(m)
    && !hasFundamentalSafety(m);

  return fundamentalsMissing && hasPriceMetrics(m) && (nameHint || fundamentalsMissing);
}

function scoreGrowthDerivative(m) {
  const ret = m.return3mo;
  const spy = m.sp500Return3mo;

  if (ret == null && spy == null) {
    return { score: 0, max: 25, reason: '파생·ETF · 3M·SPY 데이터 없음 → 0점', derivative: true };
  }

  let retScore = 0;
  if (ret != null) {
    if (ret <= 0) retScore = lerpClamped(ret, -40, 0, 0, 6, 6);
    else if (ret >= 80) retScore = 15;
    else if (ret >= 30) retScore = lerpClamped(ret, 30, 80, 10, 15, 15);
    else retScore = lerpClamped(ret, 0, 30, 4, 10, 10);
  }

  let alphaScore = 5;
  if (ret != null && spy != null) {
    const alpha = ret - spy;
    if (alpha <= 0) alphaScore = lerpClamped(alpha, -20, 0, 0, 5, 5);
    else if (alpha >= 50) alphaScore = 10;
    else alphaScore = lerpClamped(alpha, 0, 50, 5, 10, 10);
  }

  let score = retScore + alphaScore;
  let reason = `파생·ETF · 3M ${pct(ret)} · SPY ${pct(spy)}`;

  if (m.drawdownFrom52wHigh != null && m.drawdownFrom52wHigh < -25) {
    const drag = lerpClamped(m.drawdownFrom52wHigh, -50, -25, 5, 0, 5);
    score -= drag;
    reason += ` · 고점조정 ${pct(m.drawdownFrom52wHigh)} → -${fmtScore(drag)}`;
  }

  score = capScore(score, 25);
  reason += ` → ${fmtScore(score)}점`;
  return { score, max: 25, reason, derivative: true };
}

function scoreProfitabilityDerivative(m) {
  const maScore = m.maAligned ? 10 : (m.maAligned === false ? 3 : 5);
  let ddScore = 5;
  const dd = m.drawdownFrom52wHigh;

  if (dd != null) {
    if (dd >= -10) ddScore = lerpClamped(dd, -10, 0, 8, 10, 10);
    else if (dd >= -30) ddScore = lerpClamped(dd, -30, -10, 4, 8, 8);
    else ddScore = lerpClamped(dd, -60, -30, 0, 4, 4);
  }

  const score = capScore(maScore + ddScore, 20);
  const reason = `파생·ETF · ${m.maAligned ? '이평 정배열' : '정배열 미충족'} · 52주고점 ${pct(dd)} → ${fmtScore(score)}점`;
  return { score, max: 20, reason, derivative: true, penalty: false };
}

function scoreSafetyDerivative(m) {
  const dd = m.drawdownFrom52wHigh;
  let score = 10;
  let reason = '파생·ETF · 재무제표 없음';

  if (dd != null) {
    if (dd >= -15) score = capScore(12 + lerpClamped(dd, -15, 0, 0, 3, 3), 15);
    else if (dd >= -35) score = capScore(10 + lerpClamped(dd, -35, -15, -2, 2, 12), 15);
    else score = capScore(lerpClamped(dd, -60, -35, 4, 8, 8), 15);
    reason += ` · 변동성(고점 ${pct(dd)})`;
  }

  if (m.return3mo != null && m.return3mo > 200 && dd != null && dd < -25) {
    score = capScore(score - 2, 15);
    reason += ' · 고수익+깊은조정 -2';
  }

  reason += ` → ${fmtScore(packSafety(score))}점`;
  return { score: packSafety(score), max: SCORE_MAX.safety, reason, derivative: true };
}

function scoreValuation(m) {
  const { fPER, peg } = m;
  const VMAX = SCORE_MAX.valuation;

  if (isValuationNA(m)) {
    return {
      score: null,
      max: VMAX,
      excluded: true,
      reason: 'fPER·PEG 공백 → 항목 제외 후 4항목 환산',
    };
  }

  if (fPER == null || peg == null) {
    if (fPER != null) {
      let raw;
      let reason;
      if (fPER < 0) {
        raw = capScore(lerp(fPER, -20, -100, 5, 2), 10);
        reason = `fPER ${fmtMetric(fPER, '배')} 적자 · PEG N/A → ${fmtScore(packValuation(raw, 10))}점`;
      } else if (fPER <= 12) {
        raw = capScore(lerpClamped(fPER, 0, 12, 18, 20, 20), 20);
        reason = `fPER ${fmtMetric(fPER, '배')}≤12 · PEG N/A → ${fmtScore(packValuation(raw))}점`;
      } else if (fPER <= 22) {
        raw = capScore(lerpClamped(fPER, 12, 22, 14, 8, 14), 20);
        reason = `fPER ${fmtMetric(fPER, '배')} · PEG N/A → ${fmtScore(packValuation(raw))}점`;
      } else {
        raw = capScore(lerpClamped(fPER, 22, 45, 8, 4, 8), 20);
        reason = `fPER ${fmtMetric(fPER, '배')} 고PER · PEG N/A → ${fmtScore(packValuation(raw))}점`;
      }
      return { score: packValuation(raw, fPER < 0 ? 10 : 20), max: VMAX, excluded: false, reason };
    }
    return {
      score: null,
      max: VMAX,
      excluded: true,
      reason: '밸류 지표 불완전(N/A) → 항목 제외 후 4항목 환산',
    };
  }

  const lossMaking = fPER < 0 || peg < 0;

  if (lossMaking) {
    let raw = 3;
    if (peg > 0) {
      if (peg < 1.5) raw = lerp(peg, 0.5, 1.5, 9, 6);
      else raw = lerp(peg, 1.5, 4, 6, 3);
    } else if (fPER < 0) {
      raw = lerp(fPER, -20, -100, 5, 2);
    }

    if (m.epsGrowthNextYear != null && m.epsGrowthNextYear >= 30) raw = Math.min(10, raw + 2);
    raw = capScore(raw, 10);
    const score = packValuation(raw, 10);

    return {
      score,
      max: VMAX,
      excluded: false,
      reason: `fPER ${fmtMetric(fPER, '배')} 적자 · PEG ${fmtPeg(peg)} → ${fmtScore(score)}점`,
    };
  }

  let raw;
  let reason;

  if (peg < 1 && fPER > 0) {
    raw = capScore(lerpClamped(peg, 0, 1, 16, 20, 20), 20);
    reason = `PEG ${fmtPeg(peg)}<1 · fPER ${fmtMetric(fPER, '배')} → 저평가 → ${fmtScore(packValuation(raw))}점`;
  } else if (fPER > 0 && peg >= 1.5) {
    raw = capScore(lerpClamped(peg, 1.5, 3, 8, 12, 12), 20);
    reason = `fPER ${fmtMetric(fPER, '배')} · PEG ${fmtPeg(peg)}≥1.5 → ${fmtScore(packValuation(raw))}점`;
  } else {
    raw = capScore(lerpClamped(peg, 1, 1.5, 14, 10, 14), 20);
    reason = `fPER ${fmtMetric(fPER, '배')} · PEG ${fmtPeg(peg)} → ${fmtScore(packValuation(raw))}점`;
  }

  return { score: packValuation(raw), max: VMAX, excluded: false, reason };
}

function scoreSafety(m) {
  const debt = m.debtRatio;
  const cur = m.currentRatio;
  const SMAX = SCORE_MAX.safety;

  if (cur != null && cur < 1.0) {
    const score = packSafety(2);
    return { score, max: SMAX, reason: `유동비율 ${fmtMetric(cur)}<1.0 → ${fmtScore(score)}점` };
  }

  const debtOk = debt != null && debt <= 100;
  const curOk = cur != null && cur >= 1.5;
  const debtNA = debt == null;
  const curNA = cur == null;

  if (debtOk && curOk) {
    const bonus = debt != null ? lerp(debt, 0, 100, 1.5, 0) : 0;
    const curBonus = cur != null ? lerp(cur, 1.5, 3, 0, 1) : 0;
    const raw = capScore(clamp(13 + bonus + curBonus, 13, 15), 15);
    const score = packSafety(raw);
    return {
      score,
      max: SMAX,
      reason: `부채 ${pct(debt)}≤100 · 유동 ${fmtMetric(cur)}≥1.5 → ${fmtScore(score)}점`,
    };
  }

  if (debtNA || curNA || !debtOk || !curOk) {
    let partial = 7;
    if (debtOk && cur != null && cur >= 1.0) partial = capScore(7 + lerp(cur, 1, 1.5, 0, 3), 15);
    if (curOk && debt != null && debt <= 150) partial = capScore(7 + lerp(debt, 100, 150, 3, 0), 15);
    const score = packSafety(partial);
    return {
      score,
      max: SMAX,
      reason: `부채 ${pct(debt)} · 유동 ${fmtMetric(cur)} → 일부 미충족 → ${fmtScore(score)}점`,
    };
  }

  return { score: packSafety(3), max: SMAX, reason: `재무 안전성 미달 → ${fmtScore(packSafety(3))}점` };
}

function scoreMomentum(m) {
  const parts = [];
  let score = 0;

  const maPart = m.maAligned ? 10 : 5;
  score += maPart;
  parts.push(m.maAligned ? '이평 정배열 10점' : '정배열 미충족 5점');

  const dd = m.drawdownFrom52wHigh;
  const nearHigh = dd != null && dd >= -15;
  const beatSpy = m.return3mo != null && m.sp500Return3mo != null && m.return3mo > m.sp500Return3mo;

  let momPart = 5;
  if (nearHigh) {
    momPart = capScore(lerpClamped(dd, -15, 0, 8, 10, 10), 10);
    parts.push(`52주고점 ${pct(dd)} → ${fmtScore(momPart)}점`);
  } else if (beatSpy) {
    momPart = capScore(lerpClamped(m.return3mo - m.sp500Return3mo, 0, 20, 7, 10, 10), 10);
    parts.push(`3M ${pct(m.return3mo)} > SPY ${pct(m.sp500Return3mo)} → ${fmtScore(momPart)}점`);
  } else if (dd != null && dd > -30) {
    momPart = capScore(lerpClamped(dd, -30, -15, 5, 8, 8), 10);
    parts.push(`추세 약함(고점 ${pct(dd)}) → ${fmtScore(momPart)}점`);
  } else {
    parts.push('상대·추세 5점');
  }

  score += momPart;

  if (dd != null && dd <= -30) {
    score = capScore(Math.max(3, score - 5), 20);
    parts.push('52주고점 -30% 이하 폭락 → -5점');
  }

  return { score: capScore(score, 20), max: 20, reason: parts.join(' / ') };
}

export function formatQuantReport(stockName, result) {
  const data = buildReportData(stockName, result);
  const valRow = data.summary.find((s) => s.label === '밸류');
  const valLabel = data.valuationExcluded
    ? 'N/A(제외)'
    : `${fmtScore(valRow?.score)}/${valRow?.max ?? SCORE_MAX.valuation}`;

  return [
    '━━━━━━━━━━━━',
    '💎 투자 등급 💎',
    '━━━━━━━━━━━━',
    `종합 ${fmtScore(data.total)}점 (${data.grade})`,
    `* ${data.adjustmentNote} *`,
    data.summary.map((s) => {
      if (s.excluded) return `${s.label} N/A(제외)`;
      return `${s.label} ${fmtScore(s.score)}/${s.max}`;
    }).join(' · '),
    '',
    '■ 항목별 스코어링 근거',
    ...data.items.map((item) => {
      const scorePart = item.score == null ? `N/A/${item.max}` : `${fmtScore(item.score)}/${item.max}`;
      return [`- ${item.label} ${scorePart} (${item.criteria})`, `  ${item.facts}`, `  → ${item.comment}`].join('\n');
    }),
    '',
    `📌 ${data.stockName}`,
  ].join('\n');
}

export function calculateQuantScore(rawMetrics, meta = {}) {
  const m = normalizeMetrics({ ...EMPTY_METRICS, ...rawMetrics });
  m._market = meta.market || 'us';
  const sources = meta.metricSources || defaultMetricSources(meta.market);
  const derivativeMode = isDerivativeMode(m, meta);

  const growth = derivativeMode ? scoreGrowthDerivative(m) : scoreGrowth(m, meta);
  const profitability = derivativeMode ? scoreProfitabilityDerivative(m) : scoreProfitability(m, meta);
  const valuation = scoreValuation(m);
  const safety = derivativeMode ? scoreSafetyDerivative(m) : scoreSafety(m);
  const momentum = scoreMomentum(m);

  const valuationExcluded = valuation.excluded === true;
  const coreSum = growth.score + profitability.score + safety.score + momentum.score;

  let total;
  let adjustmentNote = '';

  if (valuationExcluded) {
    total = capScore(Math.min(100, Math.round(coreSum * (100 / CORE_WITHOUT_VAL_MAX))), 100);
    adjustmentNote = derivativeMode
      ? `파생·ETF · 밸류 N/A · (${fmtScore(coreSum)}/${CORE_WITHOUT_VAL_MAX})→100 = ${fmtScore(total)}점`
      : `밸류 N/A · (${fmtScore(coreSum)}/${CORE_WITHOUT_VAL_MAX})→100 = ${fmtScore(total)}점`;
  } else {
    total = capScore(Math.min(100, coreSum + (valuation.score ?? 0)), 100);
    adjustmentNote = derivativeMode
      ? '파생·ETF · 100점 만점 (5항목 합산)'
      : '100점 만점 (5항목 합산)';
  }

  const grade = getGrade(total);

  return {
    metrics: m,
    total,
    grade,
    valuationExcluded,
    derivativeMode,
    coreSum: capScore(coreSum, CORE_WITHOUT_VAL_MAX),
    adjustmentNote,
    metricSources: sources,
    breakdown: { growth, profitability, valuation, safety, momentum },
  };
}

export const fmtNum = fmtMetric;
