import React,{useState}from'react';
import{useNavigate}from'react-router-dom';
import{supabase}from'../lib/supabase.js';

const SPLIT_MENTION=/(@[a-z0-9][a-z0-9._-]{2,29})/gi;
const IS_MENTION=/^@[a-z0-9][a-z0-9._-]{2,29}$/i;

export default function CollapsibleText({text='',limit=300,style,buttonStyle}){
  const[expanded,setExpanded]=useState(false),navigate=useNavigate();
  const value=String(text||''),long=value.length>limit,shown=long&&!expanded?`${value.slice(0,limit).trimEnd()}…`:value;
  async function openMention(handle){
    const username=handle.slice(1).toLowerCase();
    const{data}=await supabase.from('profiles').select('id').eq('username',username).maybeSingle();
    if(data?.id)navigate(`/user/${data.id}`);
  }
  const parts=shown.split(SPLIT_MENTION);
  return <div style={style}>
    <span style={{whiteSpace:'pre-wrap'}}>{parts.map((part,i)=>IS_MENTION.test(part)?<button key={`${part}-${i}`} type="button" onClick={()=>openMention(part)} style={{display:'inline',background:'transparent',padding:0,color:'#1456A0',font:'inherit',fontWeight:800,verticalAlign:'baseline'}}>{part}</button>:<React.Fragment key={i}>{part}</React.Fragment>)}</span>
    {long&&<button type="button" onClick={()=>setExpanded(v=>!v)} style={{display:'inline',marginLeft:5,background:'transparent',color:'#1456A0',fontSize:'inherit',fontWeight:800,padding:0,...buttonStyle}}>{expanded?'Mostrar menos':'Ler mais'}</button>}
  </div>
}
