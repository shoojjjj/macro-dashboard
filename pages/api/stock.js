// pages/api/stock.js
// 클라이언트에서 직접 호출하도록 키만 전달
export default function handler(req, res) {
  res.status(200).json({
    av_key: process.env.ALPHAVANTAGE_API_KEY,
    fh_key: process.env.FINNHUB_API_KEY,
  });
}