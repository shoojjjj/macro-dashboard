# Macro Intelligence & Liquidity Dashboard

실시간 매크로 유동성 + 글로벌 주식 지수 대시보드

## 데이터 소스

- **주식/지수/선물/환율**: Yahoo Finance + 네이버 금융 (무료, API 키 불필요)
- **Fed 유동성 (FRED)**: WALCL / WTREGEN / RRPONTSYD / WRMFSL
- **경제 뉴스**: 네이버 경제 섹션 실시간 헤드라인

## 실시간 갱신

| 데이터 | 갱신 주기 |
|--------|-----------|
| 주식/지수 시세 | 60초 자동 + 수동 새로고침 |
| 경제 뉴스 | 60초 자동 |
| FRED 유동성 | 1시간 캐시 |

## 로컬 실행

```bash
npm install
cp .env.example .env   # FRED_API_KEY 설정
npm run dev
# → http://localhost:3000
```

## Vercel 배포

### 1. GitHub에 푸시

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/macro-dashboard.git
git push -u origin main
```

### 2. Vercel 프로젝트 연결

1. [vercel.com](https://vercel.com) → **Add New Project**
2. GitHub 저장소 `macro-dashboard` 선택
3. Framework: **Next.js** (자동 감지)

### 3. 환경변수 설정

Vercel 프로젝트 **Settings → Environment Variables**:

```
FRED_API_KEY = your_fred_api_key_here
```

[FRED API 키 발급](https://fred.stlouisfed.org/docs/api/api_key.html)

### 4. Deploy

Deploy 버튼 클릭 → `https://your-project.vercel.app` 에서 확인

## API 엔드포인트

| 경로 | 설명 | 캐시 |
|------|------|------|
| `/api/stock` | 주식/지수/선물/환율 | 1분 |
| `/api/liquidity?period=week` | Fed 유동성 (day/week/month) | 1시간 |
| `/api/news` | 네이버 경제 헤드라인 | 5분 |

## 연동 지표

- 나스닥100, S&P500, 반도체, VIX, WTI, 원달러
- KOSPI200, KOSPI200 야간선물, 코스닥150
- 삼성전자, SK하이닉스, 엔비디아
