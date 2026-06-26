import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { LogOut } from 'lucide-react';

const AREAS = ['Matemática','Física','Química','Biologia','História','Geografia','Português','Inglês','Programação','Design','Direito','Medicina','Engenharia','Arquitetura','Administração','Economia','Psicologia','Pedagogia','Nutrição','Enfermagem','Eletricidade','Mecânica','Contabilidade','Marketing','Outro'];

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(data);
    setLoading(false);
  }

  function toggleTag(field, tag) {
    setProfile(p => ({
      ...p,
      [field]: p[field]?.includes(tag) ? p[field].filter(t => t !== tag) : [...(p[field] || []), tag]
    }));
  }

  async function save() {
    setSaving(true);
    await supabase.from('profiles').update({
      name: profile.name, bio: profile.bio, institution: profile.institution,
      can_help: profile.can_help, need_help: profile.need_help,
    }).eq('id', session.user.id);
    setSaving(false);
    setEditing(false);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><p>Carregando...</p></div>;

  return (
    <div style={styles.page}>
      <div style={styles.headerCard}>
        <img src={profile.avatar_url} alt="" style={styles.avatar} />
        <h2 style={styles.name}>{profile.name}</h2>
        <p style={styles.email}>{session.user.email}</p>
        <span style={styles.typeBadge}>{profile.type === 'estudante' ? '📚 Estudante' : profile.type === 'universitario' ? '🎓 Universitário' : '💼 Profissional'}</span>
      </div>

      {!editing ? (
        <>
          <div className="card" style={styles.section}>
            <h3 style={styles.sectionTitle}>Sobre mim</h3>
            <p style={styles.bio}>{profile.bio || 'Nenhuma descrição adicionada.'}</p>
            {profile.institution && <p style={styles.institution}>📍 {profile.institution}</p>}
          </div>

          <div className="card" style={styles.section}>
            <h3 style={styles.sectionTitle}>Posso ajudar com</h3>
            <div style={styles.tags}>
              {(profile.can_help || []).map(s => <span key={s} style={styles.tagPurple}>{s}</span>)}
            </div>
          </div>

          <div className="card" style={styles.section}>
            <h3 style={styles.sectionTitle}>Quero aprender</h3>
            <div style={styles.tags}>
              {(profile.need_help || []).map(s => <span key={s} style={styles.tagGreen}>{s}</span>)}
            </div>
          </div>

          <button className="btn-primary" style={{ marginBottom: 12 }} onClick={() => setEditing(true)}>✏️ Editar perfil</button>
          <button onClick={logout} style={styles.logoutBtn}><LogOut size={16} /> Sair da conta</button>
        </>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ ...styles.sectionTitle, marginBottom: 16 }}>Editando perfil</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Nome" />
            <textarea value={profile.bio || ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} placeholder="Sobre você" rows={3} style={{ resize: 'none' }} />
            <input value={profile.institution || ''} onChange={e => setProfile(p => ({ ...p, institution: e.target.value }))} placeholder="Escola / Universidade / Empresa" />

            <div>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Posso ajudar com:</p>
              <div style={styles.tags}>
                {AREAS.map(a => (
                  <button key={a} onClick={() => toggleTag('can_help', a)}
                    style={{ ...styles.tagBtn, ...(profile.can_help?.includes(a) ? styles.tagBtnActive : {}) }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Quero aprender:</p>
              <div style={styles.tags}>
                {AREAS.map(a => (
                  <button key={a} onClick={() => toggleTag('need_help', a)}
                    style={{ ...styles.tagBtn, ...(profile.need_help?.includes(a) ? styles.tagBtnActiveGreen : {}) }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-secondary" onClick={() => { setEditing(false); loadProfile(); }}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: '24px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 },
  headerCard: { background: 'white', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 4px 24px rgba(108,99,255,0.10)' },
  avatar: { width: 88, height: 88, borderRadius: '50%', marginBottom: 12, border: '3px solid #6C63FF' },
  name: { fontFamily: 'Sora, sans-serif', fontSize: 22, color: '#1A1A2E' },
  email: { color: '#6B7280', fontSize: 14, margin: '4px 0 10px' },
  typeBadge: { background: '#EEF0FF', color: '#6C63FF', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  section: { padding: 20 },
  sectionTitle: { fontFamily: 'Sora, sans-serif', fontSize: 16, color: '#1A1A2E', marginBottom: 12 },
  bio: { color: '#374151', fontSize: 14, lineHeight: 1.6 },
  institution: { color: '#6B7280', fontSize: 13, marginTop: 8 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tagPurple: { background: '#EEF0FF', color: '#6C63FF', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500 },
  tagGreen: { background: '#E0FBF5', color: '#00A382', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500 },
  tagBtn: { padding: '6px 12px', borderRadius: 20, border: '2px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  tagBtnActive: { background: '#EEF0FF', borderColor: '#6C63FF', color: '#6C63FF' },
  tagBtnActiveGreen: { background: '#E0FBF5', borderColor: '#00C9A7', color: '#00A382' },
  logoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FEE2E2', color: '#EF4444', padding: 14, borderRadius: 12, fontWeight: 600, fontSize: 15, width: '100%' },
};
