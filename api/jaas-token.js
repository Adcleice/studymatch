import crypto from 'node:crypto';

function base64url(input){
  return Buffer.from(typeof input==='string'?input:JSON.stringify(input)).toString('base64url');
}

function signJwt(payload,privateKey,kid){
  const header={alg:'RS256',kid,typ:'JWT'};
  const unsigned=`${base64url(header)}.${base64url(payload)}`;
  const signer=crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature=signer.sign(privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const appId=process.env.JAAS_APP_ID;
  const kid=process.env.JAAS_KEY_ID;
  const rawKey=process.env.JAAS_PRIVATE_KEY;
  if(!appId||!kid||!rawKey)return res.status(500).json({error:'JaaS não configurado na Vercel'});

  try{
    const {room,userId,userName,userEmail,avatarUrl}=req.body||{};
    if(!room)return res.status(400).json({error:'Sala inválida'});

    const safeRoom=String(room).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
    if(!safeRoom)return res.status(400).json({error:'Nome de sala inválido'});

    const now=Math.floor(Date.now()/1000);
    const payload={
      aud:'jitsi',
      iss:'chat',
      sub:appId,
      room:safeRoom,
      nbf:now-10,
      exp:now+(6*60*60),
      context:{
        features:{
          livestreaming:false,
          recording:false,
          transcription:false,
          'outbound-call':false,
          'file-upload':false,
          'list-visitors':true
        },
        user:{
          id:userId||'studymatch-user',
          name:userName||'StudyMatch',
          email:userEmail||'',
          avatar:avatarUrl||'',
          moderator:true
        }
      }
    };

    const privateKey=rawKey.replace(/\\n/g,'\n');
    const token=signJwt(payload,privateKey,kid);
    return res.status(200).json({token,appId,room:safeRoom});
  }catch(error){
    return res.status(500).json({error:error?.message||'Erro ao gerar acesso à sala'});
  }
}
