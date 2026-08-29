import React,{useEffect,useMemo,useState}from'react';
import{supabase}from'../lib/supabase.js';

export const DEFAULT_AREAS=['Matemática','Física','Química','Biologia','História','Geografia','Português','Inglês','Programação','Design','Direito','Medicina','Engenharia','Arquitetura','Administração','Economia','Psicologia','Pedagogia','Nutrição','Enfermagem','Eletricidade','Mecânica','Contabilidade','Marketing','Outro'];

const normalize=v=>String(v||'').trim().replace(/\s+/g,' ');
const key=v=>normalize(v).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function uniqueAreas(values=[]){const out=[],seen=new Set();for(const raw of values){const value=normalize(raw);if(!value)continue;const k=key(value);if(seen.has(k))continue;seen.add(k);out.push(value)}return out}

export default function AreaPicker({value=[],onChange,tone='green',limit=8,placeholder='Digite uma área que não aparece acima'}){
  const[selected,setSelected]=useState(()=>uniqueAreas(value)),[catalog,setCatalog]=useState(DEFAULT_AREAS),[query,setQuery]=useState('');
  useEffect(()=>setSelected(uniqueAreas(value)),[value]);
  useEffect(()=>{let alive=true;(async()=>{const{data}=await supabase.from('profiles').select('can_help,need_help,interests').limit(1000);if(!alive)return;const learned=[];for(const p of data||[])learned.push(...(p.can_help||[]),...(p.need_help||[]),...(p.interests||[]));setCatalog(uniqueAreas([...DEFAULT_AREAS,...learned]))})();return()=>{alive=false}},[]);
  const set=v=>{const next=uniqueAreas(v).slice(0,limit);setSelected(next);onChange(next)};
  const toggle=a=>selected.some(x=>key(x)===key(a))?set(selected.filter(x=>key(x)!==key(a))):set([...selected,a]);
  const suggestions=useMemo(()=>{const q=key(query);if(!q)return[];return catalog.filter(a=>key(a).includes(q)&&!selected.some(x=>key(x)===key(a))).slice(0,6)},[query,catalog,selected]);
  function commit(raw=query){const clean=normalize(raw);if(!clean)return;const exact=catalog.find(a=>key(a)===key(clean));toggle(exact||clean);setQuery('')}
  const palette=tone==='blue'?{on:'#EAF3FF',border:'#1456A0',text:'#1456A0'}:tone==='gray'?{on:'#F2F4F7',border:'#94A3B8',text:'#26364D'}:{on:'#E8F8F2',border:'#10A77B',text:'#08785A'};
  return <div style={s.wrap}>
    <div style={s.tags}>{catalog.slice(0,35).map(a=>{const on=selected.some(x=>key(x)===key(a));return <button type="button" key={a} style={{...s.tag,...(on?{background:palette.on,borderColor:palette.border,color:palette.text,fontWeight:700}:{})}} onClick={()=>toggle(a)}>{a}</button>})}</div>
    <div style={s.inputWrap}><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit()}}} placeholder={placeholder}/>{query.trim()&&<button type="button" style={s.add} onClick={()=>commit()}>Adicionar</button>}</div>
    {suggestions.length>0&&<div style={s.suggestions}>{suggestions.map(a=><button type="button" key={a} onClick={()=>commit(a)} style={s.suggestion}>{a}</button>)}</div>}
    {selected.filter(a=>!catalog.some(c=>key(c)===key(a))).length>0&&<div style={s.custom}>{selected.filter(a=>!catalog.some(c=>key(c)===key(a))).map(a=><button type="button" key={a} onClick={()=>toggle(a)} style={{...s.customTag,background:palette.on,color:palette.text,borderColor:palette.border}}>{a} ×</button>)}</div>}
    <small style={s.hint}>Se a área já foi usada por alguém, ela aparece como sugestão. Isso ajuda a evitar grafias diferentes para o mesmo tema.</small>
  </div>
}
const s={wrap:{display:'grid',gap:8},tags:{display:'flex',flexWrap:'wrap',gap:7},tag:{padding:'7px 10px',borderRadius:18,background:'#F6F8FB',color:'#526176',border:'1px solid #E5ECF4',fontSize:11},inputWrap:{display:'grid',gridTemplateColumns:'1fr auto',gap:7,alignItems:'center'},add:{height:40,padding:'0 12px',borderRadius:11,background:'#0B2532',color:'white',fontWeight:800,fontSize:11},suggestions:{display:'flex',flexWrap:'wrap',gap:6},suggestion:{padding:'6px 9px',borderRadius:16,background:'#fff',border:'1px solid #CBD5E1',color:'#334155',fontSize:11,fontWeight:700},custom:{display:'flex',flexWrap:'wrap',gap:6},customTag:{padding:'6px 9px',borderRadius:16,border:'1px solid',fontSize:11,fontWeight:700},hint:{fontSize:10,color:'#718096',lineHeight:1.4}};