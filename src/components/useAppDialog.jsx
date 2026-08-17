import React,{useRef,useState}from'react';

export default function useAppDialog(){
  const[state,setState]=useState(null);const resolver=useRef(null);
  function open(config){return new Promise(resolve=>{resolver.current=resolve;setState({...config,value:config.defaultValue||''})})}
  function close(value){resolver.current?.(value);resolver.current=null;setState(null)}
  const alertDialog=(message,title='Aviso')=>open({type:'alert',title,message});
  const confirmDialog=(message,title='Confirmar ação')=>open({type:'confirm',title,message});
  const promptDialog=(message,{title='Informe os dados',defaultValue='',placeholder=''}={})=>open({type:'prompt',title,message,defaultValue,placeholder});
  const Dialog=()=>!state?null:<div style={s.backdrop} onClick={()=>close(state.type==='confirm'?false:null)}><section style={s.card} onClick={e=>e.stopPropagation()}><div style={s.accent}/><h3>{state.title}</h3>{state.message&&<p>{state.message}</p>}{state.type==='prompt'&&<textarea autoFocus rows={3} value={state.value} placeholder={state.placeholder} onChange={e=>setState(x=>({...x,value:e.target.value}))} style={s.input}/>}<div style={s.actions}>{state.type!=='alert'&&<button style={s.cancel} onClick={()=>close(state.type==='confirm'?false:null)}>Cancelar</button>}<button style={s.ok} onClick={()=>close(state.type==='prompt'?state.value:state.type==='confirm'?true:null)}>{state.type==='alert'?'Entendi':'Confirmar'}</button></div></section></div>;
  return{alertDialog,confirmDialog,promptDialog,Dialog};
}

const s={backdrop:{position:'fixed',inset:0,zIndex:5000,background:'rgba(6,24,45,.68)',backdropFilter:'blur(5px)',display:'grid',placeItems:'center',padding:18},card:{position:'relative',width:'min(100%,410px)',background:'#fff',borderRadius:22,padding:'24px 20px 18px',boxShadow:'0 28px 80px rgba(5,27,53,.28)',overflow:'hidden'},accent:{position:'absolute',top:0,left:0,right:0,height:4,background:'linear-gradient(90deg,#1456A0,#10A77B)'},actions:{display:'flex',gap:9,justifyContent:'flex-end',marginTop:18},cancel:{padding:'10px 14px',borderRadius:11,background:'#EEF2F6',color:'#526176',fontWeight:800},ok:{padding:'10px 15px',borderRadius:11,background:'linear-gradient(135deg,#1456A0,#10A77B)',color:'#fff',fontWeight:800},input:{marginTop:12,resize:'vertical'}};
