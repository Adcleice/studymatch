import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

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
      const { data: msgs } = await supabase.from('messages').select('*').eq('match_id', match.id).order('created_at', { ascending: false }).limit(1);
      const lastMsg = msgs?.[0] || null;
      const { count } = await supabase.from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .neq('sender_id', session.user.id)
        .eq('read', false);
      return { ...match, profile, lastMsg, unread: count || 0 };
    }));
    setMatches(enriched.filter(m => m.profile));
    setLoading(false);
  }

  async function openChat(matchId) {
    // Marca como lido e atualiza a lista
    await supabase.from('messages')
      .update({ read: true })
      .eq('match_id', matchId)
      .neq('sender_id', session.user.id);
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, unread: 0 } : m));
    navigate(`/chat/${matchId}`);
  }

  if (loading) return <div style={styles.center}><p>Carregando...</p></div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Suas Conexões</h2>
      <p style={styles.sub}>{matches.length} pessoa{matches.length !== 1 ? 's' : ''} conectada{matches.length !== 1 ? 's' : ''}</p>
      {matches.length === 0 ? (
        <div className="card" style={styles.empty}>
          <span style={{ fontSize: 64 }}>💫</span>
          <h3>Nenhuma conexão ainda</h3>
          <p style={{ color: '#6B7280', marginTop: 8 }}>Vá ao Mapa e solicite conexões!</p>
        </div>
      ) : (
        <div style={styles.list}>
          {matches.map(match => (
            <div key={match.id} style={styles.matchCard} onClick={() => openChat(match.id)}>
              <div style={styles.avatarWrap}>
                <img src={match.profile.avatar_url} alt={match.profile.name} style={styles.avatar} />
                {match.unread > 0 && <div style={styles.onlineDot} />}
              </div>
              <div style={styles.info}>
                <div style={styles.nameRow}>
                  <h3 style={{ ...styles.name, fontWeight: match.unread > 0 ? 700 : 500 }}>{match.profile.name}</h3>
                  {match.lastMsg && <span style={styles.time}>{new Date(match.lastMsg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                <div style={styles.previewRow}>
                  <p style={{ ...styles.preview, fontWeight: match.unread > 0 ? 600 : 400, color: match.unread > 0 ? '#1A1A2E' : '#9CA3AF' }}>
                    {match.lastMsg ? (match.lastMsg.sender_id === session.user.id ? 'Você: ' : '') + match.lastMsg.content : 'Toque para iniciar conversa'}
                  </p>
                  {match.unread > 0 && <div style={styles.unreadBadge}>{match.unread}</div>}
                </div>
              </div>
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
  sub: { color: '#6B7280', fontSize: 14, margin: '4px 0 8px' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' },
  empty: { textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  list: { display: 'flex', flexDirection: 'column' },
  matchCard: { display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '14px 4px', borderBottom: '1px solid #F3F4F6' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, background: '#6C63FF', borderRadius: '50%', border: '2px solid white' },
  info: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 15, fontFamily: 'Sora, sans-serif', color: '#1A1A2E' },
  time: { fontSize: 12, color: '#9CA3AF', flexShrink: 0 },
  previewRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  preview: { fontSize: 13, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  unreadBadge: { background: '#6C63FF', color: 'white', fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 },
};