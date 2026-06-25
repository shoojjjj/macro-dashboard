import { readCustomWatchlist } from './watchlistCustom';

export const WATCHLIST_KR = [
  { code: '005930', label: '삼성전자' },
  { code: '000660', label: 'SK하이닉스' },
  { code: '034220', label: 'LG디스플레이' },
  { code: '243880', label: 'TIGER 200IT레버리지' },
  { code: '034020', label: '두산에너빌리티' },
  { code: '043260', label: '성호전자' },
  { code: '080220', label: '제주반도체' },
  { code: '377300', label: '카카오페이' },
  { code: '233740', label: 'KODEX 코스닥150레버리지' },
  { code: '760026', label: '키움 레버리지 전력TOP5' },
  { code: '234340', label: '헥토파이낸셜' },
];

export const WATCHLIST_US = [
  { sym: 'IONQ', label: '아이온큐' },
  { sym: 'SPCX', label: '스페이스X' },
  { sym: 'SATL', label: '세틀로직' },
  { sym: 'CRCA', label: 'CRCA' },
  { sym: 'BMNU', label: 'BMNU' },
  { sym: 'QCOM', label: '퀄컴' },
  { sym: 'IREN', label: '아이렌' },
  { sym: 'LITE', label: '루멘텀' },
  { sym: 'SNDK', label: '샌드스크' },
  { sym: 'MU', label: '마이크론' },
  { sym: 'MRVL', label: '마벨' },
  { sym: 'CRDO', label: '크리도' },
];

function mergeUnique(base, extra, key) {
  const seen = new Set(base.map((x) => x[key]));
  return [...base, ...extra.filter((x) => !seen.has(x[key]))];
}

export function getMergedWatchlistKR() {
  const custom = readCustomWatchlist();
  const hidden = new Set(custom.hiddenKr || []);
  const base = WATCHLIST_KR.filter((x) => !hidden.has(x.code));
  return mergeUnique(base, custom.kr, 'code');
}

export function getMergedWatchlistUS() {
  const custom = readCustomWatchlist();
  const hidden = new Set(custom.hiddenUs || []);
  const base = WATCHLIST_US.filter((x) => !hidden.has(x.sym));
  return mergeUnique(base, custom.us, 'sym');
}
