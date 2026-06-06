# Macro Intelligence & Liquidity Dashboard

실시간 매크로 유동성 + 글로벌 주식 지수 대시보드

## 데이터 소스
- **주식/지수/선물/환율**: Yahoo Finance (무료, API 키 불필요)
- **Fed 유동성 (FRED)**: WALCL / WTREGEN / RRPONTSYD / WRMFSL

## 로컬 실행

```bash
npm install
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

### 2. Vercel 환경변수 설정
Vercel 프로젝트 Settings → Environment Variables:
```
FRED_API_KEY = ae86e8b30990c34d7eb5e444e2b442c0
```

### 3. Deploy
Vercel에서 GitHub 레포 연결 → 자동 배포

## API 엔드포인트

| 경로 | 설명 | 캐시 |
|------|------|------|
| `/api/stock` | 주식/지수/선물/환율 (Yahoo Finance) | 5분 |
| `/api/liquidity` | Fed/TGA/RRP/MMF (FRED) | 1시간 |

## 연동 지표

### 주식 (Yahoo Finance)
- 나스닥 종합 (`^IXIC`)
- 나스닥 100 선물 (`NQ=F`)
- S&P 500 (`^GSPC`)
- 필라델피아 반도체 (`^SOX`)
- KOSPI200 야간선물 (`KM=F`)
- 엔비디아 NVDA
- 삼성전자 (`005930.KS`)
- SK하이닉스 (`000660.KS`)
- VIX 공포지수 (`^VIX`)
- WTI 원유 (`CL=F`)
- 원달러 환율 (`USDKRW=X`)

### FRED 유동성
- Fed 총자산: `WALCL`
- TGA 재무부: `WTREGEN`
- RRP 역레포: `RRPONTSYD`
- MMF 잔고: `WRMFSL`
- **Net Liquidity = Fed - TGA - RRP**
