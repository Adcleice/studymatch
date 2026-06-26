import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AREAS = ['Matemática','Física','Química','Biologia','História','Geografia','Português','Inglês','Programação','Design','Direito','Medicina','Engenharia','Arquitetura','Administração','Economia','Psicologia','Pedagogia','Nutrição','Enfermagem','Eletricidade','Mecânica','Contabilidade','Marketing','Outro'];

export default function Setup({ session, onComplete }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [type, setType] = useState('estudante');
  const [institution, setInstitution] = useState('');
  const [canHelp, setCanHelp] = useState([]);
  const [needHelp, setNeedHelp] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleTag(list, setList, tag) {
    setList(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag]);
  }

  async function handleSave() {
    if (canHelp.length === 0 || needHelp.length === 0) { setError('Selecione pelo menos uma área em cada campo.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      email: session.user.email,
      name, bio, type, institution,
      can_help: canHelp,
      need_help: needHelp,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`,
      created_at: new Date().toISOString(),
    });
    if (error) { setError('Erro ao salvar perfil. Tente novamente.'); setLoading(false); return; }
    onComplete();
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={{ fontSize: 40 }}>🎓</span>
          <h1 style={styles.title}>Configure seu perfil</h1>
          <div style={styles.steps}>
            {[1,2,3].map(s => (
              <div key={s} style={{ ...styles.step, background: step >= s ? '#6C63FF' : '#E5E7EB' }} />
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {error && <div style={styles.error}>{error}</div>}

          {step === 1 && (
            <div style={styles.form}>
              <h2 style={styles.stepTitle}>Quem é você?</h2>
              <input placeholder="Seu nome completo" value={name} onChange={e => setName(e.target.value)} />
              <textarea placeholder="Fale um pouco sobre você (opcional)" value={bio} onChange={e => setBio(e.target.value)} rows={3} style={{ resize: 'none' }} />
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="estudante">Estudante</option>
                <option value="universitario">Universitário</option>
                <option value="profissional">Profissional</option>
              </select>
              <input placeholder="Escola, universidade ou empresa (opcional)" value={institution} onChange={e => setInstitution(e.target.value)} />
              <button className="btn-primary" onClick={() => { if (!name) { setError('Informe seu nome.'); return; } setError(''); setStep(2); }}>
                Próximo →
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={styles.form}>
              <h2 style={styles.stepTitle}>No que você é bom? 💪</h2>
              <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 4 }}>Selecione as áreas em que pode ajudar outras pessoas:</p>
              <div style={styles.tags}>
                {AREAS.map(a => (
                  <button key={a} onClick={() => toggleTag(canHelp, setCanHelp, a)}
                    style={{ ...styles.tag, ...(canHelp.includes(a) ? styles.tagActive : {}) }}>
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-secondary" onClick={() => setStep(1)}>← Voltar</button>
                <button className="btn-primary" onClick={() => { if (canHelp.length === 0) { setError('Selecione pelo menos uma área.'); return; } setError(''); setStep(3); }}>
                  Próximo →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={styles.form}>
              <h2 style={styles.stepTitle}>O que você precisa aprender? 📚</h2>
              <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 4 }}>Selecione as áreas em que precisa de ajuda:</p>
              <div style={styles.tags}>
                {AREAS.map(a => (
                  <button key={a} onClick={() => toggleTag(needHelp, setNeedHelp, a)}
                    style={{ ...styles.tag, ...(needHelp.includes(a) ? styles.tagActiveGreen : {}) }}>
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-secondary" onClick={() => setStep(2)}>← Voltar</button>
                <button className="btn-primary" onClick={handleSave} disabled={loading}>
                  {loading ? 'Salvando...' : '🚀 Começar a usar!'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #6C63FF 0%, #00C9A7 100%)', padding: 20 },
  container: { width: '100%', maxWidth: 480 },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { color: 'white', fontFamily: 'Sora, sans-serif', fontSize: 26, margin: '12px 0' },
  steps: { display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 },
  step: { width: 40, height: 6, borderRadius: 3, transition: 'background 0.3s' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  stepTitle: { fontSize: 20, fontFamily: 'Sora, sans-serif', color: '#1A1A2E' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: { padding: '8px 14px', borderRadius: 20, border: '2px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' },
  tagActive: { background: '#EEF0FF', borderColor: '#6C63FF', color: '#6C63FF' },
  tagActiveGreen: { background: '#E0FBF5', borderColor: '#00C9A7', color: '#00A382' },
  error: { background: '#FEE2E2', color: '#EF4444', padding: '12px 16px', borderRadius: 10, marginBottom: 8, fontSize: 14 },
};
