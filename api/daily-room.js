export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const apiKey=process.env.DAILY_API_KEY;
  if(!apiKey)return res.status(500).json({error:'DAILY_API_KEY não configurada na Vercel'});
  try{
    const {name,minutes=50}=req.body||{};
    const roomName=('studymatch-'+(name||'study')+'-'+Date.now()).toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,120);
    const exp=Math.floor(Date.now()/1000)+(Math.max(25,Number(minutes)||50)*60)+1800;
    const response=await fetch('https://api.daily.co/v1/rooms',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({name:roomName,privacy:'public',properties:{exp,enable_chat:false,enable_screenshare:true,start_video_off:false,start_audio_off:true,enable_people_ui:true}})
    });
    const data=await response.json();
    if(!response.ok)return res.status(response.status).json({error:data?.info||data?.error||'Erro ao criar sala Daily'});
    return res.status(200).json({url:data.url,name:data.name});
  }catch(error){return res.status(500).json({error:error.message||'Erro inesperado'});}
}
