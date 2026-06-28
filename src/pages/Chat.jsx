import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { ArrowLeft, Send } from 'lucide-react';

export default function Chat({ session }) {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef();
  const channelRef = useRef();

  useEffect(() => {
    loadChat();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadChat() {
    const { data: match, error } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (error || !match) { navigate('/matches'); return; }
    const otherId = match.user1_id === session.user.id ? match.user2_id : match.user1_id;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', otherId).single();
    setOtherUser(profile);
    const { data: msgs } = await supabase.from('messages').select('*').eq('match_id', matchId).order('created_at', { ascending: true });
    setMessages(msgs || []);
    setLoading(false);
    const channel = supabase.channel(`chat-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        payload => setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe();
    channelRef.current = channel;
  }

  async function sendMessage() {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      match_id: matchId, sender_id: session.user.id, content, read: false, created_at: new Date().toISOString()
    });
    if (error) { setText(content); alert('Erro ao enviar. Tente novamente.'); }
    setSending(false);
  }

  if (loading) return <div style={styles.center}><p>Carregando...</p></div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.back} onClick={() => navigate('/matches')}><ArrowLeft size={20} /></button>
        {otherUser && <>
          <img src={otherUser.avatar_url} alt="" style={styles.avatar} />
          <div>
            <p style={styles.name}>{otherUser.name}</p>
            <p style={styles.status}>Conexão · Troca de conhecimento</p>
          </div>
        </>}
      </div>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 40 }}>👋</span>
            <p style={{ color: '#6B7280', textAlign: 'center', lineHeight: 1.6 }}>Diga olá para {otherUser?.name}!<br />Combinem um horário para estudar juntos.</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === session.user.id;
          return (
            <div key={msg.id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{ ...styles.bubble, ...(isMe ? styles.bubbleMe : styles.bubbleThem) }}>
                <p>{msg.content}</p>
                <span style={styles.time}>{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputArea}>
        <input
          placeholder="Digite uma mensagem..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          style={styles.input}
          disabled={sending}
        />
        <button style={{ ...styles.sendBtn, opacity: !text.trim() || sending ? 0.5 : 1 }}
          onClick={sendMessage} disabled={!text.trim() || sending}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#F7F8FF' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 10 },
  back: { background: '#F3F4F6', color: '#374151', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatar: { width: 40, height: 40, borderRadius: '50%' },
  name: { fontWeight: 600, fontSize: 15, color: '#1A1A2E' },
  status: { fontSize: 12, color: '#6B7280' },
  messages: { flex: 1, overflowY: 'auto', padding: '20px 16px 100px', display: 'flex', flexDirection: 'column' },
  empty: { margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32 },
  bubble: { maxWidth: '75%', padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5 },
  bubbleMe: { background: '#6C63FF', color: 'white', borderBottomRightRadius: 4 },
  bubbleThem: { background: 'white', color: '#1A1A2E', borderBottomLeftRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  time: { display: 'block', fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' },
  inputArea: { display: 'flex', gap: 12, padding: '12px 16px', background: 'white', borderTop: '1px solid #E5E7EB', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 },
  input: { flex: 1, borderRadius: 24, padding: '12px 18px', border: '2px solid #E5E7EB', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' },
  sendBtn: { background: '#6C63FF', color: 'white', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: 'pointer' },
};