import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Map, Heart, MapPin, User, Video, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export default function Navbar({ session }) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [unreadPeople, setUnreadPeople] = useState(0);

  useEffect(() => {
    loadUnread();
    const channel = supabase.channel('navbar-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => loadUnread())
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
        .eq('match_id', match.id)
        .neq('sender_id', session.user.id)
        .eq('read', false);
      if (c > 0) count++;
    }
    setUnreadPeople(count);
  }

  const tabs = [
    { icon: Map, label: 'Mapa', route: '/' },
    { icon: Heart, label: 'Matches', route: '/matches', badge: unreadPeople },
    { icon: Video, label: 'Salas', route: '/rooms' },
    { icon: MapPin, label: 'Lugares', route: '/places' },
    { icon: MessageSquare, label: 'Fórum', route: '/forum' },
    { icon: User, label: 'Perfil', route: '/profile' },
  ];

  return (
    <nav style={styles.nav}>
      {tabs.map(({ icon: Icon, label, route, badge }) => {
        const active = path === route;
        return (
          <button key={route} style={styles.tab} onClick={() => navigate(route)}>
            <div style={{ position: 'relative' }}>
              <Icon size={20} color={active ? '#6C63FF' : '#9CA3AF'} strokeWidth={active ? 2.5 : 1.8} />
              {badge > 0 && (
                <div style={styles.badge}>{badge}</div>
              )}
            </div>
            <span style={{ ...styles.label, color: active ? '#6C63FF' : '#9CA3AF', fontWeight: active ? 600 : 400 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', display: 'flex', justifyContent: 'space-around', padding: '10px 0 18px', boxShadow: '0 -2px 20px rgba(0,0,0,0.08)', zIndex: 50 },
  tab: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', padding: '0 4px' },
  label: { fontSize: 9, fontFamily: 'Inter, sans-serif' },
  badge: { position: 'absolute', top: -6, right: -8, background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
};