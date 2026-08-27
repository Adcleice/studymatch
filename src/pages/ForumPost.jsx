import React,{useEffect,useState}from'react';
import{useNavigate,useParams}from'react-router-dom';
import{supabase}from'../lib/supabase.js';
import{ArrowLeft,MessageSquare,Tag,Share2,Send,Heart,Bookmark,Flag,Trash2,MoreHorizontal}from'lucide-react';
import{shareItem,appUrl}from'../lib/share.js';
import CollapsibleText from'../components/CollapsibleText.jsx';
import OwnerPostMenu from'../components/OwnerPostMenu.jsx';
import useAppDialog from'../components/useAppDialog.jsx';

export default function ForumPost({session}){
  const{postId}=useParams(),navigate=useNavigate();
  const[post,setPost]=useState(null),[author,setAuthor]=useState(null),[replies,setReplies]=useState([]),[replyAuthors,setReplyAuthors]=useState({}),[replyText,setReplyText]=useState(''),[sending,setSending]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[liked,setLiked]=useState(false),[likeCount,setLikeCount]=useState(0),[saved,setSaved]=useState(false),[actionBusy,setActionBusy]=useState(false);
  const{alertDialog,confirmDialog,promptDialog,Dialog}=useAppDialog();

  useEffect(()=>{load();const ch=supabase.channel(`forum-post-${postId}`).on('postgres_changes',{event:'*',schema:'public',table:'forum_replies',filter:`post_id=eq.${postId}`},()=>refreshReplies()).on('postgres_changes',{event:'*',schema:'public',table:'forum_likes',filter:`post_id=eq.${postId}`},()=>refreshLikes()).subscribe();return()=>supabase.removeChannel(ch)},[postId]);

  async function load(){
    setLoading(true);setError('');
    const{data:p,error:postError}=await supabase.from('forum_posts').select('id,user_id,title,body,area,keywords,media_url,media_type,created_at,updated_at,hidden').eq('id',postId).eq('hidden',false).maybeSingle();
    if(postError||!p){setPost(null);setLoading(false);return}
    setPost(p);
    const[{data:a},{data:savedRow}]=await Promise.all([
      supabase.from('profiles').select('id,name,username,avatar_url').eq('id',p.user_id).maybeSingle(),
      supabase.from('forum_saved_posts').select('post_id').eq('user_id',session.user.id).eq('post_id',p.id).maybeSingle()
    ]);
    setAuthor(a);setSaved(!!savedRow);
    await Promise.all([refreshReplies(),refreshLikes()]);
    setLoading(false);
  }

  async function refreshReplies(){
    const{data:r,error:e}=await supabase.from('forum_replies').select('id,post_id,user_id,body,created_at,hidden').eq('post_id',postId).eq('hidden',false).order('created_at',{ascending:true});
    if(e)return;
    setReplies(r||[]);
    const ids=[...new Set((r||[]).map(x=>x.user_id))];
    if(ids.length){const{data:people}=await supabase.from('profiles').select('id,name,username,avatar_url').in('id',ids);setReplyAuthors(Object.fromEntries((people||[]).map(x=>[x.id,x])))}else setReplyAuthors({});
  }

  async function refreshLikes(){
    const{data}=await supabase.from('forum_likes').select('user_id').eq('post_id',postId);
    const rows=data||[];setLikeCount(rows.length);setLiked(rows.some(x=>x.user_id===session.user.id));
  }

  async function sendReply(){
    const body=replyText.trim();if(body.length<2||sending)return;
    setSending(true);setError('');
    const{error:e}=await supabase.from('forum_replies').insert({post_id:postId,user_id:session.user.id,body:body.slice(0,1200)});
    if(e){setError('Não foi possível responder: '+e.message);setSending(false);return}
    setReplyText('');await refreshReplies();setSending(false);
  }

  async function toggleLike(){
    if(actionBusy)return;setActionBusy(true);
    const r=liked?await supabase.from('forum_likes').delete().eq('post_id',postId).eq('user_id',session.user.id):await supabase.from('forum_likes').insert({post_id:postId,user_id:session.user.id});
    setActionBusy(false);
    if(r.error)return setError('Não foi possível atualizar a curtida: '+r.error.message);
    setLiked(v=>!v);setLikeCount(c=>Math.max(0,c+(liked?-1:1)));
  }

  async function toggleSave(){
    if(actionBusy)return;setActionBusy(true);
    const r=saved?await supabase.from('forum_saved_posts').delete().eq('user_id',session.user.id).eq('post_id',postId):await supabase.from('forum_saved_posts').insert({user_id:session.user.id,post_id:postId});
    setActionBusy(false);
    if(r.error)return setError('Não foi possível atualizar os itens salvos: '+r.error.message);
    setSaved(v=>!v);
  }

  async function deletePost(){
    if(!post||post.user_id!==session.user.id)return;
    const ok=await confirmDialog('Excluir esta publicação? As respostas também serão removidas.','Excluir publicação');if(!ok)return;
    const{error:e}=await supabase.from('forum_posts').delete().eq('id',post.id).eq('user_id',session.user.id);
    if(e)return alertDialog('Não foi possível excluir: '+e.message,'Erro');
    navigate('/forum',{replace:true});
  }

  async function deleteReply(reply){
    if(reply.user_id!==session.user.id)return;
    const ok=await confirmDialog('Excluir este comentário?','Excluir comentário');if(!ok)return;
    const{error:e}=await supabase.from('forum_replies').delete().eq('id',reply.id).eq('user_id',session.user.id);
    if(e)return alertDialog('Não foi possível excluir o comentário: '+e.message,'Erro');
    setReplies(v=>v.filter(x=>x.id!==reply.id));
  }

  async function reportContent(kind,item){
    if(item.user_id===session.user.id)return;
    const reason=await promptDialog('Informe o motivo da denúncia.',{title:'Denunciar conteúdo',placeholder:'Ex.: spam, assédio, desinformação, conteúdo impróprio...'});if(!reason?.trim())return;
    const details=await promptDialog('Se quiser, descreva detalhes adicionais.',{title:'Detalhes da denúncia',placeholder:'Opcional'});
    const payload={reporter_id:session.user.id,reason:reason.trim().slice(0,200),details:details?.trim().slice(0,1500)||null};if(kind==='post')payload.post_id=item.id;else payload.reply_id=item.id;
    const{error:e}=await supabase.from('forum_reports').insert(payload);
    if(e?.code==='23505')return alertDialog('Você já denunciou este conteúdo.','Denúncia');
    if(e)return alertDialog('Não foi possível enviar a denúncia: '+e.message,'Erro');
    await alertDialog('Denúncia enviada para análise.','Denúncia recebida');
  }

  if(loading)return <div style={s.state}>Carregando publicação...</div>;
  if(!post)return <div style={s.state}><div><h3>Publicação indisponível</h3><p>Ela pode ter sido excluída ou ocultada.</p><button className="btn-primary" onClick={()=>navigate('/forum')}>Voltar ao Fórum</button></div></div>;
  const mine=post.user_id===session.user.id;

  return <div style={s.page}>
    <header style={s.top}><button aria-label="Voltar ao fórum" onClick={()=>navigate('/forum')} style={s.back}><ArrowLeft size={18}/></button><b>Publicação</b><div style={s.topActions}>{mine&&<OwnerPostMenu post={post} onEdit={()=>navigate(`/forum/edit/${post.id}`)} onDelete={deletePost}/>}<button aria-label="Compartilhar publicação" style={s.share} onClick={()=>shareItem({title:post.title,text:`Publicação de ${author?.name||'usuário'} no StudyMatch`,url:appUrl(`/forum/post/${post.id}`)})}><Share2 size={17}/></button></div></header>

    <article style={s.post}>
      <div style={s.authorRow}><button style={s.author} onClick={()=>author&&navigate(author.id===session.user.id?'/profile':`/user/${author.id}`)}><img src={author?.avatar_url||'https://api.dicebear.com/7.x/avataaars/svg?seed=forum'} alt="" style={s.avatar}/><div><b>{author?.name||'Usuário'}</b>{author?.username&&<span style={s.handle}>@{author.username}</span>}<small>{new Date(post.created_at).toLocaleString('pt-BR')}{post.updated_at?' · Editado':''}</small></div></button>{!mine&&<button aria-label="Denunciar publicação" style={s.flag} onClick={()=>reportContent('post',post)}><Flag size={15}/></button>}</div>
      <button style={s.area} onClick={()=>navigate(`/forum?topic=${encodeURIComponent(post.area||'')}`)}>{post.area}</button>
      <h1>{post.title}</h1>
      <CollapsibleText text={post.body} limit={10000} style={s.body}/>
      {(post.keywords||[]).length>0&&<div style={s.tags}>{post.keywords.map(k=><button key={k} style={s.tag} onClick={()=>navigate(`/forum?topic=${encodeURIComponent(k)}`)}><Tag size={11}/>{k}</button>)}</div>}
      {post.media_url&&post.media_type==='image'&&<img src={post.media_url} alt="Mídia da publicação" style={s.media}/>} {post.media_url&&post.media_type==='video'&&<video src={post.media_url} controls style={s.media}/>} 
      <div style={s.postActions}><button style={liked?s.liked:s.action} onClick={toggleLike} disabled={actionBusy}><Heart size={16} fill={liked?'currentColor':'none'}/>{likeCount}</button><button style={saved?s.saved:s.action} onClick={toggleSave} disabled={actionBusy}><Bookmark size={16} fill={saved?'currentColor':'none'}/>{saved?'Salvo':'Salvar'}</button><button style={s.action} onClick={()=>shareItem({title:post.title,text:`Publicação de ${author?.name||'usuário'} no StudyMatch`,url:appUrl(`/forum/post/${post.id}`)})}><Share2 size={16}/>Compartilhar</button></div>
    </article>

    <section style={s.replies}>
      <div style={s.replyTitle}><MessageSquare size={17}/><h3>{replies.length} resposta{replies.length===1?'':'s'}</h3></div>
      <div style={s.replyComposer}><input maxLength={1200} placeholder="Responda ou marque alguém com @..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendReply()}}}/><button aria-label="Enviar resposta" disabled={sending||replyText.trim().length<2} onClick={sendReply}><Send size={16}/></button></div>
      {error&&<div style={s.error}>{error}</div>}
      {!replies.length&&<p style={s.empty}>Ainda não há respostas.</p>}
      {replies.map(r=>{const a=replyAuthors[r.user_id],own=r.user_id===session.user.id;return <div style={s.reply} key={r.id}><button aria-label={`Ver perfil de ${a?.name||'usuário'}`} style={s.replyAuthor} onClick={()=>a&&navigate(a.id===session.user.id?'/profile':`/user/${a.id}`)}><img src={a?.avatar_url||'https://api.dicebear.com/7.x/avataaars/svg?seed=reply'} alt="" style={s.replyAvatar}/></button><div style={s.replyBody}><button style={s.replyName} onClick={()=>a&&navigate(a.id===session.user.id?'/profile':`/user/${a.id}`)}><b>{a?.name||'Usuário'}</b>{a?.username&&<small>@{a.username}</small>}</button><CollapsibleText text={r.body} limit={1000} style={s.replyText}/><small>{new Date(r.created_at).toLocaleString('pt-BR')}</small></div>{own?<button aria-label="Excluir comentário" style={s.replyToolDanger} onClick={()=>deleteReply(r)}><Trash2 size={14}/></button>:<button aria-label="Denunciar comentário" style={s.replyTool} onClick={()=>reportContent('reply',r)}><Flag size={14}/></button>}</div>})}
    </section>
    <Dialog/>
  </div>
}

const s={page:{maxWidth:680,margin:'0 auto',paddingBottom:95},top:{height:58,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',background:'linear-gradient(135deg,#1456A0,#0D8B83)',color:'white'},topActions:{display:'flex',gap:7,alignItems:'center'},back:{width:36,height:36,borderRadius:'50%',background:'#ffffff22',color:'white'},share:{width:36,height:36,borderRadius:'50%',background:'#ffffff22',color:'white'},post:{background:'white',margin:14,padding:17,borderRadius:18,boxShadow:'0 5px 18px #082a5510'},authorRow:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8},author:{display:'flex',alignItems:'center',gap:9,background:'transparent',textAlign:'left',minWidth:0},avatar:{width:42,height:42,borderRadius:'50%',objectFit:'cover',background:'#E7EEF7'},handle:{display:'block',fontSize:10,color:'#1456A0',marginTop:1},flag:{background:'transparent',color:'#A35B65',padding:7},area:{display:'inline-flex',marginTop:12,padding:'5px 8px',borderRadius:12,background:'#EAF1FF',color:'#1456A0',fontSize:10,fontWeight:800},body:{fontSize:14,lineHeight:1.6,color:'#334155',whiteSpace:'pre-wrap',marginTop:8},tags:{display:'flex',flexWrap:'wrap',gap:5,marginTop:10},tag:{display:'flex',alignItems:'center',gap:3,padding:'5px 8px',borderRadius:13,background:'#F0F7F5',color:'#08785A',fontSize:10,fontWeight:700},media:{width:'100%',maxHeight:520,objectFit:'contain',borderRadius:14,marginTop:12,background:'#07111D'},postActions:{display:'flex',alignItems:'center',gap:13,flexWrap:'wrap',borderTop:'1px solid #EEF2F6',paddingTop:11,marginTop:13},action:{display:'flex',alignItems:'center',gap:5,background:'transparent',color:'#64748B',fontSize:11},liked:{display:'flex',alignItems:'center',gap:5,background:'transparent',color:'#E23B57',fontSize:11,fontWeight:800},saved:{display:'flex',alignItems:'center',gap:5,background:'transparent',color:'#1456A0',fontSize:11,fontWeight:800},replies:{margin:14,background:'white',padding:16,borderRadius:18},replyTitle:{display:'flex',alignItems:'center',gap:7,color:'#1456A0',marginBottom:9},replyComposer:{display:'grid',gridTemplateColumns:'1fr 40px',gap:7,marginBottom:9},reply:{display:'flex',gap:9,padding:'11px 0',borderTop:'1px solid #EEF2F6',alignItems:'flex-start'},replyAuthor:{alignSelf:'flex-start',background:'transparent',padding:0},replyAvatar:{width:32,height:32,borderRadius:'50%',objectFit:'cover',background:'#E7EEF7'},replyBody:{flex:1,minWidth:0},replyName:{display:'flex',alignItems:'baseline',gap:6,background:'transparent',padding:0,color:'#17233A'},replyText:{fontSize:12,lineHeight:1.5,color:'#475569',margin:'3px 0'},replyTool:{background:'transparent',color:'#A35B65',padding:5},replyToolDanger:{background:'transparent',color:'#D94B5B',padding:5},error:{background:'#FFF1F2',color:'#B42332',padding:9,borderRadius:10,fontSize:11},empty:{color:'#718096',fontSize:12,padding:'10px 0 18px'},state:{minHeight:'70vh',display:'grid',placeItems:'center',textAlign:'center',padding:25}};