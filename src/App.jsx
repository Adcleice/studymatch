import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Setup from './pages/Setup.jsx';
import Discover from './pages/Discover.jsx';
import Matches from './pages/Matches.jsx';
import Chat from './pages/Chat.jsx';
import Profile from './pages/Profile.jsx';
import Map from './pages/Map.jsx';
import Places from './pages/Places.jsx';
import Navbar from './components/Navbar.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkProfile(session.user.id);
      else { setHasProfile(false); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkProfile(userId) {
    const { data } = await supabase.from('profiles').select('id').eq('id', userId).single();
    setHasProfile(!!data);
    setLoading(false);
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, border: '4px solid #EEF0FF', borderTop: '4px solid #6C63FF', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Carregando StudyMatch...</p>
    </div>
  );

  const auth = (el) => session ? (hasProfile ? el : <Navigate to="/setup" />) : <Navigate to="/login" />;

  return (
    <BrowserRouter>
      {session && hasProfile && <Navbar session={session} />}
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
        <Route path="/setup" element={session && !hasProfile ? <Setup session={session} onComplete={() => setHasProfile(true)} /> : <Navigate to={session ? '/' : '/login'} />} />
        <Route path="/" element={auth(<Discover session={session} />)} />
        <Route path="/matches" element={auth(<Matches session={session} />)} />
        <Route path="/chat/:matchId" element={auth(<Chat session={session} />)} />
        <Route path="/profile" element={auth(<Profile session={session} />)} />
        <Route path="/map" element={auth(<Map session={session} />)} />
        <Route path="/places" element={auth(<Places session={session} />)} />
      </Routes>
    </BrowserRouter>
  );
}
