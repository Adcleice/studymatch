import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleRegister() {
    if (!email || !password || !confirm) { setError('Preencha todos os campos.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError('Erro ao criar conta. Tente outro e-mail.');
    else setSuccess(true);
    setLoading(false);
  }

  if (success) return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontFamily: 'Sora, sans-serif', marginBottom: 12 }}>Verifique seu e-mail!</h2>
          <p style={{ color: '#6B7280', marginBottom: 24 }}>Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele para ativar sua conta.</p>
          <Link to="/login"><button className="btn-primary">Ir para o login</button></Link>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.logo}>
          <span style={{ fontSize: 56 }}>🎓</span>
          <h1 style={styles.logoText}>StudyMatch</h1>
          <p style={styles.logoSub}>Conecte conhecimentos, troque saberes</p>
        </div>
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 22, marginBottom: 24 }}>Criar conta</h2>
          {error && <div style={styles.error}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Crie uma senha (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} />
            <input type="password" placeholder="Confirme a senha" value={confirm} onChange={e => setConfirm(e.target.value)} />
            <button className="btn-primary" onClick={handleRegister} disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </div>
          <p style={{ textAlign: 'center', marginTop: 20, color: '#6B7280', fontSize: 14 }}>
            Já tem conta? <Link to="/login" style={{ color: '#6C63FF', fontWeight: 600 }}>Entrar</Link>
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
  logoText: { color: 'white', fontSize: 36, fontFamily: 'Sora, sans-serif', marginTop: 8 },
  logoSub: { color: 'rgba(255,255,255,0.85)', marginTop: 8, fontSize: 15 },
  error: { background: '#FEE2E2', color: '#EF4444', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 },
};
