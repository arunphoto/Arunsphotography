import { issueSignedToken, presignUrl } from '@vercel/blob';
import { requireAdmin } from './auth.js';

export default async function handler(req,res){
  try{
    requireAdmin(req);
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
    const {slot,contentType,size}=req.body||{};
    if(!/^cinematic-(01|02|03|04|06|07|08|09|10)$/.test(slot||'')) return res.status(400).json({error:'Invalid video slot'});
    if(!String(contentType||'').startsWith('video/')) return res.status(400).json({error:'Only video files are allowed'});
    if(Number(size)>500*1024*1024) return res.status(413).json({error:'Video must be under 500 MB'});
    const pathname=`admin-videos/${slot}-${Date.now()}-${cryptoRandom()}.mp4`;
    const token=await issueSignedToken({pathname,operations:['put'],validUntil:Date.now()+15*60*1000});
    const {presignedUrl}=await presignUrl(token,{pathname,operation:'put',validUntil:Date.now()+15*60*1000});
    return res.status(200).json({pathname,presignedUrl});
  }catch(e){return res.status(e.status||500).json({error:e.message||'Could not create upload URL'});}
}
function cryptoRandom(){return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);}
