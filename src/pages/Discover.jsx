import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { Heart, X, BookOpen, Briefcase } from 'lucide-react';

export default function Discover({ session }) {
  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // 'like' | 'pass'
  const [matchPopup, setMatchPopup] = useState(null);

  useEffect(() => { loadProfiles(); }, []);

  async function loadProfiles() {
    const { data: me } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setMyProfile(me);

    // Get already swiped
    const { data: swipes } = await supabase.from('swipes').select('target_id').eq('user_id', session.user.id);
    const swipedIds = (swipes || []).map(s => s.target_id);
    swipedIds.push(session.user.id);

    // Find compatible profiles (they can help with what I need)
    const { data } = await supabase.from('profiles').select('*').not('id', 'in', `(${swipedIds.join(',')})`).limit(20);

    // Filter: they can help with something I need
    const compatible = (data || []).filter(p =>
      me.need_help && p.can_help && me.need_help.some(skill => p.can_help.includes(skill))
    );
    setProfiles(compatible);
    setLoading(false);
  }

  async function handleSwipe(liked) {
    const target = profiles[current];
    setAction(liked ? 'like' : 'pass');

    await supabase.from('swipes').insert({ user_id: session.user.id, target_id: target.id, liked });

    if (liked) {
      // Check if they also liked me
      const { data: theirSwipe } = await supabase.from('swipes')
        .select('*').eq('user_id', target.id).eq('target_id', session.user.id).eq('liked', true).single();

      if (theirSwipe) {
        // It's a match! Create match record
        await supabase.from('matches').insert({ user1_id: session.user.id, user2_id: target.id, created_at: new Date().toISOString() });
        setMatchPopup(target);
      }
    }

    setTimeout(() => {
      setAction(null);
      setCurrent(c => c + 1);
    }, 400);
  }

  if (loading) return <div style={styles.center}><p>Buscando pessoas compatíveis...</p></div>;

  const card = profiles[current];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.heading}>Descobrir pessoas</h2>
        <p style={styles.sub}>Pessoas que podem te ajudar com o que você precisa aprender</p>

        {!card ? (
          <div className="card" style={styles.empty}>
            <span style={{ fontSize: 64 }}>🔍</span>
            <h3>Nenhuma pessoa encontrada</h3>
            <p style={{ color: '#6B7280', marginTop: 8 }}>Tente atualizar suas áreas de interesse no perfil.</p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div className="card" style={{ ...styles.card, ...(action === 'like' ? styles.cardLike : action === 'pass' ? styles.cardPass : {}) }}>
              <img src={card.avatar_url} alt={card.name} style={styles.avatar} />
              <div style={styles.badge}>
                {card.type === 'estudante' ? '📚' : card.type === 'universitario' ? '🎓' : '💼'}
                <span>{card.type === 'estudante' ? 'Estudante' : card.type === 'universitario' ? 'Universitário' : 'Profissional'}</span>
              </div>
              <h2 style={styles.name}>{card.name}</h2>
              {card.institution && <p style={styles.institution}>📍 {card.institution}</p>}
              {card.bio && <p style={styles.bio}>{card.bio}</p>}

              <div style={styles.section}>
                <div style={styles.sectionHeader}><BookOpen size={16} color="#6C63FF" /><span>Pode te ajudar com:</span></div>
                <div style={styles.tags}>
                  {(card.can_help || []).filter(s => myProfile?.need_help?.includes(s)).map(s => (
                    <span key={s} style={styles.tagPurple}>{s}</span>
                  ))}
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionHeader}><Briefcase size={16} color="#00C9A7" /><span>Precisa aprender:</span></div>
                <div style={styles.tags}>
                  {(card.need_help || []).slice(0, 4).map(s => (
                    <span key={s} style={styles.tagGreen}>{s}</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.buttons}>
              <button style={styles.btnPass} onClick={() => handleSwipe(false)}><X size={28} /></button>
              <button style={styles.btnLike} onClick={() => handleSwipe(true)}><Heart size={28} /></button>
            </div>
          </div>
        )}
      </div>

      {matchPopup && (
        <div style={styles.overlay}>
          <div className="card" style={styles.matchCard}>
            <div style={{ fontSize: 64 }}>🎉</div>
            <h2 style={{ fontFamily: 'Sora, sans-serif', color: '#6C63FF', marginTop: 12 }}>É um Match!</h2>
            <p style={{ color: '#6B7280', margin: '8px 0 20px' }}>Você e <strong>{matchPopup.name}</strong> podem se ajudar!</p>
            <img src={matchPopup.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 20 }} />
            <button className="btn-primary" onClick={() => setMatchPopup(null)}>Continuar explorando</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px' },
  container: {},
  heading: { fontFamily: 'Sora, sans-serif', fontSize: 24, color: '#1A1A2E' },
  sub: { color: '#6B7280', fontSize: 14, margin: '4px 0 20px' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' },
  empty: { textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  card: { padding: 24, transition: 'transform 0.4s, opacity 0.4s', marginBottom: 20 },
  cardLike: { transform: 'translateX(60px) rotate(8deg)', opacity: 0 },
  cardPass: { transform: 'translateX(-60px) rotate(-8deg)', opacity: 0 },
  avatar: { width: 80, height: 80, borderRadius: '50%', marginBottom: 12 },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EEF0FF', color: '#6C63FF', padding: '4px 12px', borderRadius: 20, fontSize: 13, marginBottom: 12 },
  name: { fontSize: 22, fontFamily: 'Sora, sans-serif', color: '#1A1A2E' },
  institution: { color: '#6B7280', fontSize: 14, margin: '4px 0 8px' },
  bio: { color: '#374151', fontSize: 14, lineHeight: 1.5, marginBottom: 16 },
  section: { marginTop: 16 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tagPurple: { background: '#EEF0FF', color: '#6C63FF', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  tagGreen: { background: '#E0FBF5', color: '#00A382', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  buttons: { display: 'flex', justifyContent: 'center', gap: 32 },
  btnPass: { width: 64, height: 64, borderRadius: '50%', background: 'white', color: '#EF4444', boxShadow: '0 4px 20px rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 },
  btnLike: { width: 64, height: 64, borderRadius: '50%', background: '#6C63FF', color: 'white', boxShadow: '0 4px 20px rgba(108,99,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  matchCard: { maxWidth: 340, width: '100%', textAlign: 'center', padding: 32 },
};
