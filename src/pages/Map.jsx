import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useNavigate } from 'react-router-dom';

const GEOCODE_KEY = 'pk.eyJ1Ijoic3R1ZHltYXRjaCIsImEiOiJjbHgifQ.fake'; // will use nominatim free

async function geocodePlace(place) {
  if (!place) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    const data = await res.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    return null;
  } catch { return null; }
}

export default function Map({ session }) {
  const [myProfile, setMyProfile] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    // Load Leaflet JS
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setMapReady(true);
      document.head.appendChild(script);
    } else {
      setMapReady(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (mapReady && markers.length > 0 && mapRef.current && !leafletMap.current) {
      initMap();
    }
  }, [mapReady, markers]);

  async function loadData() {
    const { data: me } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setMyProfile(me);

    // Get my matches
    const { data: matchData } = await supabase.from('matches')
      .select('*')
      .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`);

    const matchIds = new Set((matchData || []).map(m =>
      m.user1_id === session.user.id ? m.user2_id : m.user1_id
    ));

    // Get all profiles except mine
    const { data: profiles } = await supabase.from('profiles').select('*').neq('id', session.user.id);

    // Filter: same institution OR compatible needs
    const relevant = (profiles || []).filter(p => {
      const sameInstitution = me.institution && p.institution &&
        p.institution.toLowerCase().includes(me.institution.toLowerCase().split(' ')[0]);
      const compatible = me.need_help && p.can_help &&
        me.need_help.some(s => p.can_help.includes(s));
      return sameInstitution || compatible || matchIds.has(p.id);
    });

    // Geocode each unique institution/city
    const geocodeCache = {};
    const enriched = [];

    for (const p of relevant) {
      const place = p.institution || p.city || 'Brasil';
      if (!geocodeCache[place]) {
        geocodeCache[place] = await geocodePlace(place);
        await new Promise(r => setTimeout(r, 300)); // rate limit
      }
      const coords = geocodeCache[place];
      if (coords) {
        // Add small random offset so markers don't stack exactly
        const jitter = () => (Math.random() - 0.5) * 0.005;
        enriched.push({
          ...p,
          lat: coords.lat + jitter(),
          lng: coords.lng + jitter(),
          isMatch: matchIds.has(p.id),
          matchId: matchData?.find(m => m.user1_id === p.id || m.user2_id === p.id)?.id,
        });
      }
    }

    setMarkers(enriched);
    setLoading(false);
  }

  function initMap() {
    const L = window.L;
    const map = L.map(mapRef.current).setView([-15.7801, -47.9292], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    markers.forEach(m => {
      const isMatch = m.isMatch;
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:40px;height:40px;border-radius:50%;border:3px solid ${isMatch ? '#6C63FF' : '#9CA3AF'};
          background:white;overflow:hidden;cursor:pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        ">
          <img src="${m.avatar_url}" style="width:100%;height:100%;object-fit:cover;" />
        </div>
        ${isMatch ? `<div style="width:12px;height:12px;background:#6C63FF;border-radius:50%;border:2px solid white;position:absolute;bottom:0;right:0;"></div>` : ''}`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      marker.on('click', () => setSelected(m));
      markersRef.current.push(marker);
    });

    leafletMap.current = map;
  }

  function handleChat(matchId) {
    navigate(`/chat/${matchId}`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Mapa de Conexões</h2>
        <p style={styles.sub}>
          <span style={styles.dotPurple}></span> Matches &nbsp;
          <span style={styles.dotGray}></span> Mesma instituição
        </p>
      </div>

      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Localizando pessoas próximas...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div ref={mapRef} style={{ ...styles.map, opacity: loading ? 0 : 1 }} />

      {selected && (
        <div style={styles.card}>
          <button style={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
          <div style={styles.cardContent}>
            <img src={selected.avatar_url} alt="" style={styles.avatar} />
            <div style={styles.cardInfo}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardName}>{selected.name}</h3>
                {selected.isMatch && <span style={styles.matchBadge}>✓ Match</span>}
              </div>
              {selected.institution && <p style={styles.institution}>📍 {selected.institution}</p>}
              <div style={styles.tags}>
                {(selected.can_help || []).filter(s => myProfile?.need_help?.includes(s)).map(s => (
                  <span key={s} style={styles.tag}>{s}</span>
                ))}
              </div>
            </div>
          </div>
          {selected.isMatch && selected.matchId && (
            <button className="btn-primary" style={{ marginTop: 12 }}
              onClick={() => handleChat(selected.matchId)}>
              💬 Enviar mensagem
            </button>
          )}
          {!selected.isMatch && (
            <p style={styles.hint}>Vá para Descobrir para dar match com {selected.name.split(' ')[0]}!</p>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: 0 },
  header: { padding: '16px 20px 8px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 10 },
  title: { fontFamily: 'Sora, sans-serif', fontSize: 20, color: '#1A1A2E' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 },
  dotPurple: { display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#6C63FF' },
  dotGray: { display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#9CA3AF' },
  map: { flex: 1, transition: 'opacity 0.5s', zIndex: 1 },
  loading: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', color: '#6B7280', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  spinner: { width: 40, height: 40, border: '4px solid #EEF0FF', borderTop: '4px solid #6C63FF', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  card: { position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 440, background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 100 },
  closeBtn: { position: 'absolute', top: 12, right: 12, background: '#F3F4F6', color: '#374151', width: 28, height: 28, borderRadius: '50%', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardContent: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 52, height: 52, borderRadius: '50%', flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  cardName: { fontFamily: 'Sora, sans-serif', fontSize: 16, color: '#1A1A2E' },
  matchBadge: { background: '#EEF0FF', color: '#6C63FF', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 },
  institution: { color: '#6B7280', fontSize: 13, margin: '4px 0 8px' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  tag: { background: '#EEF0FF', color: '#6C63FF', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  hint: { color: '#6B7280', fontSize: 13, textAlign: 'center', marginTop: 12 },
};
