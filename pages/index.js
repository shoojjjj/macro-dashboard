import Head from 'next/head';
import { useEffect, useRef, useState, useCallback } from 'react';

// ── 히트맵 종목 (트리맵 비율용 mcap 포함) ──────────────
const US_SECTORS = [
  { sector:'반도체', items:[
    {sym:'NVDA',label:'NVDA',mcap:3200},
    {sym:'AVGO',label:'AVGO',mcap:900},
    {sym:'AMD',label:'AMD',mcap:290},
    {sym:'QCOM',label:'QCOM',mcap:190},
    {sym:'MU',label:'MU',mcap:120},
  ]},
  { sector:'빅테크', items:[
    {sym:'AAPL',label:'AAPL',mcap:3100},
    {sym:'MSFT',label:'MSFT',mcap:2900},
    {sym:'AMZN',label:'AMZN',mcap:2200},
    {sym:'GOOGL',label:'GOOGL',mcap:2100},
    {sym:'META',label:'META',mcap:1600},
  ]},
  { sector:'금융', items:[
    {sym:'JPM',label:'JPM',mcap:720},
    {sym:'V',label:'V',mcap:640},
    {sym:'BAC',label:'BAC',mcap:350},
    {sym:'GS',label:'GS',mcap:190},
    {sym:'MA',label:'MA',mcap:480},
  ]},
  { sector:'헬스케어/필수소비', items:[
    {sym:'UNH',label:'UNH',mcap:520},
    {sym:'WMT',label:'WMT',mcap:780},
    {sym:'XOM',label:'XOM',mcap:480},
    {sym:'BRK-B',label:'BRK-B',mcap:1100},
    {sym:'TSLA',label:'TSLA',mcap:900},
  ]},
];

const KR_STOCKS = [
  {code:'005930',label:'삼성전자',mcap:350},
  {code:'000660',label:'SK하이닉스',mcap:120},
  {code:'005380',label:'현대차',mcap:55},
  {code:'000270',label:'기아',mcap:42},
  {code:'035420',label:'NAVER',mcap:38},
  {code:'051910',label:'LG화학',mcap:28},
  {code:'006400',label:'삼성SDI',mcap:25},
  {code:'003670',label:'포스코홀딩스',mcap:22},
  {code:'028260',label:'삼성물산',mcap:20},
  {code:'035720',label:'카카오',mcap:18},
  {code:'096770',label:'SK이노',mcap:15},
  {code:'066570',label:'LG전자',mcap:14},
];

// ── 유틸 ──────────────────────────────────────────────
const fmtT = (v) => v == null ? '--' : `$${v.toFixed(3)}T`;

function ChangeLabel({ value, small=false }) {
  if (value == null) return <span style={{color:'#64748b',fontSize:small?10:11}}>--</span>;
  const pos = value >= 0;
  return <span style={{color:pos?'#00e87a':'#ff4a5a',fontSize:small?10:11,fontFamily:'monospace',fontWeight:700}}>
    {pos?'▲ +':'▼ '}{Math.abs(value).toFixed(2)}%
  </span>;
}

function heatColor(chg) {
  if (chg==null) return '#2a2f3a';
  if (chg>=3)  return '#0d8a4f';
  if (chg>=2)  return '#0fa05a';
  if (chg>=1)  return '#13b768';
  if (chg>=0.3) return '#1fcf78';
  if (chg>=-0.3) return '#3a4150';
  if (chg>=-1) return '#d94f4f';
  if (chg>=-2) return '#c43838';
  if (chg>=-3) return '#a82424';
  return '#841414';
}

// ── 트리맵 (finviz 스타일): squarified treemap 알고리즘 ──
function squarify(items, x, y, w, h) {
  // items: [{...,mcap}], 면적은 mcap 비례
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];

  const total = items.reduce((s,i)=>s+i.mcap,0);
  const area = w*h;

  // 첫 항목(들)을 짧은 변에 맞춰 배치
  let i = 0, rowSum = 0;
  const isWide = w >= h;
  const sideLen = isWide ? h : w;

  // 한 행에 넣을 아이템 결정 (간단화: 비율 기준 분할)
  // 단순 알고리즘: 누적 비율로 분할 라인 결정
  const results = [];
  let consumed = 0;
  let remaining = items;
  let rx=x, ry=y, rw=w, rh=h;

  while (remaining.length > 0) {
    const remTotal = remaining.reduce((s,i)=>s+i.mcap,0);
    const wide = rw >= rh;
    const sLen = wide ? rh : rw;

    // 그리디하게 한 줄 구성 (최대 3개씩)
    let rowCount = Math.min(remaining.length, remaining.length <= 3 ? remaining.length : Math.ceil(remaining.length/2));
    if (remaining.length <= 2) rowCount = remaining.length;

    const row = remaining.slice(0, rowCount);
    const rowTotal = row.reduce((s,i)=>s+i.mcap,0);
    const rowAreaFrac = rowTotal / remTotal;

    if (wide) {
      const rowW = rw * rowAreaFrac;
      let cy = ry;
      row.forEach(item => {
        const itemH = rh * (item.mcap / rowTotal);
        results.push({ ...item, x: rx, y: cy, w: rowW, h: itemH });
        cy += itemH;
      });
      rx += rowW; rw -= rowW;
    } else {
      const rowH = rh * rowAreaFrac;
      let cx = rx;
      row.forEach(item => {
        const itemW = rw * (item.mcap / rowTotal);
        results.push({ ...item, x: cx, y: ry, w: itemW, h: rowH });
        cx += itemW;
      });
      ry += rowH; rh -= rowH;
    }
    remaining = remaining.slice(rowCount);
  }
  return results;
}

function TreemapTile({ tile, onClick }) {
  const showLabel = tile.w > 38 && tile.h > 24;
  const big = tile.w > 70 && tile.h > 50;
  return (
    <div onClick={onClick}
      onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.3)'}
      onMouseLeave={e=>e.currentTarget.style.filter='brightness(1)'}
      style={{
        position:'absolute', left:tile.x, top:tile.y, width:tile.w, height:tile.h,
        background:heatColor(tile.chg), border:'1px solid #040c14',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        cursor:'pointer', transition:'filter 0.15s', overflow:'hidden', boxSizing:'border-box',
      }}>
      {showLabel && (
        <>
          <span style={{fontSize:big?13:10, fontWeight:800, color:'#fff', fontFamily:'monospace', textShadow:'0 1px 2px rgba(0,0,0,0.4)'}}>{tile.label}</span>
          <span style={{fontSize:big?11:9, fontWeight:700, color:'rgba(255,255,255,0.9)', fontFamily:'monospace', marginTop:1}}>
            {tile.chg==null?'--':`${tile.chg>=0?'+':''}${tile.chg.toFixed(2)}%`}
          </span>
        </>
      )}
    </div>
  );
}

function Treemap({ items, width, height, onTileClick }) {
  const tiles = squarify(items, 0, 0, width, height);
  return (
    <div style={{ position:'relative', width, height }}>
      {tiles.map(t => <TreemapTile key={t.sym||t.code} tile={t} onClick={() => onTileClick(t)} />)}
    </div>
  );
}

// 섹터 라벨이 붙은 그리드형 멀티 트리맵 (finviz 스타일)
function SectorTreemapGrid({ sectors, totalWidth, onTileClick }) {
  // 2열 그리드로 섹터 배치
  const cols = totalWidth > 500 ? 2 : 1;
  const gap = 8;
  const colWidth = (totalWidth - gap*(cols-1)) / cols;

  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap }}>
      {sectors.map(sec => {
        const secTotal = sec.items.reduce((s,i)=>s+i.mcap,0);
        const h = Math.max(90, Math.min(160, secTotal / 18));
        return (
          <div key={sec.sector}>
            <div style={{fontSize:9,fontWeight:700,color:'#7d8aa0',textTransform:'uppercase',marginBottom:3,letterSpacing:'0.05em',background:'#0f1929',padding:'3px 6px',borderRadius:'4px 4px 0 0'}}>{sec.sector}</div>
            <Treemap items={sec.items} width={colWidth} height={h} onTileClick={onTileClick}/>
          </div>
        );
      })}
    </div>
  );
}

const CHART_DESC = {
  net:{color:'#00e87a',label:'실질 가용 순유동성',    desc:'Fed자산 − TGA − RRP. 시중에 실제로 풀린 돈의 양. 수치가 늘어날수록 주식·코인 등 위험자산에 우호적인 환경.'},
  fed:{color:'#ff4a5a',label:'Fed 총자산',desc:'연준이 보유한 국채·MBS 총합. 늘어나면(양적완화) 유동성 공급↑, 줄어들면(양적긴축) 유동성 회수.'},
  tga:{color:'#2563eb',label:'TGA 재무부 잔고',  desc:'정부의 "통장 잔고". 잔고가 줄면 정부가 돈을 풀고 있다는 뜻(유동성↑), 늘면 세금 등으로 돈을 거둬들이는 중(유동성↓).'},
  rrp:{color:'#a855f7',label:'RRP 역레포 잔고',      desc:'MMF(머니마켓펀드)가 연준에 단기로 맡겨둔 돈. 잔고가 줄면 그 돈이 시중으로 흘러나와 유동성을 보충.'},
};

function buildNewsFeed(s) {
  const soxDown = s.soxChg!=null && s.soxChg<=-2;
  const nasdaqDown = s.nasdaqChg!=null && s.nasdaqChg<=-2;
  return [
    {cat:'반도체/AI', title:soxDown?`필반 ${s.soxChg?.toFixed(1)}% 급락 — 삼성·하이닉스 수급 점검`:`엔비디아 ${s.nvda?`$${s.nvda.toFixed(1)}`:''} — 반도체 섹터 수급 동향`, url:`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('삼성전자 SK하이닉스 반도체 오늘')}&sort=1`},
    {cat:'미국증시', title:nasdaqDown?`나스닥 ${s.nasdaqChg?.toFixed(1)}% 하락 — 뉴욕증시 급락 분석`:`나스닥·S&P500 오늘 동향 — 뉴욕증시 실시간`, url:`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('뉴욕증시 나스닥 오늘')}&sort=1`},
    {cat:'매크로/Fed', title:`Fed 순유동성 동향 — TGA·RRP 변화와 위험자산 상관관계`, url:`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('연준 유동성 금리 채권')}&sort=1`},
    {cat:'외환/환율', title:`원달러 환율${s.usdkrw?` ${s.usdkrw.toFixed(0)}원`:''} — 환율 방향성 및 외국인 자금 흐름`, url:`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('원달러 환율 오늘')}&sort=1`},
    {cat:'실시간 속보', title:`글로벌 증시 실시간 속보 — 오늘의 주요 금융·경제 이슈`, url:`https://news.naver.com/breakingnews/section/101/259`},
  ];
}

function buildApexConfig(color, seriesData, name) {
  return {
    chart:{type:'area',height:150,toolbar:{show:false},background:'transparent',animations:{enabled:false}},
    grid:{strokeDashArray:4,borderColor:'#14243b',padding:{top:5,bottom:5,left:10,right:15}},
    stroke:{curve:'smooth',width:2.5},
    colors:[color],
    fill:{type:'gradient',gradient:{shade:'dark',type:'vertical',shadeIntensity:0.4,gradientToColors:['transparent'],stops:[0,100]}},
    series:[{name,data:seriesData.map(d=>d.y)}],
    xaxis:{categories:seriesData.map(d=>(d.x||'').slice(5)),labels:{style:{colors:'#527193',fontFamily:'monospace',fontSize:'9px'},rotate:0,hideOverlappingLabels:true},tickAmount:5,axisBorder:{show:false},axisTicks:{show:false}},
    yaxis:{labels:{style:{colors:'#527193',fontFamily:'monospace',fontSize:'10px'},formatter:v=>`$${v.toFixed(2)}T`}},
    theme:{mode:'dark'},
    tooltip:{theme:'dark',y:{formatter:v=>`$${v.toFixed(3)}T`}},
    dataLabels:{enabled:false},
  };
}

export default function Dashboard() {
  const [stock, setStock] = useState({});
  const [heatUS, setHeatUS] = useState({});
  const [heatKR, setHeatKR] = useState({});
  const [liquidity, setLiquidity] = useState({});
  const [syncTime, setSyncTime] = useState('대기 중...');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [treemapWidth, setTreemapWidth] = useState(860);
  const chartsRef = useRef({});
  const chartsInitRef = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => {
      if (containerRef.current) setTreemapWidth(containerRef.current.offsetWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mounted]);

  const fetchStockAndHeatmap = useCallback(async () => {
    try {
      const r = await fetch('/api/stock');
      const d = await r.json();
      setStock(d);
      const usMap = {};
      Object.entries(d.heatUS ?? {}).forEach(([sym, v]) => { usMap[sym] = v?.chg ?? null; });
      setHeatUS(usMap);
      const krMap = {};
      Object.entries(d.heatKR ?? {}).forEach(([code, v]) => { krMap[code] = v?.chg ?? null; });
      setHeatKR(krMap);
    } catch {}
  }, []);

  const fetchLiquidity = useCallback(async () => {
    try { const r = await fetch('/api/liquidity'); setLiquidity(await r.json()); } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true); setSyncTime('동기화 중...');
    await Promise.all([fetchStockAndHeatmap(), fetchLiquidity()]);
    setSyncTime(new Date().toLocaleTimeString('ko-KR'));
    setLoading(false);
  }, [fetchStockAndHeatmap, fetchLiquidity]);

  useEffect(() => { if (mounted) fetchAll(); }, [mounted, fetchAll]);

  useEffect(() => {
    if (!mounted || !liquidity?.series) return;
    let destroyed = false;
    const init = async () => {
      const ApexCharts = (await import('apexcharts')).default;
      if (destroyed) return;
      const { series } = liquidity;
      if (!chartsInitRef.current) {
        chartsInitRef.current = true;
        for (const key of ['net','fed','tga','rrp']) {
          if (destroyed) break;
          const el = document.getElementById(`chart-${key}`);
          if (!el || el.children.length > 0) continue;
          const meta = CHART_DESC[key];
          try { const c = new ApexCharts(el, buildApexConfig(meta.color, series[key], meta.label)); await c.render(); chartsRef.current[key]=c; } catch {}
        }
      } else {
        for (const key of ['net','fed','tga','rrp']) {
          const c = chartsRef.current[key];
          if (!c) continue;
          try { c.updateSeries([{data: series[key].map(d=>d.y)}]); } catch {}
        }
      }
    };
    init();
    return () => { destroyed = true; };
  }, [mounted, liquidity]);

  const cur = liquidity?.current ?? {};
  const s = stock;
  const isRisk = s.soxChg!=null && s.soxChg<=-3;
  const newsFeed = buildNewsFeed(s);

  // 트리맵용 데이터 가공
  const usSectorsWithChg = US_SECTORS.map(sec => ({
    sector: sec.sector,
    items: sec.items.map(item => ({ ...item, chg: heatUS[item.sym] ?? null })),
  }));
  const krTreemapData = KR_STOCKS.map(item => ({
    ...item, sym: item.code, chg: heatKR[item.code] ?? null,
  }));

  if (!mounted) return null;

  return (
    <>
      <Head><title>Macro Intelligence Dashboard</title><meta name="viewport" content="width=device-width, initial-scale=1.0"/></Head>
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

      <div style={{maxWidth:900,margin:'0 auto',padding:16,paddingBottom:80}} ref={containerRef}>

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
                  <span style={{fontSize:10,color:'#475569',fontFamily:'monospace',whiteSpace:'nowrap'}}>네이버 경제</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* 마켓 티커 */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h2 style={{fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:'0.1em',textTransform:'uppercase',margin:0}}>🌐 LIVE MARKET TICKER</h2>
          <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>미국: Yahoo Finance · 한국: 네이버 금융</span>
        </div>
        <div className="grid4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24}}>
          {[
            {label:'나스닥100 (QQQ)',val:s.nasdaq,chg:s.nasdaqChg},
            {label:'나스닥100 선물',val:s.nasdaqFut,chg:s.nasdaqFutChg},
            {label:'S&P 500 (SPY)',val:s.sp500,chg:s.sp500Chg},
            {label:'필라델피아 반도체',val:s.sox,chg:s.soxChg},
            {label:'KOSPI200 야간선물',val:s.kospiFut,chg:s.kospiFutChg},
            {label:'엔비디아 (NVDA)',val:s.nvda,chg:s.nvdaChg},
            {label:'삼성전자',val:s.samsung,chg:s.samsungChg,digits:0,krw:true},
            {label:'SK하이닉스',val:s.hynix,chg:s.hynixChg,digits:0,krw:true},
          ].map((item,i)=>(
            <div key={i} className="card" style={{display:'flex',flexDirection:'column',gap:4}}>
              <span style={{fontSize:11,fontWeight:700,color:'#94a3b8'}}>{item.label}</span>
              <span style={{fontSize:15,fontWeight:900,color:'#fff',fontFamily:'monospace'}}>
                {item.val==null?'--':`${item.krw?'₩':''}${item.val.toLocaleString('ko-KR',{maximumFractionDigits:item.digits??2})}`}
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

        {/* ── 순유동성: 설명 + 헤드라인 수치 ── */}
        <div className="card" style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
            <span style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>REALTIME NET LIQUIDITY INDEX</span>
            <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>출처: FRED / US Treasury</span>
          </div>
          <div style={{fontSize:28,fontFamily:'monospace',fontWeight:900,color:'#00e87a'}}>{fmtT(cur.netLiquidity)}</div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:6,marginBottom:10,lineHeight:1.6}}>
            <b style={{color:'#00e87a'}}>순유동성</b> = Fed 총자산 − TGA(재무부 잔고) − RRP(역레포). 시중에 실제로 풀려서 주식·자산시장으로 흘러들어갈 수 있는 돈의 양을 나타내요. <b>수치가 늘어나면 위험자산(주식·코인 등)에 우호적</b>이고, 줄어들면 긴축적인 환경이에요.
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:8,paddingTop:12,borderTop:'1px solid #1e293b',textAlign:'center'}}>
            {[{label:'Fed 총자산',val:cur.fed,color:'#ff4a5a'},{label:'TGA 재무부',val:cur.tga,color:'#2563eb'},{label:'RRP 역레포',val:cur.rrp,color:'#a855f7'},{label:'미국 MMF',val:cur.mmf,color:'#f59e0b'}].map((item,i)=>(
              <div key={i}><span style={{fontSize:10,color:'#64748b',display:'block',marginBottom:2}}>{item.label}</span><span style={{fontSize:12,fontFamily:'monospace',fontWeight:700,color:item.color}}>{fmtT(item.val)}</span></div>
            ))}
          </div>
        </div>

        {/* ── 순유동성 그래프 (큰 메인 차트) ── */}
        <div className="card" style={{marginBottom:24}}>
          <div style={{fontSize:11,fontWeight:700,color:'#00e87a',display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'#00e87a',display:'inline-block'}}/>실질 가용 순유동성 추이
          </div>
          <div style={{fontSize:10,color:'#64748b',marginBottom:10,lineHeight:1.5}}>
            최근 변화 흐름을 시계열로 보여줘요. 상승 추세면 유동성 공급 국면, 하락 추세면 유동성 회수(긴축) 국면이에요.
          </div>
          <div id="chart-net" style={{width:'100%',height:200}}/>
        </div>

        {/* ── 미국 히트맵 (섹터별 트리맵) ── */}
        <div style={{marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>🇺🇸 미국 섹터별 히트맵 (타일 크기 = 시총 비례)</h3>
          <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>클릭 시 Yahoo Finance</span>
        </div>
        <div className="card" style={{marginBottom:16, overflow:'hidden'}}>
          <SectorTreemapGrid
            sectors={usSectorsWithChg}
            totalWidth={treemapWidth - 28}
            onTileClick={(t) => window.open(`https://finance.yahoo.com/quote/${t.sym}`, '_blank')}
          />
          <div style={{display:'flex',alignItems:'center',gap:4,marginTop:12,paddingTop:10,borderTop:'1px solid #1e293b',justifyContent:'center',flexWrap:'wrap'}}>
            {[['#841414','-3%↓'],['#a82424','-3%'],['#c43838','-2%'],['#d94f4f','-1%'],['#3a4150','0%'],['#1fcf78','+0.3%'],['#13b768','+1%'],['#0fa05a','+2%'],['#0d8a4f','+3%↑']].map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:3}}><div style={{width:12,height:12,borderRadius:2,background:c}}/><span style={{fontSize:9,color:'#64748b',fontFamily:'monospace'}}>{l}</span></div>
            ))}
          </div>
        </div>

        {/* ── 한국 히트맵 (트리맵) ── */}
        <div style={{marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>🇰🇷 한국 코스피 대형주 히트맵 (타일 크기 = 시총 비례)</h3>
          <span style={{fontSize:10,color:'#475569',fontFamily:'monospace'}}>클릭 시 네이버 금융</span>
        </div>
        <div className="card" style={{marginBottom:24, overflow:'hidden'}}>
          <Treemap
            items={krTreemapData}
            width={treemapWidth - 28}
            height={220}
            onTileClick={(t) => window.open(`https://finance.naver.com/item/main.naver?code=${t.sym}`, '_blank')}
          />
        </div>

        {/* ── 나머지 유동성 차트 3개 ── */}
        <div style={{marginBottom:14}}>
          <h3 style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',margin:0}}>📈 Fed 유동성 구성요소 상세</h3>
        </div>
        <div className="grid2" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
          {['fed','tga','rrp'].map(key=>{
            const meta = CHART_DESC[key];
            return (
              <div key={key} className="card">
                <div style={{fontSize:11,fontWeight:700,color:meta.color,display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:meta.color,display:'inline-block'}}/>{meta.label}
                </div>
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