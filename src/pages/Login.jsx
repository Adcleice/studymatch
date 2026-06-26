import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) { setError('Preencha todos os campos.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('E-mail ou senha incorretos.');
    setLoading(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🎓</span>
          <h1 style={styles.logoText}>StudyMatch</h1>
          <p style={styles.logoSub}>Conecte conhecimentos, troque saberes</p>
        </div>

        <div className="card" style={styles.card}>
          <h2 style={styles.title}>Entrar</h2>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.form}>
            <input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
          <p style={styles.link}>
            Não tem conta? <Link to="/register" style={styles.linkText}>Cadastre-se</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #6C63FF 0%, #00C9A7 100%)', padding: 20 },
  container: { width: '100%', maxWidth: 400 },
  logo: { textAlign: 'center', marginBottom: 32 },
  logoIcon: { fontSize: 56 },
  logoText: { color: 'white', fontSize: 36, fontFamily: 'Sora, sans-serif', marginTop: 8 },
  logoSub: { color: 'rgba(255,255,255,0.85)', marginTop: 8, fontSize: 15 },
  card: { padding: 32 },
  title: { fontSize: 22, marginBottom: 24, color: '#1A1A2E' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  error: { background: '#FEE2E2', color: '#EF4444', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 },
  link: { textAlign: 'center', marginTop: 20, color: '#6B7280', fontSize: 14 },
  linkText: { color: '#6C63FF', fontWeight: 600 },
};
