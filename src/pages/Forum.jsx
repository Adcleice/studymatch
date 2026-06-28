import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function Forum() {
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Fórum</h2>
        <p style={styles.sub}>Discussões, dúvidas e conhecimento compartilhado</p>
      </div>
      <div style={styles.coming}>
        <div style={styles.icon}><MessageSquare size={48} color="#00C9A7" /></div>
        <h3 style={styles.comingTitle}>Em breve! 💬</h3>
        <p style={styles.comingText}>O fórum do StudyMatch será um espaço para tirar dúvidas, compartilhar conhecimento e discutir assuntos acadêmicos e profissionais — como um Reddit focado em aprendizado.</p>
        <div style={styles.features}>
          {['📚 Posts por matéria ou área','👍 Curtidas e respostas','🏆 Ranking de contribuidores','🔔 Notificações de respostas'].map(f => (
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
  icon: { width: 80, height: 80, background: '#E0FBF5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  comingTitle: { fontFamily: 'Sora, sans-serif', fontSize: 22, color: '#1A1A2E', marginBottom: 12 },
  comingText: { color: '#6B7280', fontSize: 14, lineHeight: 1.7, marginBottom: 24 },
  features: { display: 'flex', flexDirection: 'column', gap: 10 },
  feature: { background: '#F7F8FF', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#374151', textAlign: 'left' },
};
