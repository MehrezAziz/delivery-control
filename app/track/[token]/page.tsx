'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface TrackingData {
  status: string;
  driverLocation: { latitude: number; longitude: number; timestamp: string } | null;
  dropoffAddress: { street: string | null; delegation: string; governorate: string } | null;
}

export default function PublicTrackPage() {
  const { token } = useParams<{ token: string }>();  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTracking = async () => {
    try {
      const res = await fetch(`/api/tracking/${token}`);
      const json = await res.json();
      if (!res.ok) { setError(json.message || 'Invalid or expired tracking code'); setData(null); return; }
      setData(json);
      setError(null);
    } catch {
      setError('Failed to load tracking data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    intervalRef.current = setInterval(fetchTracking, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [token]);

  const statusLabel = data?.status?.replace(/_/g, ' ') ?? '';
  const isActive = data?.status === 'PICKED_UP' || data?.status === 'DELIVERING';
  const loc = data?.driverLocation;
  const mapSrc = loc
    ? `https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&z=15&output=embed`
    : null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0284c7', padding: '20px 24px', color: '#fff' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📦 Live Delivery Tracking</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: 14 }}>Code: {token}</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
            <div style={{ fontSize: 40 }}>⏳</div>
            <p>Loading tracking data...</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 36 }}>❌</div>
            <p style={{ color: '#991b1b', fontWeight: 600, margin: '8px 0 0' }}>{error}</p>
          </div>
        )}

        {data && !error && (
          <>
            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{
                background: isActive ? '#dcfce7' : '#f3f4f6',
                color: isActive ? '#166534' : '#374151',
                padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 14,
              }}>
                {isActive ? '🟢' : '⚪'} {statusLabel}
              </span>
              {isActive && <span style={{ fontSize: 13, color: '#6b7280' }}>Updates every 5s</span>}
            </div>

            {/* Map */}
            {mapSrc ? (
              <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <iframe
                  src={mapSrc}
                  width="100%" height="320"
                  style={{ border: 0, display: 'block' }}
                  allowFullScreen
                  loading="lazy"
                  title="Driver location"
                />
              </div>
            ) : (
              <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
                <p style={{ color: '#92400e', margin: 0 }}>⏳ Waiting for driver location update...</p>
              </div>
            )}

            {/* Dropoff address */}
            {data.dropoffAddress && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Delivery Address</p>
                <p style={{ margin: 0, fontSize: 15, color: '#111827', fontWeight: 600 }}>
                  📍 {data.dropoffAddress.street || data.dropoffAddress.delegation}, {data.dropoffAddress.governorate}
                </p>
              </div>
            )}

            {/* Open in app banner */}
            <div style={{ marginTop: 20, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <p style={{ margin: '0 0 10px', color: '#1e40af', fontWeight: 600 }}>Get the full experience</p>
              <a
                href={`deliveryapp://track/${token}`}
                style={{
                  display: 'inline-block', background: '#0284c7', color: '#fff',
                  padding: '10px 24px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 14,
                }}
              >
                Open in App
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
