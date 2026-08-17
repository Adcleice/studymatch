import React,{useEffect,useState}from'react';

export default function GlobalAlert(){
  const[message,setMessage]=useState('');
  useEffect(()=>{const original=window.alert;window.alert=value=>setMessage(String(value??''));return()=>{window.alert=original}},[]);
  if(!message)return null;
  return <div style={s.backdrop} onClick={()=>setMessage('')}><section style={s.card} onClick={e=>e.stopPropagation()}><div style={s.accent}/><h3>StudyMatch</h3><p>{message}</p><button onClick={()=>setMessage('')} style={s.button}>Entendi</button></section></div>
}
const s={backdrop:{position:'fixed',inset:0,zIndex:6000,background:'rgba(6,24,45,.66)',backdropFilter:'blur(5px)',display:'grid',placeItems:'center',padding:18},card:{position:'relative',width:'min(100%,400px)',background:'#fff',borderRadius:22,padding:'24px 20px 18px',boxShadow:'0 28px 80px rgba(5,27,53,.28)',overflow:'hidden'},accent:{position:'absolute',top:0,left:0,right:0,height:4,background:'linear-gradient(90deg,#1456A0,#10A77B)'},button:{display:'block',margin:'18px 0 0 auto',padding:'10px 15px',borderRadius:11,background:'linear-gradient(135deg,#1456A0,#10A77B)',color:'#fff',fontWeight:800}};
