import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { loadIdentity } from '../lib/identity';

// Per-route SEO/social metadata. The site was shipping with NO <title>, meta
// description, or Open Graph tags on any page — so browser tabs/Google showed
// the raw URL and social shares (e.g. the footer's Facebook page) rendered blank
// previews. Centralised here rather than per-page so every route is covered from
// one place; unlisted routes fall back to DEFAULT_META.
const SITE = 'https://www.publicartcollections.net';
const OG_IMAGE = SITE + '/og-image.png';
const DEFAULT_META = {
  title: 'Public Art Collections — Museum-Quality Public-Domain Art Prints',
  description: 'Browse 1.9M+ public-domain artworks from 120+ world museums and order museum-quality prints. 35% of every membership supports arts education for children in Asheville & Buncombe County, NC.',
};
const PAGE_META = {
  '/': DEFAULT_META,
  '/viewer': {
    title: 'Browse by Museum — Public Art Collections',
    description: 'Explore 1.9M+ public-domain artworks from 120+ museums worldwide — the Met, Rijksmuseum, Art Institute of Chicago, Smithsonian and more — in a deep-zoom viewer.',
  },
  '/pricing': {
    title: 'Membership & Pricing — Public Art Collections',
    description: 'Explorer, Collector, and Patron memberships from $9.99/mo. 35% of every membership funds arts education for children in Asheville & Buncombe County, NC.',
  },
  '/sign-in': {
    title: 'Sign In — Public Art Collections',
    description: 'Sign in to your Public Art Collections account to order prints and manage your membership.',
  },
};

// Fire a fire-and-forget tracking beacon on every page view (initial load and
// every client-side route change). The /api/track endpoint handles first-visit
// SMS alerts and CRM sync; failures here are swallowed so they never affect UX.
// Once a visitor has identified themselves (e.g. at checkout), their stored
// email/phone rides along so the GHL CRM push can match/upsert the contact.
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
  const meta = PAGE_META[router.pathname] || DEFAULT_META;
  const canonical = SITE + (router.pathname === '/' ? '' : router.pathname);

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
        {/* Favicons / PWA manifest — served from /public. */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#1A1714" />
        {/* SEO / social. Keys let a page override any tag via its own next/head. */}
        <title key="title">{meta.title}</title>
        <meta name="description" content={meta.description} key="description" />
        <link rel="canonical" href={canonical} key="canonical" />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:site_name" content="Public Art Collections" key="og:site_name" />
        <meta property="og:title" content={meta.title} key="og:title" />
        <meta property="og:description" content={meta.description} key="og:description" />
        <meta property="og:url" content={canonical} key="og:url" />
        <meta property="og:image" content={OG_IMAGE} key="og:image" />
        <meta property="og:image:width" content="1200" key="og:image:width" />
        <meta property="og:image:height" content="630" key="og:image:height" />
        <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
        <meta name="twitter:title" content={meta.title} key="twitter:title" />
        <meta name="twitter:description" content={meta.description} key="twitter:description" />
        <meta name="twitter:image" content={OG_IMAGE} key="twitter:image" />
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
