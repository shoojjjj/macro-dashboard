/** 섹터 히트맵 종목 (검색 DB·UI 공용) */
export const US_SECTORS = [
  { sector: '반도체', items: [
    { sym: 'NVDA', label: 'NVDA', mcap: 3200 }, { sym: 'AVGO', label: 'AVGO', mcap: 900 }, { sym: 'AMD', label: 'AMD', mcap: 290 },
    { sym: 'QCOM', label: 'QCOM', mcap: 180 }, { sym: 'MU', label: 'MU', mcap: 150 }, { sym: 'INTC', label: 'INTC', mcap: 120 },
    { sym: 'MRVL', label: 'MRVL', mcap: 80 }, { sym: 'TXN', label: 'TXN', mcap: 170 }, { sym: 'AMAT', label: 'AMAT', mcap: 160 }, { sym: 'LRCX', label: 'LRCX', mcap: 110 },
  ] },
  { sector: '빅테크/소프트웨어', items: [
    { sym: 'AAPL', label: 'AAPL', mcap: 3100 }, { sym: 'MSFT', label: 'MSFT', mcap: 2900 }, { sym: 'GOOGL', label: 'GOOGL', mcap: 2100 },
    { sym: 'META', label: 'META', mcap: 1400 }, { sym: 'AMZN', label: 'AMZN', mcap: 2000 }, { sym: 'ORCL', label: 'ORCL', mcap: 380 },
    { sym: 'CRM', label: 'CRM', mcap: 260 }, { sym: 'ADBE', label: 'ADBE', mcap: 220 },
  ] },
  { sector: '자동차', items: [
    { sym: 'TSLA', label: 'TSLA', mcap: 900 }, { sym: 'GM', label: 'GM', mcap: 55 }, { sym: 'F', label: 'F', mcap: 45 },
    { sym: 'STLA', label: 'STLA', mcap: 40 }, { sym: 'RIVN', label: 'RIVN', mcap: 12 },
  ] },
  { sector: '헬스케어', items: [
    { sym: 'UNH', label: 'UNH', mcap: 520 }, { sym: 'LLY', label: 'LLY', mcap: 750 }, { sym: 'JNJ', label: 'JNJ', mcap: 380 },
    { sym: 'PFE', label: 'PFE', mcap: 140 }, { sym: 'MRK', label: 'MRK', mcap: 280 }, { sym: 'ABBV', label: 'ABBV', mcap: 310 },
  ] },
  { sector: '2차전지/화학', items: [
    { sym: 'ALB', label: 'ALB', mcap: 12 }, { sym: 'SQM', label: 'SQM', mcap: 15 }, { sym: 'ENPH', label: 'ENPH', mcap: 18 },
    { sym: 'LIN', label: 'LIN', mcap: 210 }, { sym: 'APD', label: 'APD', mcap: 60 },
  ] },
  { sector: '에너지', items: [
    { sym: 'XOM', label: 'XOM', mcap: 450 }, { sym: 'CVX', label: 'CVX', mcap: 280 }, { sym: 'COP', label: 'COP', mcap: 130 },
    { sym: 'SLB', label: 'SLB', mcap: 60 }, { sym: 'OXY', label: 'OXY', mcap: 55 }, { sym: 'EOG', label: 'EOG', mcap: 70 },
  ] },
  { sector: '방산', items: [
    { sym: 'RTX', label: 'RTX', mcap: 210 }, { sym: 'LMT', label: 'LMT', mcap: 120 }, { sym: 'NOC', label: 'NOC', mcap: 75 },
    { sym: 'GD', label: 'GD', mcap: 80 }, { sym: 'BA', label: 'BA', mcap: 130 },
  ] },
  { sector: '산업/중공업', items: [
    { sym: 'CAT', label: 'CAT', mcap: 180 }, { sym: 'GE', label: 'GE', mcap: 200 }, { sym: 'HON', label: 'HON', mcap: 140 },
    { sym: 'UPS', label: 'UPS', mcap: 110 }, { sym: 'DE', label: 'DE', mcap: 130 },
  ] },
  { sector: '소재', items: [
    { sym: 'FCX', label: 'FCX', mcap: 55 }, { sym: 'NEM', label: 'NEM', mcap: 50 }, { sym: 'SHW', label: 'SHW', mcap: 85 },
  ] },
  { sector: '금융/은행', items: [
    { sym: 'JPM', label: 'JPM', mcap: 720 }, { sym: 'V', label: 'V', mcap: 640 }, { sym: 'MA', label: 'MA', mcap: 480 },
    { sym: 'BAC', label: 'BAC', mcap: 350 }, { sym: 'WFC', label: 'WFC', mcap: 230 },
  ] },
  { sector: '증권', items: [
    { sym: 'GS', label: 'GS', mcap: 180 }, { sym: 'MS', label: 'MS', mcap: 160 }, { sym: 'BLK', label: 'BLK', mcap: 140 },
    { sym: 'SCHW', label: 'SCHW', mcap: 130 },
  ] },
  { sector: '경기소비재', items: [
    { sym: 'HD', label: 'HD', mcap: 380 }, { sym: 'TGT', label: 'TGT', mcap: 70 }, { sym: 'NKE', label: 'NKE', mcap: 110 },
    { sym: 'SBUX', label: 'SBUX', mcap: 95 }, { sym: 'MCD', label: 'MCD', mcap: 210 }, { sym: 'BKNG', label: 'BKNG', mcap: 170 },
  ] },
  { sector: '필수소비재', items: [
    { sym: 'WMT', label: 'WMT', mcap: 780 }, { sym: 'COST', label: 'COST', mcap: 400 }, { sym: 'PG', label: 'PG', mcap: 380 },
    { sym: 'KO', label: 'KO', mcap: 270 }, { sym: 'PEP', label: 'PEP', mcap: 230 }, { sym: 'PM', label: 'PM', mcap: 160 },
  ] },
  { sector: '광통신/미디어', items: [
    { sym: 'VZ', label: 'VZ', mcap: 180 }, { sym: 'T', label: 'T', mcap: 130 }, { sym: 'TMUS', label: 'TMUS', mcap: 240 },
    { sym: 'CMCSA', label: 'CMCSA', mcap: 160 }, { sym: 'DIS', label: 'DIS', mcap: 210 },
  ] },
  { sector: '유틸리티', items: [
    { sym: 'NEE', label: 'NEE', mcap: 150 }, { sym: 'SO', label: 'SO', mcap: 95 }, { sym: 'DUK', label: 'DUK', mcap: 80 }, { sym: 'AEP', label: 'AEP', mcap: 55 },
  ] },
  { sector: '부동산(REIT)', items: [
    { sym: 'AMT', label: 'AMT', mcap: 95 }, { sym: 'PLD', label: 'PLD', mcap: 110 }, { sym: 'EQIX', label: 'EQIX', mcap: 85 }, { sym: 'SPG', label: 'SPG', mcap: 55 },
  ] },
];

export const KR_SECTORS = [
  { sector: '반도체/전자', items: [
    { code: '005930', label: '삼성전자', mcap: 350 }, { code: '000660', label: 'SK하이닉스', mcap: 120 },
    { code: '066570', label: 'LG전자', mcap: 14 }, { code: '009150', label: '삼성전기', mcap: 22 },
  ] },
  { sector: '인터넷/엔터', items: [
    { code: '035420', label: 'NAVER', mcap: 38 }, { code: '035720', label: '카카오', mcap: 18 }, { code: '352820', label: '하이브', mcap: 8 },
  ] },
  { sector: '자동차', items: [
    { code: '005380', label: '현대차', mcap: 55 }, { code: '000270', label: '기아', mcap: 42 }, { code: '012330', label: '현대모비스', mcap: 23 },
  ] },
  { sector: '바이오/제약', items: [
    { code: '207940', label: '삼바', mcap: 60 }, { code: '068270', label: '셀트리온', mcap: 25 }, { code: '326030', label: 'SK바이오', mcap: 7 },
  ] },
  { sector: '2차전지/화학', items: [
    { code: '373220', label: 'LG에너지솔루션', mcap: 75 }, { code: '051910', label: 'LG화학', mcap: 28 },
    { code: '006400', label: '삼성SDI', mcap: 25 }, { code: '003670', label: '포스코퓨처', mcap: 18 },
  ] },
  { sector: '에너지/정유', items: [
    { code: '034020', label: '두산에너빌리티', mcap: 32 }, { code: '010950', label: 'S-Oil', mcap: 12 },
    { code: '096770', label: 'SK이노', mcap: 18 }, { code: '034730', label: 'SK', mcap: 25 },
  ] },
  { sector: '방산', items: [
    { code: '012450', label: '한화에어로', mcap: 42 }, { code: '079550', label: 'LIG넥스원', mcap: 10 },
    { code: '064350', label: '현대로템', mcap: 18 }, { code: '047810', label: '한국항공우주', mcap: 6 },
  ] },
  { sector: '조선', items: [
    { code: '009540', label: 'HD한국조선', mcap: 28 }, { code: '042660', label: '한화오션', mcap: 14 },
    { code: '010140', label: '삼성중공업', mcap: 9 },
  ] },
  { sector: '철강/소재', items: [
    { code: '005490', label: 'POSCO홀딩스', mcap: 22 }, { code: '004020', label: 'HD현대제철', mcap: 8 },
    { code: '010130', label: '고려아연', mcap: 12 },
  ] },
  { sector: '은행/지주', items: [
    { code: '105560', label: 'KB금융', mcap: 30 }, { code: '055550', label: '신한지주', mcap: 24 },
    { code: '316140', label: '우리금융', mcap: 18 }, { code: '086790', label: '하나금융', mcap: 20 },
    { code: '028260', label: '삼성물산', mcap: 20 },
  ] },
  { sector: '증권', items: [
    { code: '006800', label: '미래에셋증권', mcap: 14 }, { code: '016360', label: '삼성증권', mcap: 9 },
    { code: '005940', label: 'NH투자증권', mcap: 7 }, { code: '039490', label: '키움증권', mcap: 6 },
  ] },
  { sector: '소비재', items: [
    { code: '051900', label: 'LG생활건강', mcap: 12 }, { code: '090430', label: '아모레퍼시픽', mcap: 9 },
    { code: '097950', label: 'CJ제일제당', mcap: 6 }, { code: '004370', label: '농심', mcap: 5 },
    { code: '271560', label: '오리온', mcap: 5 }, { code: '033780', label: 'KT&G', mcap: 16 },
  ] },
  { sector: '유통', items: [
    { code: '139480', label: '이마트', mcap: 8 }, { code: '004170', label: '신세계', mcap: 5 },
    { code: '282330', label: 'BGF리테일', mcap: 4 }, { code: '023530', label: '롯데쇼핑', mcap: 3 },
  ] },
  { sector: '광통신', items: [
    { code: '030200', label: 'SK텔레콤', mcap: 12 }, { code: '017670', label: 'SK브로드밴드', mcap: 8 }, { code: '032640', label: 'LG유플러스', mcap: 5 },
  ] },
];
