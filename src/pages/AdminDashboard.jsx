import React,{useState}from'react';
import{Settings,BarChart3}from'lucide-react';
import Admin from'./Admin.jsx';
import AdminAnalytics from'./AdminAnalytics.jsx';

export default function AdminDashboard({session}){
  const[section,setSection]=useState('controls');
  return <div className="admin-hub">
    <div className="admin-hub-nav">
      <button className={section==='controls'?'active':''} onClick={()=>setSection('controls')}><Settings size={16}/>Controles</button>
      <button className={section==='metrics'?'active':''} onClick={()=>setSection('metrics')}><BarChart3 size={16}/>Métricas</button>
    </div>
    <div className={`admin-hub-body ${section==='metrics'?'metrics':''}`}>
      {section==='controls'?<Admin session={session}/>:<AdminAnalytics session={session}/>} 
    </div>
  </div>
}
