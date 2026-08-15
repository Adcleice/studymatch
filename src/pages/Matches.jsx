import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { Search } from 'lucide-react';

export default function Matches({ session }) {
  const [matches, setMatches] = useState([]); const [loading,setLoading]=useState(true); const [search,setSearch]=useState(''); const navigate=useNavigate();
  useEffect(()=>{loadMatches();},[]);
  async function loadMatches(){
    const {data}=await supabase.from('matches').select('*').or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`).order('created_at',{ascending:false});
    if(!data){setLoading(false);return;}
    const enriched=await Promise.all(data.map(async match=>{
      const otherId=match.user1_id===session.user.id?match.user2_id:match.user1_id;
      const {data:profile}=await supabase.from('profiles').select('*').eq('id',otherId).single();
      const {data:msgs}=await supabase.from('messages').select('*').eq('match_id',match.id).order('created_at',{ascending:false}).limit(1);
      const {count}=await supabase.from('messages').select('*',{count:'exact',head:true}).eq('match_id',match.id).neq('sender_id',session.user.id).eq('read',false);
      return {...match,profile,lastMsg:msgs?.[0]||null,unread:count||0};
    })); setMatches(enriched.filter(m=>m.profile)); setLoading(false);
  }
  async function openChat(matchId){
    const { error } = await supabase.rpc('mark_match_messages_read', { p_match_id: matchId });
    if (!error) {
      setMatches(p=>p.map(m=>m.id===matchId?{...m,unread:0}:m));
      window.dispatchEvent(new CustomEvent('studymatch:messages-read',{detail:{matchId}}));
    }
    navigate(`/chat/${matchId}`);
  }
  const filtered=matches.filter(m=>m.profile.name?.toLowerCase().includes(search.toLowerCase()));
  return <div style={styles.page}>
    <div style={styles.header}><p style={styles.eyebrow}>NETWORKING</p><h2 style={styles.heading}>Minhas Conexões</h2><p style={styles.sub}>Converse, combine estudos e troque conhecimento.</p>
      <div style={styles.search}><Search size={17} color="#718096"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar conexão" style={styles.input}/></div>
    </div>
    <div style={styles.list}>
      {loading&&<p style={styles.state}>Carregando conexões...</p>}
      {!loading&&filtered.length===0&&<div style={styles.empty}><div style={styles.emptyIcon}>🤝</div><h3>Nenhuma conexão encontrada</h3><p>Descubra pessoas no mapa e solicite uma conexão.</p></div>}
      {filtered.map(match=><button key={match.id} style={styles.row} onClick={()=>openChat(match.id)}>
        <div style={styles.avatarWrap}><img src={match.profile.avatar_url} alt="" style={styles.avatar}/><span style={styles.online}/></div>
        <div style={styles.info}><div style={styles.nameLine}><strong>{match.profile.name}</strong>{match.lastMsg&&<span>{new Date(match.lastMsg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>}</div>
          <p style={{...styles.preview,fontWeight:match.unread?700:500,color:match.unread?'#14213D':'#718096'}}>{match.lastMsg?(match.lastMsg.sender_id===session.user.id?'Você: ':'')+match.lastMsg.content:(match.profile.can_help?.length?`Pode ajudar com ${match.profile.can_help[0]}`:'Inicie uma conversa')}</p>
          <div style={styles.meta}>{match.profile.institution&&<span>{match.profile.institution}</span>}{match.unread>0&&<b style={styles.badge}>{match.unread}</b>}</div>
        </div>
      </button>)}
    </div>
  </div>;
}
const styles={
  page:{maxWidth:620,margin:'0 auto',paddingBottom:95,minHeight:'100vh'},header:{padding:'28px 18px 18px',background:'linear-gradient(135deg,#0D4D94,#0D8B83)',color:'white',borderRadius:'0 0 24px 24px',boxShadow:'0 10px 30px rgba(8,42,85,.14)'},eyebrow:{fontSize:10,fontWeight:800,letterSpacing:1.5,opacity:.75},heading:{fontSize:24,marginTop:4},sub:{fontSize:12,opacity:.85,margin:'5px 0 15px'},search:{height:44,display:'flex',alignItems:'center',gap:8,background:'white',borderRadius:14,padding:'0 12px'},input:{border:'none',boxShadow:'none',padding:0,fontSize:13},list:{padding:'10px 14px'},row:{width:'100%',background:'white',display:'flex',alignItems:'center',gap:12,textAlign:'left',padding:'14px 10px',borderBottom:'1px solid #EDF1F5'},avatarWrap:{position:'relative',flexShrink:0},avatar:{width:58,height:58,borderRadius:'50%',objectFit:'cover',border:'2px solid #E6EEF7'},online:{position:'absolute',bottom:2,right:1,width:13,height:13,borderRadius:'50%',background:'#10A77B',border:'2px solid white'},info:{flex:1,minWidth:0},nameLine:{display:'flex',justifyContent:'space-between',gap:8,color:'#14213D',fontSize:14},nameLineSpan:{fontSize:11},preview:{fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:4},meta:{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10,color:'#94A3B8',marginTop:5},badge:{background:'#10A77B',color:'white',minWidth:19,height:19,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px'},state:{textAlign:'center',color:'#718096',padding:40},empty:{background:'white',borderRadius:20,padding:35,textAlign:'center',marginTop:18,boxShadow:'0 8px 28px rgba(20,86,160,.08)'},emptyIcon:{fontSize:42,marginBottom:10},emptyP:{color:'#718096'}
};