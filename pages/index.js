import Head from 'next/head';
import { useEffect, useRef, useState, useCallback } from 'react';

const FH_KEY = 'd8iabmhr01qm63bav7i0d8iabmhr01qm63bav7ig';

const fmtT = (v) => v == null ? '--' : `$${v.toFixed(3)}T`;

function ChangeLabel({ value, small = false }) {
  if (value == null) return <span style={{ color:'#64748b', fontSize: small?10:11 }}>--</span>;
  const pos = value >= 0;
  return <span style={{ color: pos?'#00e87a':'#ff4a5a', fontSize: small?10:11, fontFamily:'monospace', fontWeight:700 }}>
    {pos ? '▲ +' : '▼ '}{Math.abs(value).toFixed(2)}%
  </span>;
}

// ── Yahoo Finance 브라우저 직접 호출 ──
async function fetchYahooQuote(symbols) {
  try {
    const syms = Array.isArray(symbols) ? symbols.join(',') : symbols;
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error('yahoo failed');
    const d = await r.json();
    return d?.quoteResponse?.result ?? [];
  } catch { return []; }
}
function yGet(results, sym) {
  const r = results.find(x => x.symbol === sym);
  if (!r) return null;
  return { price: r.regularMarketPrice, chg: r.regularMarketChangePercent };
}

// ── 히트맵: 시총 비례 크기 ──
// 미국 섹터 (시총 단위: $B, 2026년 기준 근사치)
const US_SECTORS = [
  { sector: '반도체', items: [
    { sym:'NVDA', label:'NVDA', mcap:3200 },
    { sym:'AVGO', label:'AVGO', mcap:900 },
    { sym:'AMD',  label:'AMD',  mcap:290 },
    { sym:'QCOM', label:'QCOM', mcap:190 },
    { sym:'MU',   label:'MU',   mcap:120 },
    { sym:'INTC', label:'INTC', mcap:90 },
  ]},
  { sector: '빅테크', items: [
    { sym:'AAPL',  label:'AAPL',  mcap:3100 },
    { sym:'MSFT',  label:'MSFT',  mcap:2900 },
    { sym:'AMZN',  label:'AMZN',  mcap:2200 },
    { sym:'GOOGL', label:'GOOGL', mcap:2100 },
    { sym:'META',  label:'META',  mcap:1600 },
    { sym:'TSLA',  label:'TSLA',  mcap:900 },
  ]},
  { sector: '금융', items: [
    { sym:'JPM', label:'JPM', mcap:720 },
    { sym:'V',   label:'V',   mcap:640 },
    { sym:'BAC', label:'BAC', mcap:350 },
    { sym:'GS',  label:'GS',  mcap:190 },
  ]},
  { sector: '에너지/기타', items: [
    { sym:'BRK-B', label:'BRK-B', mcap:1100 },
    { sym:'WMT',   label:'WMT',   mcap:780 },
    { sym:'UNH',   label:'UNH',   mcap:520 },
    { sym:'XOM',   label:'XOM',   mcap:480 },
  ]},
];

const KR_ITEMS = [
  { sym:'KRX:005930', label:'삼성전자', yahoo:'005930.KS', mcap:350 },
  { sym:'KRX:000660', label:'SK하이닉스', yahoo:'000660.KS', mcap:120 },
  { sym:'KRX:005380', label:'현대차', yahoo:'005380.KS', mcap:55 },
  { sym:'KRX:000270', label:'기아', yahoo:'000270.KS', mcap:42 },
  { sym:'KRX:035420', label:'NAVER', yahoo:'035420.KS', mcap:38 },
  { sym:'KRX:051910', label:'LG화학', yahoo:'051910.KS', mcap:28 },
  { sym:'KRX:006400', label:'삼성SDI', yahoo:'006400.KS', mcap:25 },
  { sym:'KRX:003670', label:'포스코홀딩스', yahoo:'003670.KS', mcap:22 },
  { sym:'KRX:028260', label:'삼성물산', yahoo:'028260.KS', mcap:20 },
  { sym:'KRX:035720', label:'카카오', yahoo:'035720.KS', mcap:18 },
  { sym:'KRX:096770', label:'SK이노', yahoo:'096770.KS', mcap:15 },
  { sym:'KRX:066570', label:'LG전자', yahoo:'066570.KS', mcap:14 },
];

function heatColor(chg) {
  if (chg == null) return '#1a2535';
  if (chg >= 3)  return '#065f46';
  if (chg >= 2)  return '#047857';
  if (chg >= 1)  return '#059669';
  if (chg >= 0)  return '#0d7a4e';
  if (chg >= -1) return '#b91c1c';
  if (chg >= -2) return '#991b1b';
  if (chg >= -3) return '#7f1d1d';
  return '#6b1212';
}

// 시총 비례 높이 계산
function calcHeight(mcap, maxMcap, minH=36, maxH=90) {
  return minH + ((mcap / maxMcap) * (maxH - minH));
}

function HeatCell({ label, sym, chg, height = 56 }) {
  return (
    <div onClick={() => window.open(`https://finance.yahoo.com/quote/${sym.replace('KRX:','')}`, '_blank')}
      onMouseEnter={e => e.currentTarget.style.filter='brightness(1.25)'}
      onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}
      style={{ background:heatColor(chg), borderRadius:6, height, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'filter 0.15s', border:'1px solid rgba(255,255,255,0.06)', padding:'2px 4px' }}>
      <span style={{ fontSize: height > 60 ? 12 : 10, fontWeight:800, color:'#fff', fontFamily:'monospace', textAlign:'center', lineHeight:1.2 }}>{label}</span>
      <span style={{ fontSize: height > 60 ? 10 : 9, fontWeight:700, color:'rgba(255,255,255,0.85)', fontFamily:'monospace', marginTop:2 }}>
        {chg == null ? '--' : `${chg>=0?'+':''}${chg.toFixed(2)}%`}
      </span>
    </div>
  );
}

// ── 차트 설명 ──
const CHART_DESC = {
  net: { color:'#00e87a', label:'실질 가용 순유동성 추이', desc:'Fed자산 − TGA − RRP = 시중에 실제로 풀린 돈. 높을수록 위험자산(주식) 랠리 유리.' },
  fed: { color:'#ff4a5a', label:'Fed 총자산 (Balance Sheet)', desc:'연준이 보유한 국채·MBS 총합. 증가(QE)하면 시중 유동성↑, 감소(QT)하면 유동성↓.' },
  tga: { color:'#2563eb', label:'TGA 재무부 일반계정 잔고', desc:'정부 "통장 잔고". 잔고 감소 → 재정 지출 → 시중 유동성↑. 증가 → 돈이 시장에서 빠져나감.' },
  rrp: { color:'#a855f7', label:'RRP 연준 역레포 잔고', desc:'MMF가 연준에 맡긴 단기 예치금. 감소하면 그 돈이 시장으로 나와 유동성 공급 효과.' },
};

function buildNewsFeed(stock) {
  const soxDown = stock.soxChg != null && stock.soxChg <= -2;
  const nasdaqDown = stock.nasdaqChg != null && stock.nasdaqChg <= -2;
  return [
    { cat:'반도체/AI', title: soxDown ? `필반 ${stock.soxChg?.toFixed(1)}% 급락 — 삼성·하이닉스 수급 점검` : `엔비디아 ${stock.nvda?`$${stock.nvda.toFixed(1)}`:''} — 반도체 섹터 수급 동향`, provider:'네이버 금융', url:`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('삼성전자 SK하이닉스 반도체 오늘')}&sort=1` },
    { cat:'미국증시', title: nasdaqDown ? `나스닥 ${stock.nasdaqChg?.toFixed(1)}% 하락 — 뉴욕증시 급락 분석` : `나스닥·S&P500 오늘 동향 — 뉴욕증시 실시간`, provider:'네이버 경제', url:`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('뉴욕증시 나스닥 오늘')}&sort=1` },
    { cat:'매크로/Fed', title:`Fed 순유동성 동향 — TGA·RRP 변화와 위험자산 상관관계`, provider:'네이버 경제', url:`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('연준 유동성 금리 채권')}&sort=1` },
    { cat:'외환/환율', title:`원달러 환율${stock.usdkrw?` ${stock.usdkrw.toFixed(0)}원`:''} — 환율 방향성 및 외국인 자금 흐름`, provider:'네이버 경제', url:`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('원달러 환율 오늘')}&sort=1` },
    { cat:'실시간 속보', title:`글로벌 증시 실시간 속보 — 오늘의 주요 금융·경제 이슈`, provider:'네이버 금융 속보', url:`https://news.naver.com/breakingnews/section/101/259` },
  ];
}

function buildApexConfig(color, seriesData, name) {
  const categories = seriesData.map(d => (d.x||'').slice(5));
  const values = seriesData.map(d => d.y);
  return {
    chart: { type:'area', height:150, toolbar:{show:false}, background:'transparent', animations:{enabled:false} },
    grid: { strokeDashArray:4, borderColor:'#14243b', padding:{top:5,bottom:5,left:10,right:15} },
    stroke: { curve:'smooth', width:2.5 },
    colors: [color],
    fill: { type:'gradient', gradient:{shade:'dark',type:'vertical',shadeIntensity:0.4,gradientToColors:['transparent'],stops:[0,100]} },
    series: [{ name, data:values }],
    xaxis: { categories, labels:{style:{colors:'#527193',fontFamily:'monospace',fontSize:'9px'},rotate:0,hideOverlappingLabels:true}, tickAmount:5, axisBorder:{show:false}, axisTicks:{show:false} },
    yaxis: { labels:{style:{colors:'#527193',fontFamily:'monospace',fontSize:'10px'},formatter:v=>`$${v.toFixed(2)}T`} },
    theme: { mode:'dark' },
    tooltip: { theme:'dark', y:{formatter:v=>`$${v.toFixed(3)}T`} },
    dataLabels: { enabled: false },
  };
}

export default function Dashboard() {
  const [stock, setStock] = useState({});
  const [liquidity, setLiquidity] = useState({});
  const [syncTime, setSyncTime] = useState('대기 중...');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [heatUS, setHeatUS] = useState({});
  const [heatKR, setHeatKR] = useState({});
  const chartsRef = useRef({});
  const chartsInitRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchStock = useCallback(async () => {
    const mainSyms = ['QQQ','^IXIC','^GSPC','SPY','^SOX','SOXX','NVDA','NQ=F','CL=F','USDKRW=X','^VIX','005930.KS','000660.KS'];
    const results = await fetchYahooQuote(mainSyms);
    const y = (sym) => yGet(results, sym);
    const nasdaq = y('QQQ') || y('^IXIC');
    const sp500  = y('SPY') || y('^GSPC');
    const sox    = y('SOXX') || y('^SOX');
    setStock({
      nasdaq: nasdaq?.price, nasdaqChg: nasdaq?.chg,
      nasdaqFut: y('NQ=F')?.price, nasdaqFutChg: y('NQ=F')?.chg,
      sp500: sp500?.price, sp500Chg: sp500?.chg,
      sox: sox?.price, soxChg: sox?.chg,
      nvda: y('NVDA')?.price, nvdaChg: y('NVDA')?.chg,
      samsung: y('005930.KS')?.price, samsungChg: y('005930.KS')?.chg,
      hynix: y('000660.KS')?.price, hynixChg: y('000660.KS')?.chg,
      wti: y('CL=F')?.price, wtiChg: y('CL=F')?.chg,
      usdkrw: y('USDKRW=X')?.price, usdkrwChg: y('USDKRW=X')?.chg,
      vix: y('^VIX')?.price, vixChg: y('^VIX')?.chg,
      kospiFut: null, kospiFutChg: null,
    });
  }, []);

  const fetchHeatmap = useCallback(async () => {
    const usSyms = US_SECTORS.flatMap(s => s.items.map(i => i.sym));
    const usResults = await fetchYahooQuote(usSyms);
    const usMap = {};
    usSyms.forEach(sym => { usMap[sym] = yGet(usResults, sym)?.chg ?? null; });
    setHeatUS(usMap);

    const krSyms = KR_ITEMS.map(i => i.yahoo);
    const krResults = await fetchYahooQuote(krSyms);
    const krMap = {};
    KR_ITEMS.forEach(item => { krMap[item.sym] = yGet(krResults, item.yahoo)?.chg ?? null; });
    setHeatKR(krMap);
  }, []);

  const fetchLiquidity = useCallback(async () => {
    try { const r = await fetch('/api/liquidity'); setLiquidity(await r.json()); } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true); setSyncTime('동기화 중...');
    await Promise.all([fetchStock(), fetchLiquidity(), fetchHeatmap()]);
    setSyncTime(new Date().toLocaleTimeString('ko-KR'));
    setLoading(false);
  }, [fetchStock, fetchLiquidity, fetchHeatmap]);

  useEffect(() => { if (mounted) fetchAll(); }, [mounted, fetchAll]);

  useEffect(() => {
    if (!mounted || !liquidity?.series) return;
    let destroyed = false;
    const initCharts = async () => {
      const ApexCharts = (await import('apexcharts')).default;
      if (destroyed) return;
      const { series } = liquidity;
      const cfgs = [
        { id:'chart-net', key:'net' }, { id:'chart-fed', key:'fed' },
        { id:'chart-tga', key:'tga' }, { id:'chart-rrp', key:'rrp' },
      ];
      if (!chartsInitRef.current) {
        chartsInitRef.current = true;
        for (const cfg of cfgs) {
          if (destroyed) break;
          const el = document.getElementById(cfg.id);
          if (!el || el.children.length > 0) continue;
          const meta = CHART_DESC[cfg.key];
          try {
            const chart = new ApexCharts(el, buildApexConfig(meta.color, series[cfg.key], meta.label));
            await chart.render();
            chartsRef.current[cfg.id] = chart;
          } catch {}
        }
      } else {
        for (const cfg of cfgs) {
          const chart = chartsRef.current[cfg.id];
          if (!chart) continue;
          try { chart.updateSeries([{ data: series[cfg.key].map(d => d.y) }]); } catch {}
        }
      }
    };
    initCharts();
    return () => { destroyed = true; };
  }, [mounted, liquidity]);

  const cur = liquidity?.current ?? {};
  const s = stock;
  const isRisk = s.soxChg != null && s.soxChg <= -3;
  const newsFeed = buildNewsFeed(s);

  // 시총 기반 높이 계산
  const usMaxMcap = Math.max(...US_SECTORS.flatMap(sec => sec.items.map(i => i.mcap)));
  const krMaxMcap = Math.max(...KR_ITEMS.map(i => i.mcap));

  if (!mounted) return null;

  return (
    <>
      <Head><title>Macro Intelligence Dashboard</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /></Head>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#040c14;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#cbd5e1}
        .card{background:#0b1523;border:1px solid #1e293b;border-radius:12px;padding:14px}
        .pulse{animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .apexcharts-tooltip{background:#111e31!important;border:1px solid #1e3656!important;color:#fff!important}
        @media(max-width:640px){.grid4{grid-template-columns:repeat(2,1fr)!important}.grid2{grid-template-columns:1fr!important}}
      `}</style>

      <div style={{maxWidth:900,margin:'0 auto',padding:16,paddingBottom:80}}>

        {/* 헤더 */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #1e293b',paddingBottom:20,marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:18,fontWeight:900,color:'#fff',display:'flex',alignItems:'center',gap:8}}>📊 Macro & Stock Live Dashboard</h1>
            <p style={{fontSize:11,color:'#64748b',marginTop:4,fontFamily:'monospace'}}>최종 동기화: <span style={{color:'#00e87a',fontWeight:700}}>{syncTime}</span></p>
          </div>
          <button onClick={fetchAll} disabled={loading} style={{background:loading?'#1e3a5f':'#2563eb',color:'#fff',border:'none',borderRadius:10,padding:'10px 20px',fontSize:12,fontWeight:700,cursor:loading?'wait':'pointer',display:'flex',alignItems:'center',gap:6}}>
            <span style={loading?{display:'inline-block',animation:'spin 1s linear infinite'}:{}}>↻</span>
            실시간 데이터 업데이트
          </button>
        </div>

        {/* 브리핑 */}
        <div style={{background:isRisk?'linear-gradient(135deg,#1a0f1a,#081220)':'linear-gradient(135deg,#0b1b32,#081220)',border:isRisk?'1px solid rgba(255,74,90,0.3)':'1px solid rgba(37,99,235,0.2)',borderRadius:16,padding:20,marginBottom:24}}>
          <h2 style={{fontSize:11,fontWeight:700,color:isRisk?'#ff4a5a':'#3b82f6',letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 12px',display:'flex',alignItems:'center',gap:8}}>
            <span className="pulse" style={{width:6,height:6,borderRadius:'50%',background:isRisk?'#ff4a5a':'#3b82f6',display:'inline-block'}}/>
            실시간 매크로 분석 브리핑
          </h2>
          <div style={{background:'rgba(4,12,20,0.5)',borderRadius:8,padding:'10px 14px',border:'1px solid rgba(30,54,86,0.6)',fontSize:13,color:'#e2e8f0',fontWeight:500}}>
            {isRisk?`🚨 반도체 섹터 급락: 필반 ${s.soxChg?.toFixed(1)}% 하락. 고멀티플 기술주 중심 출회 강도 상승 중.`
              :cur.netLiquidity!=null?`📈 가용 순유동성 ${fmtT(cur.netLiquidity)} 유지. TGA ${fmtT(cur.tga)} / RRP ${fmtT(cur.rrp)} — Fed 유동성 공급 정상 궤도.`
              :'📊 업데이트 버튼을 눌러 최신 데이터를 가져오세요.'}
          </div>
          <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid #1e293b'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',marginBottom:10,display:'flex',justifyContent:'space-between'}}>
              <span>📌 실시간 데이터 기반 주요 뉴스</span>
              <span style={{color:'#00e87a',fontSize:10,fontFamily:'monospace'}}>클릭 시 최신순 뉴스</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {newsFeed.map((n,i)=>(
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                  style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(4,12,20,0.7)',border:'1px solid rgba(30,54,86,0.8)',borderRadius:10,padding:'10px 12px',textDecoration:'none',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,overflow:'hidden'}}>
                    <span style={{fontSize:10,background:'#1e293b',color:'#cbd5e1',padding:'2px 8px',borderRadius:4,fontWeight:700,whiteSpace:'nowrap'}}>{n.cat}</span>
                    <span style={{fontSize:12,color:'#cbd5e1',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.title}</span>
                  </div>
                  <span style={{fontSize:10,color:'#475569',fontFamily:'monospace',whiteSpace:'nowrap'}}>{n.provider}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* 마켓 티커 */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h2 style={{fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:'0.1em',textTransform:'uppercase',margin:0}}>🌐 LIVE MARKET TICKER</h2>
          <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>출처: Yahoo Finance</span>
        </div>
        <div className="grid4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24}}>
          {[
            {label:'나스닥100 (QQQ)',val:s.nasdaq,chg:s.nasdaqChg},
            {label:'나스닥100 선물',val:s.nasdaqFut,chg:s.nasdaqFutChg},
            {label:'S&P 500 (SPY)',val:s.sp500,chg:s.sp500Chg},
            {label:'필라델피아 반도체',val:s.sox,chg:s.soxChg},
            {label:'KOSPI200 야간선물',val:s.kospiFut,chg:s.kospiFutChg},
            {label:'엔비디아 (NVDA)',val:s.nvda,chg:s.nvdaChg},
            {label:'삼성전자',val:s.samsung,chg:s.samsungChg,digits:0},
            {label:'SK하이닉스',val:s.hynix,chg:s.hynixChg,digits:0},
          ].map((item,i)=>(
            <div key={i} className="card" style={{display:'flex',flexDirection:'column',gap:4}}>
              <span style={{fontSize:11,fontWeight:700,color:'#94a3b8'}}>{item.label}</span>
              <span style={{fontSize:15,fontWeight:900,color:'#fff',fontFamily:'monospace'}}>
                {item.val==null?'--':item.val.toLocaleString('en-US',{maximumFractionDigits:item.digits??2})}
              </span>
              <ChangeLabel value={item.chg}/>
            </div>
          ))}
        </div>

        {/* 보조 지표 */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24}}>
          <div className="card"><span style={{fontSize:10,fontWeight:700,color:'#fb923c'}}>CBOE VIX (공포지수)</span><div style={{fontSize:13,fontFamily:'monospace',fontWeight:700,color:'#fff',marginTop:4}}>{s.vix?.toFixed(2)??'--'} <ChangeLabel value={s.vixChg} small/></div></div>
          <div className="card"><span style={{fontSize:10,fontWeight:700,color:'#f59e0b'}}>국제유가 WTI</span><div style={{fontSize:13,fontFamily:'monospace',fontWeight:700,color:'#fff',marginTop:4}}>${s.wti?.toFixed(2)??'--'} <ChangeLabel value={s.wtiChg} small/></div></div>
          <div className="card"><span style={{fontSize:10,fontWeight:700,color:'#2dd4bf'}}>원/달러 환율</span><div style={{fontSize:13,fontFamily:'monospace',fontWeight:700,color:'#fff',marginTop:4}}>₩{s.usdkrw?.toFixed(1)??'--'} <ChangeLabel value={s.usdkrwChg} small/></div></div>
        </div>

        {/* 순유동성 */}
        <div className="card" style={{marginBottom:24}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
            <span style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>REALTIME NET LIQUIDITY INDEX</span>
            <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>출처: FRED / US Treasury</span>
          </div>
          <div style={{fontSize:28,fontFamily:'monospace',fontWeight:900,color:'#00e87a'}}>{fmtT(cur.netLiquidity)}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:12,paddingTop:12,borderTop:'1px solid #1e293b',textAlign:'center'}}>
            {[{label:'Fed 총자산',val:cur.fed,color:'#ff4a5a'},{label:'TGA 재무부',val:cur.tga,color:'#2563eb'},{label:'RRP 역레포',val:cur.rrp,color:'#a855f7'},{label:'미국 MMF',val:cur.mmf,color:'#f59e0b'}].map((item,i)=>(
              <div key={i}><span style={{fontSize:10,color:'#64748b',display:'block',marginBottom:2}}>{item.label}</span><span style={{fontSize:12,fontFamily:'monospace',fontWeight:700,color:item.color}}>{fmtT(item.val)}</span></div>
            ))}
          </div>
        </div>

        {/* 미국 히트맵 */}
        <div style={{marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>🇺🇸 미국 섹터별 히트맵 (셀 크기 = 시총 비례)</h3>
          <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>출처: Yahoo Finance · 클릭 시 상세</span>
        </div>
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {US_SECTORS.map(sec=>(
              <div key={sec.sector}>
                <div style={{fontSize:10,fontWeight:700,color:'#475569',textTransform:'uppercase',marginBottom:6,letterSpacing:'0.05em'}}>{sec.sector}</div>
                <div style={{display:'grid',gridTemplateColumns:`repeat(${sec.items.length},1fr)`,gap:4,alignItems:'end'}}>
                  {sec.items.map(item=>(
                    <HeatCell key={item.sym} label={item.label} sym={item.sym} chg={heatUS[item.sym]}
                      height={calcHeight(item.mcap, usMaxMcap, 40, 88)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4,marginTop:12,paddingTop:10,borderTop:'1px solid #1e293b',justifyContent:'center',flexWrap:'wrap'}}>
            {[['#6b1212','-3%↓'],['#7f1d1d','-3%'],['#991b1b','-2%'],['#b91c1c','-1%'],['#0d7a4e','+0%'],['#059669','+1%'],['#047857','+2%'],['#065f46','+3%↑']].map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:3}}><div style={{width:12,height:12,borderRadius:2,background:c}}/><span style={{fontSize:9,color:'#64748b',fontFamily:'monospace'}}>{l}</span></div>
            ))}
          </div>
        </div>

        {/* 한국 히트맵 */}
        <div style={{marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>🇰🇷 한국 코스피 대형주 히트맵 (셀 크기 = 시총 비례)</h3>
          <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>출처: Yahoo Finance</span>
        </div>
        <div className="card" style={{marginBottom:24}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4,alignItems:'end'}}>
            {KR_ITEMS.map(item=>(
              <HeatCell key={item.sym} label={item.label} sym={item.sym} chg={heatKR[item.sym]}
                height={calcHeight(item.mcap, krMaxMcap, 44, 80)} />
            ))}
          </div>
        </div>

        {/* 차트 — 설명 포함 */}
        <div style={{marginBottom:14}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>📈 Fed 유동성 지표 시계열 트렌드 (단위: $T)</h3>
        </div>
        <div className="grid2" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
          {(['net','fed','tga','rrp']).map(key=>{
            const meta = CHART_DESC[key];
            return (
              <div key={key} className="card">
                <div style={{fontSize:11,fontWeight:700,color:meta.color,display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:meta.color,display:'inline-block'}}/>{meta.label}
                </div>
                {/* 한줄 설명 */}
                <div style={{fontSize:10,color:'#64748b',marginBottom:8,lineHeight:1.5,padding:'4px 8px',background:'rgba(255,255,255,0.03)',borderRadius:4,borderLeft:`2px solid ${meta.color}`}}>
                  {meta.desc}
                </div>
                <div id={`chart-${key}`} style={{width:'100%',height:150}}/>
              </div>
            );
          })}
        </div>

      </div>
    </>
  );
}