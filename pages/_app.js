import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Global viewport — without this, mobile browsers render pages at desktop
            width and content overflows/left-justifies. Zoom left enabled for a11y. */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
