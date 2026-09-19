import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 try{
  const auth=req.headers.get('Authorization')||''
  const url=Deno.env.get('SUPABASE_URL')!
  const anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resend=Deno.env.get('RESEND_API_KEY')
  const from=Deno.env.get('MATCHWORKING_EMAIL_FROM')
  if(!resend||!from)throw new Error('E-mail transacional ainda não configurado no servidor.')
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}})
  const{data:{user},error:userError}=await userClient.auth.getUser()
  if(userError||!user)throw new Error('Não autenticado.')
  const admin=createClient(url,service)
  const{data:isAdmin}=await admin.from('app_admins').select('user_id').eq('user_id',user.id).maybeSingle()
  if(!isAdmin)throw new Error('Acesso restrito ao administrador.')
  const{kind,user_id,email}=await req.json()
  let to='',subject='',html='',mark:()=>Promise<any>
  if(kind==='approved'){
   const{data:m,error}=await admin.from('membership_access').select('email,status,approval_email_sent_at').eq('user_id',user_id).single()
   if(error||!m)throw new Error('Cadastro não encontrado.')
   if(m.status!=='approved')throw new Error('O cadastro ainda não está aprovado.')
   if(m.approval_email_sent_at)return json({ok:true,already_sent:true})
   to=m.email
   subject='Seu acesso ao Matchworking foi aprovado'
   html=emailHtml('Seu acesso foi aprovado','Sua conta foi aprovada e o Matchworking já está disponível para você.','Entrar no Matchworking','https://matchworking.vercel.app/login')
   mark=()=>admin.from('membership_access').update({approval_email_sent_at:new Date().toISOString()}).eq('user_id',user_id)
  }else if(kind==='invite'){
   to=String(email||'').trim().toLowerCase()
   const{data:i,error}=await admin.from('access_invites').select('email,invite_email_sent_at').eq('email',to).single()
   if(error||!i)throw new Error('Convite não encontrado.')
   if(i.invite_email_sent_at)return json({ok:true,already_sent:true})
   subject='Seu acesso ao Matchworking está disponível'
   html=emailHtml('Você pode entrar no Matchworking','Seu e-mail foi autorizado para o primeiro ciclo. Crie sua conta com este mesmo endereço e o acesso será liberado automaticamente.','Criar minha conta','https://matchworking.vercel.app/register')
   mark=()=>admin.from('access_invites').update({invite_email_sent_at:new Date().toISOString()}).eq('email',to)
  }else throw new Error('Tipo de e-mail inválido.')
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html})})
  if(!sent.ok)throw new Error('Falha no envio: '+await sent.text())
  const{error:markError}=await mark();if(markError)throw markError
  return json({ok:true})
 }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},400)}
})
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})}
function emailHtml(title:string,text:string,button:string,href:string){return `<!doctype html><html><body style="margin:0;background:#f2f5f4;font-family:Arial,sans-serif;color:#0b2532"><div style="max-width:560px;margin:0 auto;padding:36px 20px"><div style="background:#fff;border-radius:18px;padding:32px;border:1px solid #dde6e4"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#169b82;margin-bottom:18px">MATCHWORKING</div><h1 style="font-size:25px;margin:0 0 12px">${title}</h1><p style="font-size:15px;line-height:1.6;color:#53666b;margin:0 0 24px">${text}</p><a href="${href}" style="display:inline-block;background:#0b2532;color:#fff;text-decoration:none;padding:13px 20px;border-radius:11px;font-weight:700">${button}</a><p style="font-size:11px;color:#8a999d;margin:28px 0 0">Você recebeu este e-mail porque solicitou ou recebeu acesso ao Matchworking.</p></div></div></body></html>`}