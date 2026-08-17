import React,{useState}from'react';

export default function CollapsibleText({text='',limit=300,style,buttonStyle}){
  const[expanded,setExpanded]=useState(false);
  const value=String(text||'');
  const long=value.length>limit;
  const shown=long&&!expanded?`${value.slice(0,limit).trimEnd()}…`:value;
  return <div style={style}>
    <span style={{whiteSpace:'pre-wrap'}}>{shown}</span>
    {long&&<button type="button" onClick={()=>setExpanded(v=>!v)} style={{display:'inline',marginLeft:5,background:'transparent',color:'#1456A0',fontSize:'inherit',fontWeight:800,padding:0,...buttonStyle}}>{expanded?'Mostrar menos':'Ler mais'}</button>}
  </div>
}
