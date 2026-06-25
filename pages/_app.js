import Head from 'next/head';
import '../styles/globals.css';

const SITE_URL = 'https://wonik-macro.vercel.app';
const SITE_TITLE = 'Greg_Jeon | Macro & Stock Live Dashboard';
const SITE_DESC = '실시간 매크로·주식 대시보드 — 코스피/나스닥, 관심종목, 퀀트 스코어, Fed 유동성';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <title>{SITE_TITLE}</title>
        <meta name="description" content={SITE_DESC} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Wonik Macro Dashboard" />
        <meta property="og:title" content={SITE_TITLE} />
        <meta property="og:description" content={SITE_DESC} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={`${SITE_URL}/og.png`} />
        <meta property="og:image:secure_url" content={`${SITE_URL}/og.png`} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="ko_KR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SITE_TITLE} />
        <meta name="twitter:description" content={SITE_DESC} />
        <meta name="twitter:image" content={`${SITE_URL}/og.png`} />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
