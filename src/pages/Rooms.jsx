import React from 'react';
import { Video } from 'lucide-react';

export default function Rooms() {
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Salas de Estudo</h2>
        <p style={styles.sub}>Estude em silêncio com outras pessoas ao vivo</p>
      </div>
      <div style={styles.coming}>
        <div style={styles.icon}><Video size={48} color="#6C63FF" /></div>
        <h3 style={styles.comingTitle}>Em breve! 🎥</h3>
        <p style={styles.comingText}>As salas de estudo virtuais estão sendo desenvolvidas. Em breve você poderá entrar em salas com câmera ligada e microfone desligado para estudar em grupo com foco total.</p>
        <div style={styles.features}>
          {['📷 Câmera ligada, microfone desligado','⏱️ Timer Pomodoro integrado','👥 Até 8 pessoas por sala','🔇 Ambiente silencioso garantido'].map(f => (
            <div key={f} style={styles.feature}>{f}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', paddingBottom: 100 },
  header: { padding: '24px 16px 20px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  title: { fontFamily: 'Sora, sans-serif', fontSize: 22, color: '#1A1A2E' },
  sub: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  coming: { margin: 24, background: 'white', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 4px 24px rgba(108,99,255,0.08)' },
  icon: { width: 80, height: 80, background: '#EEF0FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  comingTitle: { fontFamily: 'Sora, sans-serif', fontSize: 22, color: '#1A1A2E', marginBottom: 12 },
  comingText: { color: '#6B7280', fontSize: 14, lineHeight: 1.7, marginBottom: 24 },
  features: { display: 'flex', flexDirection: 'column', gap: 10 },
  feature: { background: '#F7F8FF', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#374151', textAlign: 'left' },
};
