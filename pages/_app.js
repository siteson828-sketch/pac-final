import { SessionProvider } from 'next-auth/react';
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
    // Capture UTM / GroundTruth attribution from the URL so it rides along with
    // the visit (stored only for identified visitors, server-side).
    let utm = {};
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      const g = k => q.get(k) || undefined;
      utm = {
        utm_source: g('utm_source'), utm_medium: g('utm_medium'), utm_campaign: g('utm_campaign') || g('gt_campaign'),
        utm_content: g('utm_content'), utm_term: g('utm_term'),
        groundtruth_id: g('gt_id'), groundtruth_campaign: g('gt_campaign'), groundtruth_location: g('gt_location'), groundtruth_venue_type: g('gt_venue'),
        landing_page: window.location.href,
        source: g('utm_source') || (document.referrer ? new URL(document.referrer).hostname : 'direct'),
      };
      Object.keys(utm).forEach(k => utm[k] === undefined && delete utm[k]);
    }
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        ...utm,
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
    <SessionProvider session={pageProps.session}>
      <Head>
        {/* Global viewport — without this, mobile browsers render pages at desktop
            width and content overflows/left-justifies. Zoom left enabled for a11y. */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
