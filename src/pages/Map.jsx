import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircle, UserPlus, Search, SlidersHorizontal, GraduationCap, MapPin } from 'lucide-react';

async function geocodePlace(place) {
  if (!place) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place + ', Brasil')}&format=json&limit=1`, { headers: { 'Accept-Language': 'pt-BR' } });
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

export default function Map({ session }) {
  const [myProfile, setMyProfile] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [search, setSearch] = useState('');
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link'); link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    }
    if (!window.L) {
      const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.onload = () => setMapReady(true); document.head.appendChild(script);
    } else setMapReady(true);
  }, []);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (mapReady && markers.length && mapRef.current && !leafletMap.current) initMap(); }, [mapReady, markers]);

  async function loadData() {
    const { data: me } = await supabase.from('profiles').select('*').eq('id', session.user.id).single(); setMyProfile(me);
    const { data: matchData } = await supabase.from('matches').select('*').or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`);
    const matchIds = new Set((matchData || []).map(m => m.user1_id === session.user.id ? m.user2_id : m.user1_id));
    const { data: profiles } = await supabase.from('profiles').select('*').neq('id', session.user.id);
    const cache = {}; const enriched = [];
    for (const p of (profiles || [])) {
      const place = p.institution || p.city || 'São Paulo';
      if (!cache[place]) { cache[place] = await geocodePlace(place); await new Promise(r => setTimeout(r, 300)); }
      const coords = cache[place];
      if (coords) {
        const jitter = () => (Math.random() - .5) * .008;
        const match = (matchData || []).find(m => m.user1_id === p.id || m.user2_id === p.id);
        enriched.push({ ...p, lat: coords.lat + jitter(), lng: coords.lng + jitter(), isMatch: matchIds.has(p.id), matchId: match?.id });
      }
    }
    setMarkers(enriched); setLoading(false);
  }

  function initMap() {
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([-15.7801, -47.9292], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markers.forEach(m => {
      const icon = L.divIcon({ className: '', html: `<div style="width:52px;height:52px;border-radius:50%;border:3px solid ${m.isMatch ? '#10A77B' : '#fff'};background:white;overflow:hidden;cursor:pointer;box-shadow:0 5px 18px rgba(8,42,85,.28);position:relative"><img src="${m.avatar_url}" style="width:100%;height:100%;object-fit:cover" /></div>`, iconSize: [52,52], iconAnchor: [26,26] });
      L.marker([m.lat,m.lng], { icon }).addTo(map).on('click', () => openProfile(m));
    });
    leafletMap.current = map;
  }

  async function openProfile(person) {
    setSelected(person); setRequestStatus(null);
    const { data: swipe } = await supabase.from('swipes').select('*').eq('user_id', session.user.id).eq('target_id', person.id).single();
    if (swipe?.liked) setRequestStatus(person.isMatch ? 'match' : 'sent');
  }

  async function requestConnection() {
    if (!selected || requesting) return;
    setRequesting(true);
    await supabase.from('swipes').upsert({ user_id: session.user.id, target_id: selected.id, liked: true });
    const { data: theirSwipe } = await supabase.from('swipes').select('*').eq('user_id', selected.id).eq('target_id', session.user.id).eq('liked', true).single();
    if (theirSwipe) {
      await supabase.from('matches').insert({ user1_id: session.user.id, user2_id: selected.id, created_at: new Date().toISOString() });
      setSelected(s => ({ ...s, isMatch: true })); setRequestStatus('match');
    } else setRequestStatus('sent');
    setRequesting(false);
  }

  const canHelp = selected?.can_help || [];
  const needs = selected?.need_help || [];

  return <div style={styles.page}>
    <header style={styles.header}>
      <div style={styles.brand}><div style={styles.logo}><GraduationCap size={23}/></div><span>StudyMatch</span></div>
      <div style={styles.searchRow}>
        <div style={styles.searchBox}><Search size={17} color="#718096"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pessoas, áreas..." style={styles.searchInput}/></div>
        <button style={styles.filterBtn}><SlidersHorizontal size={19}/></button>
      </div>
      <div style={styles.chips}>
        <span style={styles.chip}><MapPin size={14}/> Perto de você</span>
        <span style={styles.chip}><GraduationCap size={14}/> Instituição</span>
        <span style={styles.chip}>Áreas de interesse</span>
      </div>
    </header>
    {loading && <div style={styles.loading}>Encontrando pessoas compatíveis...</div>}
    <div ref={mapRef} style={styles.map}/>

    {selected && <div style={styles.cardOverlay}><div style={styles.card}>
      <button style={styles.closeBtn} onClick={()=>setSelected(null)}><X size={17}/></button>
      <div style={styles.personTop}>
        <div style={styles.avatarWrap}><img src={selected.avatar_url} alt="" style={styles.avatar}/><span style={styles.online}/></div>
        <div><h3 style={styles.name}>{selected.name}</h3><p style={styles.type}>{selected.type === 'universitario' ? 'Estudante universitário' : selected.type === 'profissional' ? 'Profissional' : 'Estudante'}</p>{selected.institution && <p style={styles.inst}>{selected.institution}</p>}</div>
      </div>
      <div style={styles.exchange}>
        <div style={styles.exchangeCol}><b>Precisa de ajuda em</b>{needs.length ? needs.slice(0,4).map(s=><span key={s} style={styles.need}>{s}</span>) : <span style={styles.muted}>Não informado</span>}</div>
        <div style={styles.divider}/>
        <div style={styles.exchangeCol}><b>Posso ajudar com</b>{canHelp.length ? canHelp.slice(0,4).map(s=><span key={s} style={styles.help}>{s}</span>) : <span style={styles.muted}>Não informado</span>}</div>
      </div>
      {selected.bio && <p style={styles.bio}>{selected.bio}</p>}
      <div style={styles.compat}><span>Compatibilidade de troca</span><strong>{canHelp.some(x=>myProfile?.need_help?.includes(x)) ? 'Alta' : 'Explorar'}</strong></div>
      {selected.isMatch ? <button style={styles.action} onClick={()=>navigate(`/chat/${selected.matchId}`)}><MessageCircle size={18}/> Enviar mensagem</button>
      : requestStatus === 'sent' ? <div style={styles.sent}>Solicitação enviada. Aguardando resposta.</div>
      : <button style={styles.action} onClick={requestConnection} disabled={requesting}><UserPlus size={18}/>{requesting?'Enviando...':'Solicitar Conexão'}</button>}
    </div></div>}
  </div>;
}

const styles = {
  page:{height:'100vh',display:'flex',flexDirection:'column',position:'relative',background:'#EAF1F7'},
  header:{position:'absolute',top:0,left:0,right:0,zIndex:500,padding:'12px 14px 10px',background:'linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.94))',boxShadow:'0 5px 22px rgba(8,42,85,.10)'},
  brand:{display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:'Sora, sans-serif',fontWeight:800,fontSize:20,color:'#082A55',marginBottom:10},
  logo:{width:34,height:34,borderRadius:11,background:'linear-gradient(135deg,#1456A0,#10A77B)',color:'white',display:'flex',alignItems:'center',justifyContent:'center'},
  searchRow:{display:'flex',gap:8,maxWidth:720,margin:'0 auto'}, searchBox:{flex:1,height:42,border:'1px solid #E1E8F0',borderRadius:13,display:'flex',alignItems:'center',gap:8,padding:'0 12px',background:'#F7F9FC'},
  searchInput:{border:'none',boxShadow:'none',padding:0,background:'transparent',fontSize:14}, filterBtn:{width:42,borderRadius:13,background:'#F7F9FC',border:'1px solid #E1E8F0',color:'#082A55'},
  chips:{display:'flex',gap:7,overflowX:'auto',paddingTop:9,maxWidth:720,margin:'0 auto'}, chip:{display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',background:'white',border:'1px solid #DCE5EF',borderRadius:20,padding:'7px 11px',fontSize:11,fontWeight:600,color:'#334155'},
  map:{flex:1,zIndex:1}, loading:{position:'absolute',zIndex:550,top:145,left:'50%',transform:'translateX(-50%)',background:'#082A55',color:'white',padding:'7px 13px',borderRadius:20,fontSize:11,boxShadow:'0 5px 15px rgba(0,0,0,.15)'},
  cardOverlay:{position:'fixed',bottom:78,left:0,right:0,zIndex:900,display:'flex',justifyContent:'center',padding:'0 12px',pointerEvents:'none'},
  card:{pointerEvents:'auto',width:'100%',maxWidth:460,background:'rgba(255,255,255,.98)',border:'1px solid rgba(20,86,160,.10)',borderRadius:22,padding:18,boxShadow:'0 18px 55px rgba(8,42,85,.25)',position:'relative'}, closeBtn:{position:'absolute',right:12,top:12,width:30,height:30,borderRadius:50,background:'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',color:'#475569'},
  personTop:{display:'flex',alignItems:'center',gap:12,paddingRight:28,marginBottom:14}, avatarWrap:{position:'relative'}, avatar:{width:64,height:64,borderRadius:'50%',objectFit:'cover',border:'3px solid white',boxShadow:'0 3px 14px rgba(8,42,85,.18)'}, online:{position:'absolute',right:1,bottom:4,width:14,height:14,borderRadius:'50%',background:'#10A77B',border:'2px solid white'}, name:{fontSize:18,color:'#10213D'}, type:{fontSize:12,color:'#475569',marginTop:2}, inst:{fontSize:12,color:'#718096',marginTop:2},
  exchange:{display:'flex',gap:12,padding:'13px 0',borderTop:'1px solid #EDF1F5',borderBottom:'1px solid #EDF1F5'}, exchangeCol:{flex:1,display:'flex',flexDirection:'column',alignItems:'flex-start',gap:3,fontSize:11,color:'#334155'}, divider:{width:1,background:'#E5ECF4'}, need:{fontSize:12,fontWeight:700,color:'#08785A'}, help:{fontSize:12,fontWeight:700,color:'#08785A'}, muted:{fontSize:11,color:'#94A3B8'}, bio:{fontSize:12,color:'#475569',lineHeight:1.55,margin:'12px 0'}, compat:{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#EDF7F4',borderRadius:11,padding:'9px 11px',fontSize:11,color:'#47615A',marginBottom:12},
  action:{width:'100%',height:47,borderRadius:15,background:'linear-gradient(135deg,#1456A0,#10A77B)',color:'white',fontWeight:800,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 8px 20px rgba(16,167,123,.22)'}, sent:{background:'#E8F8F2',color:'#08785A',padding:12,borderRadius:13,textAlign:'center',fontSize:12,fontWeight:700}
};