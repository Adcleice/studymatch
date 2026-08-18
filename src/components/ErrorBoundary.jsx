import React from'react';

export default class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return{error}}
  componentDidCatch(error,info){console.error('StudyMatch UI error',error,info)}
  render(){if(!this.state.error)return this.props.children;return <main style={s.page}><section style={s.card}><div style={s.mark}>!</div><h2>Algo não carregou corretamente</h2><p>Seus dados não foram apagados. Recarregue o StudyMatch para tentar novamente.</p><button className="btn-primary" onClick={()=>window.location.reload()}>Recarregar aplicativo</button><button style={s.secondary} onClick={()=>{window.location.href='/'}}>Ir para o mapa</button></section></main>}
}
const s={page:{minHeight:'100vh',display:'grid',placeItems:'center',padding:20,background:'#F4F7FA'},card:{width:'min(100%,420px)',background:'#fff',border:'1px solid #E3EAF2',borderRadius:20,padding:24,textAlign:'center',boxShadow:'0 14px 40px rgba(8,42,85,.09)',display:'grid',gap:12},mark:{width:48,height:48,borderRadius:15,margin:'0 auto',display:'grid',placeItems:'center',fontSize:24,fontWeight:800,color:'#1456A0',background:'#EDF5FF'},secondary:{background:'transparent',color:'#1456A0',fontWeight:800,padding:8}};