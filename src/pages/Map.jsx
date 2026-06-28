import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircle, UserPlus, BookOpen, Briefcase } from 'lucide-react';

const ADMIN_ID = null; // será setado automaticamente com o primeiro usuário admin

async function geocodePlace(place) {
  if (!place) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place + ', Brasil')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    const data = await res.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch { return null; }
}

export default function Map({ session }) {
  const [myProfile, setMyProfile] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null); // 'sent' | 'match' | null
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setMapReady(true);
      document.head.appendChild(script);
    } else setMapReady(true);
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (mapReady && markers.length > 0 && mapRef.current && !leafletMap.current) initMap();
  }, [mapReady, markers]);

  async function loadData() {
    const { data: me } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setMyProfile(me);

    const { data: matchData } = await supabase.from('matches').select('*')
      .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`);
    const matchIds = new Set((matchData || []).map(m => m.user1_id === session.user.id ? m.user2_id : m.user1_id));

    const { data: profiles } = await supabase.from('profiles').select('*').neq('id', session.user.id);

    const geocodeCache = {};
    const enriched = [];
    for (const p of (profiles || [])) {
      const place = p.institution || p.city || 'São Paulo';
      if (!geocodeCache[place]) {
        geocodeCache[place] = await geocodePlace(place);
        await new Promise(r => setTimeout(r, 300));
      }
      const coords = geocodeCache[place];
      if (coords) {
        const jitter = () => (Math.random() - 0.5) * 0.008;
        const match = (matchData || []).find(m => m.user1_id === p.id || m.user2_id === p.id);
        enriched.push({ ...p, lat: coords.lat + jitter(), lng: coords.lng + jitter(), isMatch: matchIds.has(p.id), matchId: match?.id });
      }
    }
    setMarkers(enriched);
    setLoading(false);
  }

  function initMap() {
    const L = window.L;
    const map = L.map(mapRef.current).setView([-15.7801, -47.9292], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    markers.forEach(m => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:44px;height:44px;border-radius:50%;border:3px solid ${m.isMatch ? '#6C63FF' : '#9CA3AF'};background:white;overflow:hidden;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);">
          <img src="${m.avatar_url}" style="width:100%;height:100%;object-fit:cover;" />
        </div>`,
        iconSize: [44, 44], iconAnchor: [22, 22],
      });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      marker.on('click', () => openProfile(m));
    });
    leafletMap.current = map;
  }

  async function openProfile(person) {
    setSelected(person);
    setRequestStatus(null);
    // Check if already sent request
    const { data: swipe } = await supabase.from('swipes')
      .select('*').eq('user_id', session.user.id).eq('target_id', person.id).single();
    if (swipe?.liked) setRequestStatus(person.isMatch ? 'match' : 'sent');
  }

  async function requestConnection() {
    if (!selected || requesting) return;
    setRequesting(true);
    await supabase.from('swipes').upsert({ user_id: session.user.id, target_id: selected.id, liked: true });

    // Check if they already liked me
    const { data: theirSwipe } = await supabase.from('swipes')
      .select('*').eq('user_id', selected.id).eq('target_id', session.user.id).eq('liked', true).single();

    if (theirSwipe) {
      await supabase.from('matches').insert({ user1_id: session.user.id, user2_id: selected.id, created_at: new Date().toISOString() });
      setSelected(s => ({ ...s, isMatch: true }));
      setRequestStatus('match');
    } else {
      setRequestStatus('sent');
    }
    setRequesting(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <h2 style={styles.title}>🗺️ StudyMatch</h2>
        {loading && <span style={styles.loadingBadge}>Localizando pessoas...</span>}
      </div>

      <div ref={mapRef} style={styles.map} />

      {selected && (
        <div style={styles.cardOverlay}>
          <div style={styles.card}>
            <button style={styles.closeBtn} onClick={() => setSelected(null)}><X size={16} /></button>

            <div style={styles.cardTop}>
              <img src={selected.avatar_url} alt="" style={styles.avatar} />
              <div style={styles.cardInfo}>
                <h3 style={styles.cardName}>{selected.name}</h3>
                <p style={styles.cardType}>
                  {selected.type === 'estudante' ? '📚 Estudante' : selected.type === 'universitario' ? '🎓 Universitário' : '💼 Profissional'}
                </p>
                {selected.institution && <p style={styles.cardInst}>📍 {selected.institution}</p>}
              </div>
            </div>

            {selected.bio && <p style={styles.bio}>{selected.bio}</p>}

            <div style={styles.skillsRow}>
              <div style={styles.skillCol}>
                <div style={styles.skillHeader}><BookOpen size={13} color="#6C63FF" /><span style={{ color: '#6C63FF', fontWeight: 600, fontSize: 12 }}>Precisa de ajuda em</span></div>
                <div style={styles.tags}>
                  {(selected.need_help || []).slice(0, 3).map(s => <span key={s} style={styles.tagPurple}>{s}</span>)}
                </div>
              </div>
              <div style={styles.skillCol}>
                <div style={styles.skillHeader}><Briefcase size={13} color="#00C9A7" /><span style={{ color: '#00A382', fontWeight: 600, fontSize: 12 }}>Pode ajudar com</span></div>
                <div style={styles.tags}>
                  {(selected.can_help || []).filter(s => myProfile?.need_help?.includes(s)).slice(0, 3).map(s => <span key={s} style={styles.tagGreen}>{s}</span>)}
                </div>
              </div>
            </div>

            {selected.isMatch ? (
              <button style={styles.btnChat} onClick={() => navigate(`/chat/${selected.matchId}`)}>
                <MessageCircle size={18} /> Enviar mensagem
              </button>
            ) : requestStatus === 'sent' ? (
              <div style={styles.sentMsg}>✅ Solicitação enviada! Aguardando resposta.</div>
            ) : (
              <button style={styles.btnConnect} onClick={requestConnection} disabled={requesting}>
                <UserPlus size={18} /> {requesting ? 'Enviando...' : 'Solicitar Conexão'}
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 10 },
  title: { fontFamily: 'Sora, sans-serif', fontSize: 20, color: '#1A1A2E' },
  loadingBadge: { background: '#EEF0FF', color: '#6C63FF', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20 },
  map: { flex: 1, zIndex: 1 },
  cardOverlay: { position: 'fixed', bottom: 80, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 16px', zIndex: 100 },
  card: { background: 'white', borderRadius: 20, padding: 20, width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', position: 'relative' },
  closeBtn: { position: 'absolute', top: 12, right: 12, background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  cardTop: { display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: '50%', border: '2px solid #6C63FF', flexShrink: 0, objectFit: 'cover' },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: 'Sora, sans-serif', fontSize: 17, color: '#1A1A2E' },
  cardType: { fontSize: 13, color: '#6B7280', margin: '2px 0' },
  cardInst: { fontSize: 13, color: '#9CA3AF' },
  bio: { fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 },
  skillsRow: { display: 'flex', gap: 12, marginBottom: 16 },
  skillCol: { flex: 1 },
  skillHeader: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  tagPurple: { background: '#EEF0FF', color: '#6C63FF', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  tagGreen: { background: '#E0FBF5', color: '#00A382', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  btnConnect: { width: '100%', background: 'linear-gradient(135deg, #6C63FF, #00C9A7)', color: 'white', padding: '14px', borderRadius: 14, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnChat: { width: '100%', background: '#6C63FF', color: 'white', padding: '14px', borderRadius: 14, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sentMsg: { background: '#F0FDF4', color: '#16A34A', padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 500, textAlign: 'center' },
};
