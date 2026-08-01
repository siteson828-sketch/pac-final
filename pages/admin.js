import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Admin() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [secret, setSecret] = useState('');

  useEffect(() => {
    const s = router.query.secret || (typeof window !== 'undefined' && localStorage.getItem('admin_secret'));
    if (!s) { setLoading(false); return; }
    setSecret(s);
    localStorage.setItem('admin_secret', s);
    loadDashboard(s);
  }, [router.query.secret]);

  async function loadDashboard(s) {
    setLoading(true);
    try {
      const d = await fetch('/api/admin-dashboard?secret=' + encodeURIComponent(s)).then(r => r.json());
      if (d.error) { setData(null); setLoading(false); return; }
      setData(d);
    } catch (e) {}
    setLoading(false);
  }

  async function sendFollowUpSMS(visitor) {
    await fetch('/api/admin-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        action: 'send_sms',
        phone: visitor.phone,
        message: 'Hi ' + (visitor.name || 'there') + '! You left something special at Public Art Collections. Your artwork is waiting: publicartcollections.net/viewer',
      }),
    });
    alert('SMS requested for ' + visitor.phone);
  }

  if (!loading && !data) return (
    <div style={{ minHeight: '100vh', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, color: '#F0EAD8' }}>Admin Access</div>
      <input placeholder="Enter admin secret"
        onKeyDown={e => { if (e.key === 'Enter') { const s = e.target.value; localStorage.setItem('admin_secret', s); setSecret(s); loadDashboard(s); } }}
        style={{ padding: '10px 16px', borderRadius: 4, background: '#2C2318', border: '0.5px solid #3A3028', color: '#F0EAD8', fontSize: 14, width: 300, fontFamily: 'system-ui' }}
      />
      <div style={{ fontSize: 12, color: '#6A6058' }}>Enter your sync secret to access the dashboard</div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8942A', fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 300 }}>
      Loading dashboard...
    </div>
  );

  const stats = data?.stats || {};
  const visitors = data?.visitors || [];
  const orders = data?.orders || [];
  const abandoned = data?.abandoned || [];
  const topArtworks = data?.top_artworks || [];
  const topMuseums = data?.top_museums || [];
  const dbHealth = data?.db_health || {};

  const JOURNEY_COLORS = {
    visitor: '#8A8178', browser: '#4A90D9', interested: '#F5A623',
    abandoned: '#E74C3C', buyer: '#27AE60', subscriber: '#B8942A',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1A1714', color: '#F0EAD8', fontFamily: 'system-ui,sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: '#0D0B09', borderBottom: '0.5px solid #3A3028', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ fontFamily: 'Georgia,serif', fontSize: 18, color: '#F0EAD8', textDecoration: 'none' }}>
            Public Art <span style={{ color: '#B8942A' }}>Collections</span>
          </a>
          <span style={{ fontSize: 11, color: '#6A6058', padding: '3px 8px', background: '#2C2318', borderRadius: 4 }}>Admin</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['overview', 'visitors', 'orders', 'content', 'database'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: '6px 14px', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', background: activeTab === tab ? '#B8942A' : 'transparent', color: activeTab === tab ? '#1A1714' : '#8A8178', fontFamily: 'system-ui', textTransform: 'capitalize' }}>
              {tab}
            </button>
          ))}
        </div>
        <button onClick={() => loadDashboard(secret)} style={{ background: 'transparent', color: '#8A8178', border: '0.5px solid #3A3028', padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
          ↺ Refresh
        </button>
      </nav>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px' }}>
        {activeTab === 'overview' && (
          <div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 300, marginBottom: 24 }}>Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Total Visitors', value: (stats.total_visitors || 0).toLocaleString(), color: '#4A90D9' },
                { label: 'Visitors Today', value: (stats.visitors_today || 0).toLocaleString(), color: '#B8942A' },
                { label: 'Abandoned Carts', value: (stats.abandoned_carts || 0).toLocaleString(), color: '#E74C3C' },
                { label: 'Total Orders', value: (stats.total_orders || 0).toLocaleString(), color: '#27AE60' },
                { label: 'Total Revenue', value: '$' + (stats.total_revenue || 0).toFixed(2), color: '#B8942A' },
                { label: 'Revenue Today', value: '$' + (stats.revenue_today || 0).toFixed(2), color: '#27AE60' },
                { label: 'Works in DB', value: (stats.total_works || 0).toLocaleString(), color: '#8A8178' },
                { label: 'Active Subscribers', value: (stats.subscribers || 0).toLocaleString(), color: '#B8942A' },
              ].map(s => (
                <div key={s.label} style={{ background: '#2C2318', borderRadius: 8, padding: 20, border: '0.5px solid #3A3028' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A6058', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 300, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#2C2318', borderRadius: 8, padding: 24, marginBottom: 32, border: '0.5px solid #3A3028' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Customer Journey Funnel</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[
                  { stage: 'Visitor', count: stats.stage_visitor || 0 },
                  { stage: 'Browser', count: stats.stage_browser || 0 },
                  { stage: 'Interested', count: stats.stage_interested || 0 },
                  { stage: 'Abandoned', count: stats.stage_abandoned || 0 },
                  { stage: 'Buyer', count: stats.stage_buyer || 0 },
                  { stage: 'Subscriber', count: stats.stage_subscriber || 0 },
                ].map((s, i, arr) => (
                  <div key={s.stage} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ background: Object.values(JOURNEY_COLORS)[i], borderRadius: 4, padding: '12px 8px', marginBottom: 8, opacity: 0.9 }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#FAF8F4' }}>{s.count}</div>
                    </div>
                    <div style={{ fontSize: 10, color: '#8A8178' }}>{s.stage}</div>
                    {i < arr.length - 1 && (
                      <div style={{ fontSize: 10, color: '#6A6058', marginTop: 4 }}>
                        {s.count > 0 ? Math.round((arr[i + 1].count / s.count) * 100) + '%' : '—'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {abandoned.length > 0 && (
              <div style={{ background: '#2C2318', borderRadius: 8, padding: 24, marginBottom: 32, border: '0.5px solid rgba(231,76,60,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#E74C3C' }}>🛒 Abandoned Carts ({abandoned.length})</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {abandoned.slice(0, 5).map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px', background: '#1A1714', borderRadius: 4 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{v.name || v.email || 'Anonymous'}</div>
                        <div style={{ fontSize: 11, color: '#8A8178' }}>{v.email} · {v.phone}</div>
                        <div style={{ fontSize: 11, color: '#8A8178', marginTop: 2 }}>Last viewed: {v.last_artwork}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#6A6058' }}>{v.last_seen ? new Date(v.last_seen).toLocaleDateString() : ''}</div>
                      {v.phone && (
                        <button onClick={() => sendFollowUpSMS(v)}
                          style={{ background: '#B8942A', color: '#1A1714', border: 'none', padding: '6px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Send SMS
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'visitors' && (
          <div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 300, marginBottom: 24 }}>Visitors ({visitors.length})</h2>
            {visitors.length === 0 && <div style={{ color: '#6A6058', fontSize: 13 }}>No identified visitors yet. Profiles appear once a visitor provides an email/phone (e.g. at checkout) or the pixel resolves an identity.</div>}
            {visitors.map((v, i) => (
              <div key={i} style={{ background: '#2C2318', borderRadius: 8, padding: 20, border: '0.5px solid #3A3028', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: '#F0EAD8' }}>{v.name || v.audiencelab_name || 'Anonymous Visitor'}</div>
                    <div style={{ fontSize: 12, color: '#8A8178' }}>{v.email || v.audiencelab_email} · {v.phone || v.audiencelab_phone}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (JOURNEY_COLORS[v.journey_stage] || '#8A8178') + '20', color: JOURNEY_COLORS[v.journey_stage] || '#8A8178', textTransform: 'capitalize' }}>
                      {v.journey_stage || 'visitor'}
                    </span>
                    {(v.phone || v.audiencelab_phone) && (
                      <button onClick={() => sendFollowUpSMS({ ...v, phone: v.phone || v.audiencelab_phone })}
                        style={{ background: '#B8942A', color: '#1A1714', border: 'none', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        Send SMS
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12, padding: '10px', background: '#1A1714', borderRadius: 4 }}>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A6058', marginBottom: 2 }}>First Visit</div>
                    <div style={{ fontSize: 12, color: '#F0EAD8' }}>{v.first_visit_date ? new Date(v.first_visit_date).toLocaleDateString() : '—'}</div>
                    <div style={{ fontSize: 11, color: '#8A8178' }}>{v.first_visit_time ? String(v.first_visit_time).slice(0, 5) : ''}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A6058', marginBottom: 2 }}>Last Visit</div>
                    <div style={{ fontSize: 12, color: '#F0EAD8' }}>{v.last_visit_date ? new Date(v.last_visit_date).toLocaleDateString() : '—'}</div>
                    <div style={{ fontSize: 11, color: '#8A8178' }}>{v.last_visit_time ? String(v.last_visit_time).slice(0, 5) : ''}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A6058', marginBottom: 2 }}>Pages Viewed</div>
                    <div style={{ fontSize: 16, color: '#B8942A', fontFamily: 'Georgia,serif' }}>{v.pages_viewed || 1}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A6058', marginBottom: 2 }}>Cart Value</div>
                    <div style={{ fontSize: 16, color: v.cart_value > 0 ? '#27AE60' : '#6A6058', fontFamily: 'Georgia,serif' }}>${v.cart_value || 0}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={{ padding: 12, background: '#1A1714', borderRadius: 4, border: '0.5px solid rgba(184,148,42,0.2)' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#B8942A', marginBottom: 8 }}>✦ AudienceLab Identity</div>
                    {[
                      ['Age Range', v.audiencelab_age_range], ['Gender', v.audiencelab_gender], ['Income', v.audiencelab_income],
                      ['Net Worth', v.audiencelab_net_worth], ['Education', v.audiencelab_education], ['Occupation', v.audiencelab_occupation],
                      ['Homeowner', v.audiencelab_homeowner], ['Marital Status', v.audiencelab_marital_status], ['Children', v.audiencelab_children],
                    ].map(([label, value]) => value ? (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: '#6A6058' }}>{label}</span>
                        <span style={{ color: '#F0EAD8' }}>{value}</span>
                      </div>
                    ) : null)}
                    {!v.audiencelab_age_range && !v.audiencelab_income && !v.audiencelab_gender && (
                      <div style={{ fontSize: 10, color: '#6A6058' }}>No enrichment data</div>
                    )}
                    {v.audiencelab_interests?.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 9, color: '#6A6058', marginBottom: 3 }}>Interests</div>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {(v.audiencelab_interests || []).slice(0, 5).map((interest, k) => (
                            <span key={k} style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(184,148,42,0.1)', color: '#B8942A', borderRadius: 3 }}>{typeof interest === 'object' ? JSON.stringify(interest) : interest}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 12, background: '#1A1714', borderRadius: 4, border: '0.5px solid rgba(74,144,217,0.2)' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#4A90D9', marginBottom: 8 }}>◎ Ad Attribution</div>
                    {[
                      ['GT Campaign', v.groundtruth_campaign], ['GT Location', v.groundtruth_location], ['GT Venue', v.groundtruth_venue_type],
                      ['UTM Source', v.utm_source], ['UTM Medium', v.utm_medium], ['UTM Campaign', v.utm_campaign], ['UTM Content', v.utm_content],
                      ['Referrer', v.referrer ? String(v.referrer).slice(0, 30) : null], ['Landing', v.landing_page ? String(v.landing_page).slice(0, 30) : null],
                    ].map(([label, value]) => value ? (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: '#6A6058' }}>{label}</span>
                        <span style={{ color: '#F0EAD8', textAlign: 'right', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                      </div>
                    ) : null)}
                    {!v.utm_source && !v.groundtruth_campaign && !v.referrer && (
                      <div style={{ fontSize: 10, color: '#6A6058' }}>Direct / no attribution</div>
                    )}
                  </div>

                  <div style={{ padding: 12, background: '#1A1714', borderRadius: 4, border: '0.5px solid rgba(240,234,214,0.1)' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8A8178', marginBottom: 8 }}>⬡ Device & Behavior</div>
                    {[
                      ['Device', v.device_type], ['Browser', v.browser], ['OS', v.os],
                      ['City', v.city], ['State', v.state], ['Country', v.country], ['IP', v.ip],
                    ].map(([label, value]) => value ? (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: '#6A6058' }}>{label}</span>
                        <span style={{ color: '#F0EAD8' }}>{value}</span>
                      </div>
                    ) : null)}
                    {v.artworks_viewed?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 9, color: '#6A6058', marginBottom: 3 }}>Artworks Viewed</div>
                        {(v.artworks_viewed || []).slice(-3).reverse().map((a, k) => (
                          <div key={k} style={{ fontSize: 10, color: '#B0A898', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {typeof a === 'object' ? a.title : a}
                          </div>
                        ))}
                      </div>
                    )}
                    {v.ai_searches?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 9, color: '#6A6058', marginBottom: 3 }}>AI Searches</div>
                        {(v.ai_searches || []).slice(-3).reverse().map((sr, k) => (
                          <div key={k} style={{ fontSize: 10, color: '#B8942A', marginBottom: 2 }}>"{typeof sr === 'object' ? sr.query : sr}"</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 300, marginBottom: 24 }}>Orders ({orders.length})</h2>
            {orders.length === 0 && <div style={{ color: '#6A6058', fontSize: 13 }}>No orders yet.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {orders.map((o, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 100px 100px', gap: 12, padding: '14px 16px', background: '#2C2318', borderRadius: 6, border: '0.5px solid #3A3028', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{o.customer_name}</div>
                    <div style={{ fontSize: 11, color: '#8A8178' }}>{o.customer_email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13 }}>{o.artwork_title}</div>
                    <div style={{ fontSize: 11, color: '#8A8178' }}>{o.product_name} · {o.size}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6A6058' }}>
                    {o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}
                  </div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 18, color: '#27AE60' }}>${o.total}</div>
                  <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, textAlign: 'center', background: o.status === 'completed' ? '#27AE6020' : '#F5A62320', color: o.status === 'completed' ? '#27AE60' : '#F5A623' }}>
                    {o.status || 'pending'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 300, marginBottom: 24 }}>Top Content</h2>
            <div style={{ fontSize: 12, color: '#6A6058', marginBottom: 16 }}>Based on tracked artwork views from identified visitors.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ background: '#2C2318', borderRadius: 8, padding: 24, border: '0.5px solid #3A3028' }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Most Viewed Artworks</div>
                {topArtworks.length === 0 && <div style={{ fontSize: 12, color: '#6A6058' }}>No view data yet.</div>}
                {topArtworks.map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #3A3028', fontSize: 13 }}>
                    <span style={{ color: '#B0A898' }}>{a.title}</span>
                    <span style={{ color: '#B8942A' }}>{a.views} views</span>
                  </div>
                ))}
              </div>
              <div style={{ background: '#2C2318', borderRadius: 8, padding: 24, border: '0.5px solid #3A3028' }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Most Browsed Museums</div>
                {topMuseums.length === 0 && <div style={{ fontSize: 12, color: '#6A6058' }}>No view data yet.</div>}
                {topMuseums.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #3A3028', fontSize: 13 }}>
                    <span style={{ color: '#B0A898' }}>{m.museum}</span>
                    <span style={{ color: '#B8942A' }}>{m.views} views</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 300, marginBottom: 24 }}>Database Health</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Works', value: (dbHealth.total_works || 0).toLocaleString() },
                { label: 'Added Last 24h', value: (dbHealth.added_24h || 0).toLocaleString() },
                { label: 'Added Last Hour', value: (dbHealth.added_1h || 0).toLocaleString() },
              ].map(s => (
                <div key={s.label} style={{ background: '#2C2318', borderRadius: 8, padding: 20, border: '0.5px solid #3A3028' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A6058', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 300, color: '#B8942A' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#2C2318', borderRadius: 8, padding: 24, border: '0.5px solid #3A3028' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Works by Source</div>
              {(dbHealth.by_source || []).slice(0, 15).map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #3A3028' }}>
                  <span style={{ fontSize: 13, color: '#B0A898' }}>{s.source}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 100, height: 4, background: '#3A3028', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: (dbHealth.total_works ? Math.round((s.count / dbHealth.total_works) * 100) : 0) + '%', height: '100%', background: '#B8942A', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#B8942A', minWidth: 50, textAlign: 'right' }}>{(s.count || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Server-side gate: redirect to the homepage unless ?secret= (or the admin_secret
// cookie set on a prior valid visit) matches SYNC_SECRET. The dashboard data /
// action APIs re-check the secret too, so data is never served unauthenticated.
export async function getServerSideProps({ query, req, res }) {
  const secret = process.env.SYNC_SECRET;
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('admin_secret='));
  const cookieVal = match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
  const provided = query.secret || cookieVal;

  if (!secret || provided !== secret) {
    return { redirect: { destination: '/', permanent: false } };
  }
  res.setHeader('Set-Cookie', `admin_secret=${encodeURIComponent(secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  return { props: {} };
}
