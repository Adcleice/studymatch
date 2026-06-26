import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { MessageCircle } from 'lucide-react';

export default function Matches({ session }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadMatches(); }, []);

  async function loadMatches() {
    const { data } = await supabase.from('matches')
      .select('*')
      .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const enriched = await Promise.all(data.map(async match => {
      const otherId = match.user1_id === session.user.id ? match.user2_id : match.user1_id;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', otherId).single();
      return { ...match, profile };
    }));

    setMatches(enriched.filter(m => m.profile));
    setLoading(false);
  }

  if (loading) return <div style={styles.center}><p>Carregando matches...</p></div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Seus Matches</h2>
      <p style={styles.sub}>{matches.length} pessoa{matches.length !== 1 ? 's' : ''} compatível{matches.length !== 1 ? 'is' : ''}</p>

      {matches.length === 0 ? (
        <div className="card" style={styles.empty}>
          <span style={{ fontSize: 64 }}>💫</span>
          <h3>Nenhum match ainda</h3>
          <p style={{ color: '#6B7280', marginTop: 8 }}>Continue explorando pessoas na aba Descobrir!</p>
        </div>
      ) : (
        <div style={styles.list}>
          {matches.map(match => (
            <div key={match.id} className="card" style={styles.matchCard} onClick={() => navigate(`/chat/${match.id}`)}>
              <img src={match.profile.avatar_url} alt={match.profile.name} style={styles.avatar} />
              <div style={styles.info}>
                <h3 style={styles.name}>{match.profile.name}</h3>
                {match.profile.institution && <p style={styles.institution}>📍 {match.profile.institution}</p>}
                <div style={styles.tags}>
                  {(match.profile.can_help || []).slice(0, 3).map(s => (
                    <span key={s} style={styles.tag}>{s}</span>
                  ))}
                </div>
              </div>
              <button style={styles.chatBtn}><MessageCircle size={20} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' },
  heading: { fontFamily: 'Sora, sans-serif', fontSize: 24, color: '#1A1A2E' },
  sub: { color: '#6B7280', fontSize: 14, margin: '4px 0 20px' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' },
  empty: { textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  matchCard: { display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'transform 0.15s', padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: '50%', flexShrink: 0 },
  info: { flex: 1 },
  name: { fontSize: 16, fontFamily: 'Sora, sans-serif', color: '#1A1A2E' },
  institution: { color: '#6B7280', fontSize: 13, margin: '2px 0 6px' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  tag: { background: '#EEF0FF', color: '#6C63FF', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  chatBtn: { background: '#6C63FF', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};
