import React,{useEffect,useState}from'react';
import{useNavigate,useParams}from'react-router-dom';
import{supabase}from'../lib/supabase.js';
import{shareItem,appUrl}from'../lib/share.js';
import ReputationSummary from'../components/ReputationSummary.jsx';
import CollapsibleText from'../components/CollapsibleText.jsx';
import useAppDialog from'../components/useAppDialog.jsx';
import{ArrowLeft,BookOpen,Briefcase,MapPin,MessageSquare,Share2,ChevronDown,ChevronUp,AtSign,Tag,Star,UserPlus,MessageCircle,Clock3,Ban,Flag}from'lucide-react';

const PUBLIC_PROFILE_FIELDS='id,name,username,avatar_url,bio,type,institution,course_or_role,city,age,can_help,need_help,interests,keywords,show_age,show_institution,show_city,appear_on_map,allow_connection_requests';

function ProfileAvatar({src,name}){const[failed,setFailed]=useState(false);if(!src||failed)return <div style={s.avatarFallback}>{name?.trim()?.[0]?.toUpperCase()||'?'}</div>;return <img src={src} alt={name?`Foto de ${name}`:''} style={s.avatar} onError={()=>setFailed(true)}/>}

export default function UserProfile({session}){
  const{userId}=useParams(),navigate=useNavigate();
  const[p,setP]=useState(null),[posts,setPosts]=useState([]),[showAll,setShowAll]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[relationship,setRelationship]=useState({type:'loading'}),[busy,setBusy]=useState(false),[blockedByMe,setBlockedByMe]=useState(false);
  const{alertDialog,confirmDialog,promptDialog,Dialog}=useAppDialog();
  useEffect(()=>{if(userId===session.user.id){navigate('/profile',{replace:true});return}load()},[userId,session.user.id]);

  async function load(){
    setLoading(true);setError('');
    const[{data:profile,error:profileError},{data:rawPosts,error:postsError}]=await Promise.all([
      supabase.from('profiles').select(PUBLIC_PROFILE_FIELDS).eq('id',userId).maybeSingle(),
      supabase.from('forum_posts').select('id,title,body,area,keywords,media_url,media_type,created_at,updated_at').eq('user_id',userId).eq('hidden',false).order('created_at',{ascending:false})
    ]);
    if(profileError||!profile){setP(null);setError('Perfil não encontrado ou indisponível.');setLoading(false);return}
    setP(profile);setPosts(postsError?[]:(rawPosts||[]));
    await loadRelationship();
    setLoading(false);
  }

  async function loadRelationship(){
    const[{data:blocks},{data:matches}]=await Promise.all([
      supabase.from('user_blocks').select('blocker_id,blocked_id').or(`and(blocker_id.eq.${session.user.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${session.user.id})`),
      supabase.from('matches').select('id,user1_id,user2_id').or(`and(user1_id.eq.${session.user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${session.user.id})`).limit(1)
    ]);
    const block=(blocks||[])[0];
    if(block){setBlockedByMe(block.blocker_id===session.user.id);setRelationship({type:block.blocker_id===session.user.id?'blocked':'blocked_by_other'});return}
    setBlockedByMe(false);
    if(matches?.[0]){setRelationship({type:'match',matchId:matches[0].id});return}
    const{data:reqs}=await supabase.from('connection_requests').select('id,requester_id,recipient_id,status').eq('status','pending').or(`and(requester_id.eq.${session.user.id},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${session.user.id})`).limit(1);
    const req=reqs?.[0];
    if(!req){setRelationship({type:'none'});return}
    setRelationship({type:req.requester_id===session.user.id?'sent':'received',requestId:req.id});
  }

  async function connect(){
    if(busy||!p)return;setBusy(true);
    const{error:e}=await supabase.rpc('send_connection_request',{p_recipient_id:p.id});
    setBusy(false);
    if(e)return alertDialog('Não foi possível enviar a solicitação: '+e.message,'Conexão');
    setRelationship({type:'sent'});window.dispatchEvent(new Event('studymatch:requests-changed'));
  }

  async function blockUser(){
    if(!p||busy)return;
    const ok=await confirmDialog(`Bloquear ${p.name}? Vocês deixarão de aparecer um para o outro e uma conexão existente será removida.`,'Bloquear usuário');
    if(!ok)return;setBusy(true);
    const{error:e}=await supabase.rpc('block_user',{p_blocked_id:p.id});
    setBusy(false);
    if(e)return alertDialog('Não foi possível bloquear: '+e.message,'Erro');
    setBlockedByMe(true);setRelationship({type:'blocked'});window.dispatchEvent(new Event('studymatch:requests-changed'));
  }

  async function unblockUser(){
    if(!p||busy)return;setBusy(true);
    const{error:e}=await supabase.from('user_blocks').delete().eq('blocker_id',session.user.id).eq('blocked_id',p.id);
    setBusy(false);
    if(e)return alertDialog('Não foi possível desbloquear: '+e.message,'Erro');
    setBlockedByMe(false);setRelationship({type:'none'});await alertDialog(`${p.name} foi desbloqueado.`,'Perfil desbloqueado');
  }

  async function reportUser(){
    if(!p)return;
    const reason=await promptDialog('Informe o motivo da denúncia.',{title:'Denunciar usuário',placeholder:'Ex.: spam, assédio, perfil falso, cobrança indevida...'});
    if(!reason?.trim())return;
    const details=await promptDialog('Se quiser, descreva detalhes adicionais.',{title:'Detalhes da denúncia',placeholder:'Opcional'});
    const{error:e}=await supabase.from('user_reports').insert({reporter_id:session.user.id,reported_id:p.id,reason:reason.trim().slice(0,200),details:details?.trim().slice(0,1500)||null});
    if(e)return alertDialog('Não foi possível enviar a denúncia: '+e.message,'Erro');
    await alertDialog('Denúncia enviada para análise.','Denúncia recebida');
  }

  function PrimaryAction(){
    if(relationship.type==='loading')return <button style={s.primaryDisabled} disabled><Clock3 size={16}/>Verificando conexão...</button>;
    if(relationship.type==='match')return <button style={s.primary} onClick={()=>navigate(`/chat/${relationship.matchId}`)}><MessageCircle size={17}/>Enviar mensagem</button>;
    if(relationship.type==='sent')return <button style={s.primaryDisabled} disabled><Clock3 size={16}/>Solicitação enviada</button>;
    if(relationship.type==='received')return <button style={s.primary} onClick={()=>navigate('/matches')}><UserPlus size={17}/>Responder solicitação</button>;
    if(relationship.type==='blocked')return <button style={s.unblock} onClick={unblockUser} disabled={busy}><Ban size={16}/>{busy?'Aguarde...':'Desbloquear usuário'}</button>;
    if(relationship.type==='blocked_by_other')return <div style={s.closed}>Este perfil não está disponível para interação.</div>;
    if(p?.allow_connection_requests===false)return <div style={s.closed}>Este usuário não está aceitando novas solicitações.</div>;
    return <button style={s.primary} onClick={connect} disabled={busy}><UserPlus size={17}/>{busy?'Enviando...':'Solicitar conexão'}</button>;
  }

  if(loading)return <div style={s.center}>Carregando perfil...</div>;
  if(error)return <div style={s.center}><div><b>{error}</b><button style={s.backToMap} onClick={()=>navigate('/')}>Voltar ao mapa</button></div></div>;
  if(!p)return <div style={s.center}>Perfil não encontrado.</div>;
  const visible=showAll?posts:posts.slice(0,5);

  return <div style={s.page}>
    <header style={s.hero}>
      <button aria-label="Voltar" style={s.back} onClick={()=>navigate(-1)}><ArrowLeft size={18}/></button>
      <button aria-label="Compartilhar perfil" style={s.shareProfile} onClick={()=>shareItem({title:`Perfil de ${p.name} no StudyMatch`,text:`${p.username?'@'+p.username+' · ':''}Veja o perfil de ${p.name} no StudyMatch.`,url:appUrl(`/user/${p.id}`)})}><Share2 size={17}/></button>
      <div style={s.identity}><ProfileAvatar src={p.avatar_url} name={p.name}/><div style={s.identityText}><h2 style={s.name}>{p.name}{p.show_age!==false&&p.age?`, ${p.age}`:''}</h2>{p.username&&<span style={s.handle}><AtSign size={11}/>{p.username}</span>}<p style={s.role}>{p.course_or_role||(p.type==='profissional'?'Profissional':p.type==='universitario'?'Estudante universitário':'Estudante')}</p>{p.show_institution!==false&&p.institution&&<span style={s.inst}><MapPin size={12}/>{p.institution}</span>}{p.show_city&&p.city&&<span style={s.inst}><MapPin size={12}/>{p.city}</span>}</div></div>
      <div style={s.rep}><div style={s.repTitle}>Reputação na comunidade</div><ReputationSummary userId={p.id} hero/></div>
    </header>

    <section style={s.actionsCard}><PrimaryAction/><div style={s.safetyActions}><button onClick={reportUser} style={s.safety}><Flag size={14}/>Denunciar</button>{relationship.type!=='blocked'&&relationship.type!=='blocked_by_other'&&<button onClick={blockUser} style={s.safetyDanger}><Ban size={14}/>Bloquear</button>}</div></section>

    <section style={s.card}><h3 style={s.cardHeading}>Sobre</h3><CollapsibleText text={p.bio||'Sem apresentação.'} limit={420} style={s.bio}/></section>
    <div style={s.grid}>
      <section style={s.card}><div style={s.title}><Briefcase size={16}/>Posso ajudar com</div>{(p.can_help||[]).length?<div style={s.tags}>{p.can_help.map(x=><span style={s.green} key={x}>{x}</span>)}</div>:<span style={s.muted}>Não informado.</span>}</section>
      <section style={s.card}><div style={s.title}><BookOpen size={16}/>Preciso de ajuda em</div>{(p.need_help||[]).length?<div style={s.tags}>{p.need_help.map(x=><span style={s.blue} key={x}>{x}</span>)}</div>:<span style={s.muted}>Não informado.</span>}</section>
      {(p.interests||[]).length>0&&<section style={s.card}><div style={s.title}><Star size={16}/>Interesses</div><div style={s.tags}>{p.interests.map(x=><span style={s.gray} key={x}>{x}</span>)}</div></section>}
      {(p.keywords||[]).length>0&&<section style={s.card}><div style={s.title}><Tag size={16}/>Especialidades e temas</div><div style={s.tags}>{p.keywords.map(x=><span style={s.keyword} key={x}>{x}</span>)}</div></section>}
    </div>

    <section style={s.section}><div style={s.sectionHead}><div style={s.sectionTitle}><MessageSquare size={17}/><h3>Publicações</h3></div><span style={s.count}>{posts.length}</span></div>
      {!posts.length?<div style={s.empty}>Nenhuma publicação ainda.</div>:<>{visible.map(post=><article style={s.post} key={post.id}><div style={s.postTop}><button style={s.areaBtn} onClick={()=>navigate(`/forum?topic=${encodeURIComponent(post.area||'')}`)}>{post.area}</button><div style={s.postTopRight}><small>{new Date(post.created_at).toLocaleDateString('pt-BR')}{post.updated_at?' · Editado':''}</small><button aria-label="Compartilhar publicação" style={s.sharePost} onClick={()=>shareItem({title:post.title,text:`Publicação de ${p.name} no StudyMatch`,url:appUrl(`/forum/post/${post.id}`)})}><Share2 size={14}/></button></div></div><button style={s.postOpen} onClick={()=>navigate(`/forum/post/${post.id}`)}><h3>{post.title}</h3></button><CollapsibleText text={post.body} limit={300} style={s.postBody}/>{post.media_url&&post.media_type==='image'&&<img src={post.media_url} alt="" style={s.media}/>} {post.media_url&&post.media_type==='video'&&<video controls src={post.media_url} style={s.media}/>}</article>)}{posts.length>5&&<button style={s.expand} onClick={()=>setShowAll(v=>!v)}>{showAll?<><ChevronUp size={16}/>Mostrar menos</>:<><ChevronDown size={16}/>Ver todas as {posts.length} publicações</>}</button>}</>}
    </section>
    <Dialog/>
  </div>
}

const primaryBase={width:'100%',height:44,borderRadius:13,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',gap:7};
const s={page:{maxWidth:650,margin:'0 auto',paddingBottom:100},center:{height:'70vh',display:'grid',placeItems:'center',padding:24,textAlign:'center',color:'#64748B'},backToMap:{display:'block',margin:'14px auto 0',padding:'10px 14px',borderRadius:12,background:'#EAF3FF',color:'#1456A0',fontWeight:800},hero:{position:'relative',background:'linear-gradient(118deg,#115A9E 0%,#0D7E8E 58%,#0B9784 100%)',color:'white',padding:'22px 24px 15px',borderRadius:'0 0 22px 22px',boxShadow:'0 8px 28px rgba(8,42,85,.13)'},back:{position:'absolute',left:12,top:12,width:34,height:34,borderRadius:11,background:'rgba(255,255,255,.12)',color:'white',display:'grid',placeItems:'center'},shareProfile:{position:'absolute',right:12,top:12,width:34,height:34,borderRadius:11,background:'rgba(255,255,255,.12)',color:'white',display:'grid',placeItems:'center'},identity:{display:'flex',alignItems:'center',gap:15,maxWidth:430,margin:'0 auto',padding:'4px 42px 12px 0'},avatar:{width:76,height:76,borderRadius:'50%',objectFit:'cover',border:'3px solid rgba(255,255,255,.95)',background:'#DCE9F7',boxShadow:'0 4px 14px rgba(0,0,0,.12)',flexShrink:0},avatarFallback:{width:76,height:76,borderRadius:'50%',display:'grid',placeItems:'center',border:'3px solid rgba(255,255,255,.95)',background:'#DCE9F7',color:'#1456A0',fontWeight:900,fontSize:26,flexShrink:0},identityText:{minWidth:0,textAlign:'left'},name:{fontSize:19,color:'#fff',lineHeight:1.15},handle:{display:'inline-flex',alignItems:'center',gap:1,fontSize:10.5,fontWeight:700,opacity:.72,marginTop:2},role:{fontSize:12,marginTop:3,opacity:.95},inst:{display:'flex',alignItems:'center',gap:4,fontSize:10.5,marginTop:5,opacity:.78},rep:{maxWidth:430,margin:'0 auto',paddingTop:8,borderTop:'1px solid rgba(255,255,255,.18)'},repTitle:{fontSize:8.5,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',opacity:.66,marginBottom:5},actionsCard:{margin:'11px 14px 0',background:'#fff',border:'1px solid #E3EAF2',borderRadius:15,padding:11,boxShadow:'0 2px 9px rgba(8,42,85,.025)'},primary:{...primaryBase,background:'linear-gradient(135deg,#1456A0,#10A77B)',color:'#fff'},primaryDisabled:{...primaryBase,background:'#EEF2F6',color:'#718096'},unblock:{...primaryBase,background:'#EEF5FF',color:'#1456A0'},closed:{padding:11,borderRadius:12,background:'#F1F5F9',color:'#64748B',textAlign:'center',fontSize:12,fontWeight:700},safetyActions:{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8},safety:{display:'flex',alignItems:'center',gap:4,padding:'6px 8px',background:'transparent',color:'#718096',fontSize:10.5,fontWeight:700},safetyDanger:{display:'flex',alignItems:'center',gap:4,padding:'6px 8px',background:'transparent',color:'#B42332',fontSize:10.5,fontWeight:700},card:{background:'white',margin:'11px 14px',padding:16,border:'1px solid #E3EAF2',borderRadius:15,boxShadow:'0 2px 9px rgba(8,42,85,.025)'},cardHeading:{fontSize:14,color:'#10213D',marginBottom:7},bio:{fontSize:13,lineHeight:1.6,color:'#526176'},grid:{display:'grid',gridTemplateColumns:'1fr'},title:{display:'flex',alignItems:'center',gap:7,fontWeight:700,color:'#1456A0',marginBottom:9},tags:{display:'flex',flexWrap:'wrap',gap:6},green:{background:'#E8F8F2',color:'#08785A',padding:'5px 9px',borderRadius:16,fontSize:11,fontWeight:700},blue:{background:'#EAF3FF',color:'#1456A0',padding:'5px 9px',borderRadius:16,fontSize:11,fontWeight:700},gray:{background:'#F2F4F7',color:'#526176',padding:'5px 9px',borderRadius:16,fontSize:11,fontWeight:700},keyword:{background:'#F0F5FA',color:'#334155',padding:'5px 9px',borderRadius:16,fontSize:10.5,fontWeight:700},muted:{fontSize:11,color:'#94A3B8'},section:{padding:'0 14px'},sectionHead:{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'16px 0 10px'},sectionTitle:{display:'flex',alignItems:'center',gap:7,color:'#10213D'},count:{background:'#EAF3FF',color:'#1456A0',minWidth:28,height:28,borderRadius:14,display:'grid',placeItems:'center',fontSize:11,fontWeight:800},empty:{background:'white',padding:25,border:'1px solid #E3EAF2',borderRadius:16,textAlign:'center',color:'#718096'},post:{background:'white',border:'1px solid #E3EAF2',borderRadius:14,padding:15,marginBottom:8},postTop:{display:'flex',justifyContent:'space-between',alignItems:'center',color:'#718096',fontSize:10,marginBottom:7},areaBtn:{background:'transparent',color:'#1456A0',fontSize:10,fontWeight:800,padding:0},postTopRight:{display:'flex',alignItems:'center',gap:7},sharePost:{background:'transparent',color:'#1456A0',padding:2},postOpen:{display:'block',width:'100%',background:'transparent',textAlign:'left',padding:0,color:'#10213D'},postBody:{fontSize:13,lineHeight:1.55,color:'#334155',marginTop:6},media:{width:'100%',maxHeight:420,objectFit:'contain',borderRadius:12,marginTop:10,background:'#07111D'},expand:{width:'100%',height:42,borderRadius:13,background:'#EEF5FF',color:'#1456A0',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',gap:6}};