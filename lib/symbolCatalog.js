import { WATCHLIST_KR, WATCHLIST_US } from './watchlist';
import { KR_SECTORS, US_SECTORS } from './sectorStocks';
import krIndexUniverse from './krIndexUniverse.json';

/** 섹터·관심종목 외 검색용 확장 (별칭 포함) */
export const EXTENDED_KR = [
  { code: '011070', label: 'LG이노텍', aliases: ['lg이노텍', '이노텍'] },
  { code: '267260', label: 'HD현대일렉트릭', aliases: ['hd현대일렉트릭', 'hd현대일렉', '현대일렉트릭'] },
  { code: '000990', label: 'DB하이텍', aliases: ['db하이텍'] },
  { code: '329180', label: 'HD현대중공업', aliases: ['hd현대중공업'] },
  { code: '443060', label: 'HD현대마린솔루션', aliases: ['hd현대마린'] },
  { code: '042670', label: 'HD현대인프라코어', aliases: ['hd현대인프라'] },
  { code: '010120', label: 'LS ELECTRIC', aliases: ['ls일렉트릭', 'ls전선'] },
  { code: '298040', label: '효성중공업', aliases: [] },
  { code: '103590', label: '일진전기', aliases: [] },
  { code: '006260', label: 'LS', aliases: ['ls'] },
  { code: '042700', label: '한미반도체', aliases: [] },
  { code: '403870', label: 'HPSP', aliases: [] },
  { code: '058470', label: '리노공업', aliases: [] },
  { code: '240810', label: '원익IPS', aliases: ['원익'] },
  { code: '095340', label: 'ISC', aliases: [] },
  { code: '089030', label: '테크윙', aliases: [] },
  { code: '036540', label: 'SFA반도체', aliases: [] },
  { code: '097900', label: '미코', aliases: [] },
  { code: '039030', label: '이오테크닉스', aliases: [] },
  { code: '067310', label: '하나마이크론', aliases: [] },
  { code: '007660', label: '이수페타시스', aliases: [] },
  { code: '178320', label: '서진시스템', aliases: [] },
  { code: '222080', label: '씨아이에스', aliases: ['cis'] },
  { code: '131970', label: '두산테스나', aliases: [] },
  { code: '000150', label: '두산', aliases: ['두산홀딩스'] },
  { code: '009830', label: '한화솔루션', aliases: [] },
  { code: '000880', label: '한화', aliases: [] },
  { code: '086520', label: '에코프로', aliases: [] },
  { code: '247540', label: '에코프로비엠', aliases: ['ecoprobm'] },
  { code: '066970', label: '엘앤에프', aliases: ['엘앤에프', 'lf'] },
  { code: '196170', label: '알테오젠', aliases: [] },
  { code: '028300', label: 'HLB', aliases: [] },
  { code: '141080', label: '레고켐바이오', aliases: [] },
  { code: '068760', label: '셀트리온제약', aliases: [] },
  { code: '003490', label: '대한항공', aliases: [] },
  { code: '086280', label: '현대글로비스', aliases: [] },
  { code: '036570', label: '엔씨소프트', aliases: ['ncsoft', 'nc'] },
  { code: '263750', label: '펄어비스', aliases: [] },
  { code: '259960', label: '크래프톤', aliases: ['krafton'] },
  { code: '251270', label: '넷마블', aliases: [] },
  { code: '035900', label: 'JYP Ent.', aliases: ['jyp'] },
  { code: '041510', label: 'SM', aliases: ['에스엠'] },
  { code: '071050', label: '한국금융지주', aliases: [] },
  { code: '024110', label: '기업은행', aliases: ['ibk', 'ibk기업은행'] },
  { code: '323410', label: '카카오뱅크', aliases: [] },
  { code: '377300', label: '카카오페이', aliases: [] },
  { code: '161390', label: '한국타이어', aliases: ['한국타이어앤테크놀로지', 'hankook'] },
  { code: '204320', label: 'HL만도', aliases: [] },
  { code: '018880', label: '한온시스템', aliases: [] },
  { code: '011210', label: '현대위아', aliases: [] },
  { code: '011200', label: 'HMM', aliases: [] },
  { code: '028050', label: '삼성E&A', aliases: ['삼성엔지니어링'] },
  { code: '012750', label: '한솔케미칼', aliases: [] },
  { code: '112610', label: '씨에스윈드', aliases: [] },
  { code: '083650', label: '비에이치아이', aliases: ['bhi'] },
  { code: '028670', label: '팬오션', aliases: [] },
  { code: '022100', label: '포스코DX', aliases: [] },
  { code: '011790', label: 'SKC', aliases: [] },
  { code: '018260', label: '삼성에스디에스', aliases: ['삼성sds'] },
  { code: '032830', label: '삼성생명', aliases: [] },
  { code: '003550', label: 'LG', aliases: [] },
  { code: '003230', label: '삼양식품', aliases: [] },
  { code: '088980', label: '맥쿼리인프라', aliases: [] },
  { code: '043260', label: '성호전자', aliases: [] },
  { code: '080220', label: '제주반도체', aliases: [] },
  { code: '234340', label: '헥토파이낸셜', aliases: ['헥토'] },
  { code: '243880', label: 'TIGER 200IT레버리지', aliases: ['it레버리지'] },
  { code: '233740', label: 'KODEX 코스닥150레버리지', aliases: ['코스닥레버리지'] },
  { code: '760026', label: '키움 레버리지 전력TOP5', aliases: ['전력top5'] },
  { code: '207940', label: '삼성바이오로직스', aliases: ['삼바', '삼성바이오'] },
  { code: '012450', label: '한화에어로스페이스', aliases: ['한화에어로', '한화에어로스'] },
  { code: '012330', label: '현대모비스', aliases: [] },
  { code: '005380', label: '현대차', aliases: ['현대자동차'] },
  { code: '035420', label: '네이버', aliases: ['naver'] },
  { code: '373220', label: 'LG에너지솔루션', aliases: ['lges'] },
  { code: '051910', label: 'LG화학', aliases: ['lg화학'] },
  { code: '034220', label: 'LG디스플레이', aliases: ['lg디스플레이'] },
  { code: '066570', label: 'LG전자', aliases: ['lg전자'] },
  { code: '006400', label: '삼성SDI', aliases: ['삼성sdi'] },
  { code: '009150', label: '삼성전기', aliases: [] },
  { code: '005930', label: '삼성전자', aliases: [] },
  { code: '000660', label: 'SK하이닉스', aliases: ['sk하이닉스', '하이닉스'] },
  { code: '034020', label: '두산에너빌리티', aliases: ['두산에너빌'] },
  { code: '105560', label: 'KB금융', aliases: [] },
  { code: '055550', label: '신한지주', aliases: [] },
  { code: '000270', label: '기아', aliases: [] },
  { code: '035720', label: '카카오', aliases: [] },
];

export const EXTENDED_US = [
  { sym: 'NVDA', label: '엔VIDIA', aliases: ['nvidia'] },
  { sym: 'AAPL', label: '애플', aliases: ['apple'] },
  { sym: 'MSFT', label: '마이크로소프트', aliases: ['microsoft'] },
  { sym: 'GOOGL', label: '구글', aliases: ['google', 'alphabet'] },
  { sym: 'GOOG', label: '구글 C', aliases: [] },
  { sym: 'META', label: '메타', aliases: ['facebook'] },
  { sym: 'AMZN', label: '아마존', aliases: ['amazon'] },
  { sym: 'TSLA', label: '테슬라', aliases: ['tesla'] },
  { sym: 'AMD', label: 'AMD', aliases: [] },
  { sym: 'AVGO', label: '브로드컴', aliases: ['broadcom'] },
  { sym: 'INTC', label: '인텔', aliases: ['intel'] },
  { sym: 'SNDK', label: '샌드스크', aliases: ['sandisk', 'sdsk', 'sndk'] },
  { sym: 'MU', label: '마이크론', aliases: ['micron'] },
  { sym: 'MRVL', label: '마벨', aliases: ['marvell'] },
  { sym: 'LITE', label: '루멘텀', aliases: ['lumentum'] },
  { sym: 'IONQ', label: '아이온큐', aliases: [] },
  { sym: 'CRDO', label: '크리도', aliases: [] },
  { sym: 'IREN', label: '아이렌', aliases: [] },
  { sym: 'QCOM', label: '퀄컴', aliases: ['qualcomm'] },
  { sym: 'ASML', label: 'ASML', aliases: [] },
  { sym: 'PLTR', label: '팔란티어', aliases: ['palantir'] },
  { sym: 'SMCI', label: '슈퍼마이크로', aliases: ['supermicro'] },
  { sym: 'ARM', label: 'ARM', aliases: [] },
  { sym: 'TSM', label: 'TSMC', aliases: ['tsmc'] },
  { sym: 'COIN', label: '코인베이스', aliases: ['coinbase'] },
  { sym: 'NFLX', label: '넷플릭스', aliases: ['netflix'] },
  { sym: 'CRM', label: '세일즈포스', aliases: ['salesforce'] },
  { sym: 'ORCL', label: '오라클', aliases: ['oracle'] },
  { sym: 'JPM', label: 'JP모건', aliases: [] },
  { sym: 'BAC', label: '뱅크오브아메리카', aliases: [] },
  { sym: 'SPY', label: 'S&P500 ETF', aliases: [] },
  { sym: 'QQQ', label: '나스닥100 ETF', aliases: [] },
  { sym: 'SOXX', label: '반도체 ETF', aliases: ['필반'] },
  { sym: 'SATL', label: '세틀로직', aliases: [] },
  { sym: 'SPCX', label: '스페이스X ETF', aliases: ['spacex'] },
  { sym: 'CRCA', label: 'CRCA', aliases: ['2x crwd'] },
  { sym: 'CRDU', label: 'CRDU', aliases: ['2x crdo'] },
  { sym: 'RAM', label: 'RAM', aliases: ['2x dram'] },
  { sym: 'BMNU', label: 'BMNU', aliases: [] },
  { sym: 'RDW', label: '레드와이어', aliases: ['redwire'] },
  { sym: 'CRWV', label: 'CoreWeave', aliases: ['coreweave'] },
  { sym: 'CRWD', label: 'CrowdStrike', aliases: [] },
  { sym: 'PANW', label: 'Palo Alto', aliases: [] },
  { sym: 'SNOW', label: 'Snowflake', aliases: [] },
  { sym: 'NOW', label: 'ServiceNow', aliases: [] },
  { sym: 'DELL', label: 'Dell', aliases: [] },
  { sym: 'VRT', label: 'Vertiv', aliases: [] },
  { sym: 'ETN', label: 'Eaton', aliases: [] },
  { sym: 'CEG', label: 'Constellation Energy', aliases: [] },
  { sym: 'GEV', label: 'GE Vernova', aliases: [] },
  { sym: 'APP', label: 'AppLovin', aliases: [] },
  { sym: 'ANET', label: 'Arista', aliases: [] },
  { sym: 'UBER', label: 'Uber', aliases: [] },
  { sym: 'ABNB', label: 'Airbnb', aliases: [] },
  { sym: 'SHOP', label: 'Shopify', aliases: [] },
  { sym: 'SOFI', label: 'SoFi', aliases: [] },
  { sym: 'ASTS', label: 'AST SpaceMobile', aliases: [] },
  { sym: 'RKLB', label: 'Rocket Lab', aliases: [] },
  { sym: 'TXN', label: 'Texas Instruments', aliases: [] },
  { sym: 'AMAT', label: 'Applied Materials', aliases: [] },
  { sym: 'LRCX', label: 'Lam Research', aliases: [] },
  { sym: 'ADI', label: 'Analog Devices', aliases: [] },
  { sym: 'ADBE', label: 'Adobe', aliases: [] },
  { sym: 'UNH', label: 'UnitedHealth', aliases: [] },
  { sym: 'LLY', label: 'Eli Lilly', aliases: [] },
  { sym: 'JNJ', label: 'Johnson & Johnson', aliases: [] },
  { sym: 'XOM', label: 'ExxonMobil', aliases: [] },
  { sym: 'CVX', label: 'Chevron', aliases: [] },
  { sym: 'RTX', label: 'RTX', aliases: [] },
  { sym: 'LMT', label: 'Lockheed Martin', aliases: [] },
  { sym: 'BA', label: 'Boeing', aliases: [] },
  { sym: 'CAT', label: 'Caterpillar', aliases: [] },
  { sym: 'GE', label: 'GE Aerospace', aliases: [] },
  { sym: 'WMT', label: 'Walmart', aliases: [] },
  { sym: 'COST', label: 'Costco', aliases: [] },
  { sym: 'V', label: 'Visa', aliases: [] },
  { sym: 'MA', label: 'Mastercard', aliases: [] },
  { sym: 'GS', label: 'Goldman Sachs', aliases: [] },
  { sym: 'MS', label: 'Morgan Stanley', aliases: [] },
  { sym: 'NKE', label: 'Nike', aliases: [] },
  { sym: 'DIS', label: 'Disney', aliases: [] },
  { sym: 'VZ', label: 'Verizon', aliases: [] },
  { sym: 'TMUS', label: 'T-Mobile', aliases: [] },
];

/** 티커 접두 검색용 (카탈로그에 없어도 US 티커 후보) */
export const US_PREFIX_TICKERS = [
  ...new Set([
    ...EXTENDED_US.map((x) => x.sym),
    'ABNB', 'ABT', 'ACN', 'ADI', 'ADSK', 'AEM', 'AMAT', 'ANET', 'APH', 'APP', 'ASAN', 'ASML', 'ASTS', 'ASX',
    'BA', 'BABA', 'BKNG', 'BLK', 'C', 'CAT', 'CEG', 'COP', 'COST', 'CRDU', 'CRWD', 'CRWV', 'CSCO', 'CVX',
    'DELL', 'DE', 'DIS', 'DUK', 'EA', 'ENPH', 'EOG', 'EQIX', 'ETN', 'F', 'FCX', 'GD', 'GE', 'GEV', 'GILD',
    'GM', 'GS', 'HD', 'HON', 'IBM', 'INTC', 'ISRG', 'JNJ', 'KO', 'LIN', 'LLY', 'LMT', 'LOW', 'LRCX', 'MA',
    'MCD', 'MDLZ', 'MRK', 'MS', 'NEE', 'NEM', 'NKE', 'NOC', 'NOW', 'NVDA', 'ORCL', 'OXY', 'PANW', 'PEP',
    'PFE', 'PG', 'PLD', 'PM', 'PYPL', 'QCOM', 'RAM', 'RDW', 'RIVN', 'RKLB', 'RTX', 'SATL', 'SBUX', 'SCHW',
    'SHOP', 'SLB', 'SMCI', 'SNOW', 'SO', 'SOFI', 'SPG', 'SQ', 'STLA', 'T', 'TMUS', 'TGT', 'TXN', 'UBER',
    'UNH', 'UPS', 'V', 'VRT', 'VZ', 'WFC', 'WMT', 'XOM',
  ]),
];

export const US_TICKER_ALIASES = {
  SDSK: 'SNDK',
};

function krKey(code) {
  return `kr:${code}`;
}

function usKey(sym) {
  return `us:${sym.toUpperCase()}`;
}

function mergeKrEntry(map, entry, aliases = []) {
  if (!entry?.code) return;
  const key = krKey(entry.code);
  const prev = map.get(key);
  const mergedAliases = [...new Set([...(prev?.aliases ?? []), ...(entry.aliases ?? aliases ?? [])])];
  map.set(key, {
    market: 'kr',
    code: entry.code,
    label: entry.label || prev?.label || entry.code,
    aliases: mergedAliases,
  });
}

function mergeUsEntry(map, entry, aliases = []) {
  if (!entry?.sym) return;
  const sym = String(entry.sym).toUpperCase();
  const key = usKey(sym);
  const prev = map.get(key);
  const mergedAliases = [...new Set([...(prev?.aliases ?? []), ...(entry.aliases ?? aliases ?? [])])];
  map.set(key, {
    market: 'us',
    sym,
    label: entry.label || prev?.label || sym,
    aliases: mergedAliases,
  });
}

/** 정적 소스(섹터·관심·확장) 병합 — 서버 기본 카탈로그 */
export function buildStaticSymbolCatalog() {
  const krMap = new Map();
  const usMap = new Map();

  WATCHLIST_KR.forEach((x) => mergeKrEntry(krMap, x));
  WATCHLIST_US.forEach((x) => mergeUsEntry(usMap, x));

  KR_SECTORS.forEach((sec) => {
    sec.items.forEach((item) => mergeKrEntry(krMap, item));
  });
  US_SECTORS.forEach((sec) => {
    sec.items.forEach((item) => mergeUsEntry(usMap, { ...item, label: item.label || item.sym }));
  });

  EXTENDED_KR.forEach((x) => mergeKrEntry(krMap, x));
  EXTENDED_US.forEach((x) => mergeUsEntry(usMap, x));

  (krIndexUniverse.items ?? []).forEach((x) => mergeKrEntry(krMap, x));

  return {
    kr: [...krMap.values()],
    us: [...usMap.values()],
  };
}

export function getCatalogStats(catalog = buildStaticSymbolCatalog()) {
  return {
    kr: catalog.kr.length,
    us: catalog.us.length,
    total: catalog.kr.length + catalog.us.length,
    krIndexUniverse: krIndexUniverse.sources ?? null,
    krIndexUpdatedAt: krIndexUniverse.updatedAt ?? null,
  };
}
