import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, Heart, MapPin, BookOpen, User } from 'lucide-react';

export default function Navbar({ session }) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const tabs = [
    { icon: Compass, label: 'Descobrir', route: '/' },
    { icon: Heart, label: 'Matches', route: '/matches' },
    { icon: MapPin, label: 'Lugares', route: '/places' },
    { icon: BookOpen, label: 'Mapa', route: '/map' },
    { icon: User, label: 'Perfil', route: '/profile' },
  ];

  return (
    <nav style={styles.nav}>
      {tabs.map(({ icon: Icon, label, route }) => {
        const active = path === route;
        return (
          <button key={route} style={styles.tab} onClick={() => navigate(route)}>
            <Icon size={20} color={active ? '#6C63FF' : '#9CA3AF'} strokeWidth={active ? 2.5 : 1.8} />
            <span style={{ ...styles.label, color: active ? '#6C63FF' : '#9CA3AF', fontWeight: active ? 600 : 400 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', display: 'flex', justifyContent: 'space-around', padding: '10px 0 18px', boxShadow: '0 -2px 20px rgba(0,0,0,0.08)', zIndex: 50 },
  tab: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', padding: '0 8px' },
  label: { fontSize: 10, fontFamily: 'Inter, sans-serif' },
};
