// pages/index.js
import Head from 'next/head';
import { useEffect, useRef, useState, useCallback } from 'react';

const fmtT = (v) => v == null ? '--' : `$${v.toFixed(3)}T`;

function ChangeLabel({ value, small = false }) {
  if (value == null) return <span style={{ color: '#64748b', fontSize: small ? 10 : 11 }}>--</span>;
  const pos = value >= 0;
  return (
    <span style={{ color: pos ? '#00e87a' : '#ff4a5a', fontSize: small ? 10 : 11, fontFamily: 'monospace', fontWeight: 700 }}>
      {pos ? '▲ +' : '▼ '}{Math.abs(value).toFixed(2)}%
    </span>
  );
}

const NEWS_FEED = [
  { cat: '반도체/AI', title: '삼성전자·SK하이닉스 외국인 수급 실시간 동향', provider: '네이버 금융', url: `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('삼성전자 SK하이닉스 외국인 매도')}` },
  { cat: '거시경제', title: '美 연준 유동성 공급 동향 및 뉴욕증시 분석', provider: '네이버 경제', url: `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('미국 연준 순유동성 뉴욕증시')}` },
  { cat: '외환/환율', title: '원달러 환율 방향성 및 국장 자금 흐름 점검', provider: '네이버 경제', url: `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent('원달러 환율 급등 증시 영향')}` },
  { cat: '증권종합', title: 'KOSPI200 야간선물 연동 오늘 증시 시나리오', provider: '네이버 금융', url: 'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=101' },
  { cat: '실시간이슈', title: 'MMF 대기자금 동향 및 글로벌 리스크 센티먼트', provider: '네이트 속보', url: 'https://news.nate.com/recent?mid=n0301' },
];

function buildApexConfig(color, seriesData, name) {
  const categories = seriesData.map(d => (d.x || '').slice(5));
  const values = seriesData.map(d => d.y);
  return {
    chart: { type: 'line', height: 160, toolbar: { show: false }, background: 'transparent', animations: { enabled: true, speed: 600 } },
    grid: { strokeDashArray: 4, borderColor: '#14243b', padding: { top: 5, bottom: 5, left: 10, right: 10 } },
    stroke: { curve: 'smooth', width: 2.5 },
    colors: [color],
    fill: { type: 'gradient', gradient: { shade: 'dark', type: 'vertical', shadeIntensity: 0.5, gradientToColors: ['transparent'], stops: [0, 100] } },
    series: [{ name, data: values }],
    xaxis: { categories, labels: { style: { colors: '#527193', fontFamily: 'monospace', fontSize: '10px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: '#527193', fontFamily: 'monospace', fontSize: '10px' }, formatter: v => `$${v.toFixed(2)}T` } },
    theme: { mode: 'dark' },
    tooltip: { theme: 'dark', y: { formatter: v => `$${v.toFixed(3)}T` } },
  };
}

export default function Dashboard() {
  const [stock, setStock] = useState({});
  const [liquidity, setLiquidity] = useState({});
  const [syncTime, setSyncTime] = useState('대기 중...');
  const [loading, setLoading] = useState(false);
  const chartsRef = useRef({});
  const chartsInitRef = useRef(false);
  const apexRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setSyncTime('동기화 중...');
    try {
      const [sRes, lRes] = await Promise.allSettled([
        fetch('/api/stock').then(r => r.json()),
        fetch('/api/liquidity').then(r => r.json()),
      ]);
      if (sRes.status === 'fulfilled') setStock(sRes.value);
      if (lRes.status === 'fulfilled') setLiquidity(lRes.value);
      setSyncTime(new Date().toLocaleTimeString('ko-KR'));
    } catch {
      setSyncTime('연동 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!liquidity?.series) return;

    const initCharts = async () => {
      if (!apexRef.current) {
        apexRef.current = (await import('apexcharts')).default;
      }
      const ApexCharts = apexRef.current;
      const { series } = liquidity;

      const configs = [
        { id: 'chart-net', color: '#00e87a', data: series.net, name: '실질 순유동성' },
        { id: 'chart-fed', color: '#ff4a5a', data: series.fed, name: 'Fed 총자산' },
        { id: 'chart-tga', color: '#2563eb', data: series.tga, name: 'TGA 잔고' },
        { id: 'chart-rrp', color: '#a855f7', data: series.rrp, name: 'RRP 역레포' },
      ];

      if (!chartsInitRef.current) {
        chartsInitRef.current = true;
        for (const cfg of configs) {
          const el = document.getElementById(cfg.id);
          if (!el) continue;
          const chart = new ApexCharts(el, buildApexConfig(cfg.color, cfg.data, cfg.name));
          await chart.render();
          chartsRef.current[cfg.id] = chart;
        }
      } else {
        for (const cfg of configs) {
          const chart = chartsRef.current[cfg.id];
          if (!chart) continue;
          chart.updateSeries([{ data: cfg.data.map(d => d.y) }]);
        }
      }
    };

    initCharts();
  }, [liquidity]);

  const cur = liquidity?.current ?? {};
  const s = stock;
  const isRisk = s.soxChg != null && s.soxChg <= -3;

  return (
    <>
      <Head>
        <title>Macro Intelligence Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #040c14; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #cbd5e1; }
        .card { background: #0b1523; border: 1px solid #1e293b; border-radius: 12px; padding: 14px; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .apexcharts-tooltip { background: #111e31 !important; border: 1px solid #1e3656 !important; color: #fff !important; }
        @media(max-width:640px){
          .grid4{grid-template-columns:repeat(2,1fr)!important;}
          .grid2{grid-template-columns:1fr!important;}
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16, paddingBottom: 80 }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #1e293b', paddingBottom:20, marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:18, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
              📊 Macro & Stock Live Dashboard
            </h1>
            <p style={{ fontSize:11, color:'#64748b', marginTop:4, fontFamily:'monospace' }}>
              최종 동기화: <span style={{ color:'#00e87a', fontWeight:700 }}>{syncTime}</span>
            </p>
          </div>
          <button onClick={fetchAll} disabled={loading}
            style={{ background: loading?'#1e3a5f':'#2563eb', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:12, fontWeight:700, cursor: loading?'wait':'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <span style={loading ? { display:'inline-block', animation:'spin 1s linear infinite' } : {}}>↻</span>
            실시간 데이터 업데이트
          </button>
        </div>

        {/* 브리핑 */}
        <div style={{ background: isRisk?'linear-gradient(135deg,#1a0f1a,#081220)':'linear-gradient(135deg,#0b1b32,#081220)', border: isRisk?'1px solid rgba(255,74,90,0.3)':'1px solid rgba(37,99,235,0.2)', borderRadius:16, padding:20, marginBottom:24 }}>
          <h2 style={{ fontSize:11, fontWeight:700, color: isRisk?'#ff4a5a':'#3b82f6', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 12px', display:'flex', alignItems:'center', gap:8 }}>
            <span className="pulse" style={{ width:6, height:6, borderRadius:'50%', background: isRisk?'#ff4a5a':'#3b82f6', display:'inline-block' }} />
            실시간 매크로 분석 브리핑
          </h2>
          <div style={{ background:'rgba(4,12,20,0.5)', borderRadius:8, padding:'10px 14px', border:'1px solid rgba(30,54,86,0.6)', fontSize:13, color:'#e2e8f0', fontWeight:500 }}>
            {isRisk
              ? '🚨 반도체 섹터 급락 리스크: 필반 지수 변동성 극대화. 고멀티플 기술주 중심 출회 강도 상승 중.'
              : cur.netLiquidity != null
                ? `📈 가용 순유동성 ${fmtT(cur.netLiquidity)} 유지. TGA ${fmtT(cur.tga)} / RRP ${fmtT(cur.rrp)} — Fed 유동성 공급 정상 궤도.`
                : '📊 업데이트 버튼을 눌러 최신 데이터를 가져오세요.'
            }
          </div>
          <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid #1e293b' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:10, display:'flex', justifyContent:'space-between' }}>
              <span>📌 분야별 실시간 주요 뉴스</span>
              <span style={{ color:'#00e87a', fontSize:10, fontFamily:'monospace' }}>클릭 시 언론사 배열 이동</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {NEWS_FEED.map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(4,12,20,0.7)', border:'1px solid rgba(30,54,86,0.8)', borderRadius:10, padding:'10px 12px', textDecoration:'none', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
                    <span style={{ fontSize:10, background:'#1e293b', color:'#cbd5e1', padding:'2px 8px', borderRadius:4, fontWeight:700, whiteSpace:'nowrap' }}>{n.cat}</span>
                    <span style={{ fontSize:12, color:'#cbd5e1', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title}</span>
                  </div>
                  <span style={{ fontSize:10, color:'#475569', fontFamily:'monospace', whiteSpace:'nowrap' }}>{n.provider}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* 마켓 티커 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <h2 style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.1em', textTransform:'uppercase', margin:0 }}>🌐 LIVE MARKET TICKER</h2>
          <span style={{ fontSize:10, color:'#475569', fontFamily:'monospace' }}>출처: Yahoo Finance</span>
        </div>
        <div className="grid4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
          {[
            { label:'나스닥 종합', val:s.nasdaq, chg:s.nasdaqChg },
            { label:'나스닥100 선물', val:s.nasdaqFut, chg:s.nasdaqFutChg },
            { label:'S&P 500', val:s.sp500, chg:s.sp500Chg },
            { label:'필라델피아 반도체', val:s.sox, chg:s.soxChg },
            { label:'KOSPI200 야간선물', val:s.kospiFut, chg:s.kospiFutChg },
            { label:'엔비디아 (NVDA)', val:s.nvda, chg:s.nvdaChg },
            { label:'삼성전자', val:s.samsung, chg:s.samsungChg, digits:0 },
            { label:'SK하이닉스', val:s.hynix, chg:s.hynixChg, digits:0 },
          ].map((item, i) => (
            <div key={i} className="card" style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>{item.label}</span>
              <span style={{ fontSize:15, fontWeight:900, color:'#fff', fontFamily:'monospace' }}>
                {item.val == null ? '--' : item.val.toLocaleString('en-US', { maximumFractionDigits: item.digits ?? 2 })}
              </span>
              <ChangeLabel value={item.chg} />
            </div>
          ))}
        </div>

        {/* 보조 지표 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
          <div className="card">
            <span style={{ fontSize:10, fontWeight:700, color:'#fb923c' }}>CBOE VIX (공포지수)</span>
            <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#fff', marginTop:4 }}>
              {s.vix?.toFixed(2) ?? '--'} <ChangeLabel value={s.vixChg} small />
            </div>
          </div>
          <div className="card">
            <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b' }}>국제유가 (WTI)</span>
            <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#fff', marginTop:4 }}>
              ${s.wti?.toFixed(2) ?? '--'} <ChangeLabel value={s.wtiChg} small />
            </div>
          </div>
          <div className="card">
            <span style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>원/달러 환율</span>
            <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#fff', marginTop:4 }}>
              ₩{s.usdkrw?.toFixed(1) ?? '--'} <ChangeLabel value={s.usdkrwChg} small />
            </div>
          </div>
        </div>

        {/* 순유동성 */}
        <div className="card" style={{ marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>REALTIME NET LIQUIDITY INDEX</span>
            <span style={{ fontSize:10, color:'#475569', fontFamily:'monospace' }}>출처: FRED / US Treasury</span>
          </div>
          <div style={{ fontSize:28, fontFamily:'monospace', fontWeight:900, color:'#00e87a' }}>{fmtT(cur.netLiquidity)}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:12, paddingTop:12, borderTop:'1px solid #1e293b', textAlign:'center' }}>
            {[
              { label:'Fed 총자산', val:cur.fed, color:'#ff4a5a' },
              { label:'TGA 재무부', val:cur.tga, color:'#2563eb' },
              { label:'RRP 역레포', val:cur.rrp, color:'#a855f7' },
              { label:'미국 MMF', val:cur.mmf, color:'#f59e0b' },
            ].map((item, i) => (
              <div key={i}>
                <span style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:2 }}>{item.label}</span>
                <span style={{ fontSize:12, fontFamily:'monospace', fontWeight:700, color:item.color }}>{fmtT(item.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 차트 */}
        <div style={{ marginBottom:14 }}>
          <h3 style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', margin:0 }}>📈 지표별 시계열 트렌드 (단위: $T)</h3>
        </div>
        <div className="grid2" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
          {[
            { id:'chart-net', label:'실질 가용 순유동성 추이', color:'#00e87a' },
            { id:'chart-fed', label:'Fed 총자산 (Balance Sheet)', color:'#ff4a5a' },
            { id:'chart-tga', label:'TGA 재무부 일반계정 잔고', color:'#2563eb' },
            { id:'chart-rrp', label:'RRP 연준 역레포 잔고', color:'#a855f7' },
          ].map(cfg => (
            <div key={cfg.id} className="card">
              <div style={{ fontSize:11, fontWeight:700, color:cfg.color, display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:cfg.color, display:'inline-block' }} />
                {cfg.label}
              </div>
              <div id={cfg.id} style={{ width:'100%', height:160 }} />
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
