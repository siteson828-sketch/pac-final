import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { loadIdentity } from '../lib/identity';

// Fire a fire-and-forget tracking beacon on every page view (initial load and
// every client-side route change). The /api/track endpoint handles first-visit
// SMS alerts and CRM sync; failures here are swallowed so they never affect UX.
// Once a visitor has identified themselves (e.g. at checkout), their stored
// email/phone rides along so the Bloo CRM push can match/upsert the contact.
function track(path) {
  try {
    const { email, phone, name } = loadIdentity();
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(name ? { name } : {}),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    track(window.location.pathname + window.location.search);
    const onChange = url => track(url);
    router.events.on('routeChangeComplete', onChange);
    return () => router.events.off('routeChangeComplete', onChange);
  }, [router.events]);

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
