// 더 이상 사용하지 않음 - 브라우저에서 직접 호출
export default function handler(req, res) {
  res.status(200).json({ message: 'Use client-side fetch' });
}