import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Heart, User, Video, MessageSquare, Map } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export default function Navbar({ session }) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [unreadPeople, setUnreadPeople] = useState(0);

  useEffect(() => {
    loadUnread();
    const channel = supabase.channel('navbar-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadUnread)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, loadUnread)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadUnread() {
    const { data: matches } = await supabase.from('matches').select('id')
      .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`);
    if (!matches) return;
    let count = 0;
    for (const match of matches) {
      const { count: c } = await supabase.from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', match.id).neq('sender_id', session.user.id).eq('read', false);
      if (c > 0) count++;
    }
    setUnreadPeople(count);
  }

  const tabs = [
    { icon: User, label: 'Perfil', route: '/profile' },
    { icon: MapPin, label: 'Mapa', route: '/' },
    { icon: Heart, label: 'Matches', route: '/matches', badge: unreadPeople },
    { icon: Video, label: 'Salas', route: '/rooms' },
    { icon: Map, label: 'Lugares', route: '/places' },
    { icon: MessageSquare, label: 'Fórum', route: '/forum' },
  ];

  return (
    <nav style={styles.nav}>
      {tabs.map(({ icon: Icon, label, route, badge }) => {
        const active = path === route || (route === '/matches' && path.startsWith('/chat/'));
        return (
          <button key={route} style={styles.tab} onClick={() => navigate(route)} aria-label={label}>
            <div style={{ ...styles.iconWrap, ...(active ? styles.iconActive : {}) }}>
              <Icon size={20} color={active ? '#1456A0' : '#718096'} strokeWidth={active ? 2.5 : 1.9} />
              {badge > 0 && <div style={styles.badge}>{badge}</div>}
            </div>
            <span style={{ ...styles.label, color: active ? '#1456A0' : '#718096', fontWeight: active ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: { position: 'fixed', bottom: 0, left: 0, right: 0, minHeight: 70, background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(18px)', display: 'flex', justifyContent: 'center', borderTop: '1px solid #E5ECF4', boxShadow: '0 -8px 28px rgba(8,42,85,.08)', zIndex: 1000, paddingBottom: 'max(7px, env(safe-area-inset-bottom))' },
  tab: { width: 'min(16.66%, 82px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'none', padding: '7px 2px 4px' },
  iconWrap: { width: 34, height: 30, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  iconActive: { background: '#EAF3FF' },
  label: { fontSize: 9, lineHeight: 1.1 },
  badge: { position: 'absolute', top: -4, right: -5, background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid white' },
};