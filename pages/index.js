export default function Home() {
  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
      <h1>Public Art Collections — Sync System</h1>
      <p>Total works: loading...</p>
      <p><a href="/api/artworks?count=true">Check database count</a></p>
      <p><a href="/api/artworks">Browse artworks API</a></p>
    </div>
  );
}
