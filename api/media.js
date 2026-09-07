import crypto from 'node:crypto';
import { requireAdmin } from './auth.js';

const GH = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const MANIFEST = 'media-manifest.json';

function env(){
  for(const k of ['GITHUB_TOKEN','GITHUB_OWNER','GITHUB_REPO','GITHUB_BRANCH']) if(!process.env[k]) throw Object.assign(new Error(`Missing ${k}`),{status:500});
}
function headers(extra={}){env(); return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':API_VERSION,'Content-Type':'application/json',...extra};}
function repoUrl(path){ return `${GH}/repos/${encodeURIComponent(process.env.GITHUB_OWNER)}/${encodeURIComponent(process.env.GITHUB_REPO)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(process.env.GITHUB_BRANCH)}`; }
async function gh(url, options={}){
  const r=await fetch(url,{...options,headers:{...headers(),...(options.headers||{})}});
  const t=await r.text();
  let data; try{data=JSON.parse(t)}catch{data={raw:t}};
  if(!r.ok) throw Object.assign(new Error(data.message||`GitHub API ${r.status}`),{status:r.status,data});
  return data;
}
async function getFile(path){
  try{return await gh(repoUrl(path));}catch(e){if(e.status===404)return null;throw e;}
}
async function getManifest(){
  const f=await getFile(MANIFEST);
  if(!f) return {updatedAt:new Date().toISOString(),hiddenImages:[],hiddenVideos:[],videoOverrides:{},homeOverrides:{}};
  try{return JSON.parse(Buffer.from(f.content,'base64').toString('utf8'));}catch{return {updatedAt:new Date().toISOString(),hiddenImages:[],hiddenVideos:[],videoOverrides:{},homeOverrides:{}};}
}
async function putFile(path, contentB64, message, sha){
  const body={message,content:contentB64,branch:process.env.GITHUB_BRANCH,committer:{name:process.env.GITHUB_COMMITTER_NAME||'Arun Photography Admin',email:process.env.GITHUB_COMMITTER_EMAIL||'admin@arunsphotography.in'}};
  if(sha) body.sha=sha;
  return gh(repoUrl(path),{method:'PUT',body:JSON.stringify(body)});
}
async function deleteFile(path, message){
  const f=await getFile(path);
  if(!f) return {deleted:false,reason:'missing'};
  const body={message,sha:f.sha,branch:process.env.GITHUB_BRANCH,committer:{name:process.env.GITHUB_COMMITTER_NAME||'Arun Photography Admin',email:process.env.GITHUB_COMMITTER_EMAIL||'admin@arunsphotography.in'}};
  await gh(repoUrl(path),{method:'DELETE',body:JSON.stringify(body)});
  return {deleted:true};
}
async function saveManifest(manifest,message){
  manifest.updatedAt=new Date().toISOString();
  const f=await getFile(MANIFEST);
  return putFile(MANIFEST,Buffer.from(JSON.stringify(manifest,null,2)).toString('base64'),message,f?.sha);
}
function cleanSlot(slot, ext){
  if(!/^\d{2}$/.test(slot)) throw Object.assign(new Error('Invalid slot'),{status:400});
  return `${slot}.${ext}`;
}
function imagePath(category,slot){
  const clean=cleanSlot(slot,'jpg');
  const allowed={
    wedding:'images/wedding',
    couples:'images/couples-pre-post-wedding',
    baby:'images/baby',
    traditional:'images/traditional',
    maternity:'images/maternity'
  };
  if(category==='gallery'){
    const gallerySlots=['01','02','03','04','06','10'];
    if(!gallerySlots.includes(slot)) throw Object.assign(new Error('Invalid gallery slot'),{status:400});
    return `images/gallery-${clean}`;
  }
  if(!allowed[category]) throw Object.assign(new Error('Invalid collection'),{status:400});
  return `${allowed[category]}/${clean}`;
}
function homePath(slot){if(!/^hero-[1-3]$/.test(slot)) throw Object.assign(new Error('Invalid home slot'),{status:400});return `images/${slot}.jpg`;}
function videoPath(slot){if(!/^cinematic-(01|02|03|04|06|07|08|09|10)$/.test(slot)) throw Object.assign(new Error('Invalid video slot'),{status:400});return `videos/${slot}.mp4`;}

async function tree(){
  env();
  const url=`${GH}/repos/${encodeURIComponent(process.env.GITHUB_OWNER)}/${encodeURIComponent(process.env.GITHUB_REPO)}/git/trees/${encodeURIComponent(process.env.GITHUB_BRANCH)}?recursive=1`;
  const data=await gh(url);
  return (data.tree||[]).filter(x=>x.type==='blob').map(x=>({path:x.path,sha:x.sha,size:x.size||0}));
}

export default async function handler(req,res){
  try{
    requireAdmin(req);
    env();
    if(req.method==='GET'){
      const [files,manifest]=await Promise.all([tree(),getManifest()]);
      return res.status(200).json({files,manifest,repo:{owner:process.env.GITHUB_OWNER,name:process.env.GITHUB_REPO,branch:process.env.GITHUB_BRANCH}});
    }
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
    const body=req.body||{};
    if(body.action==='upload-image'){
      const path=imagePath(body.category,body.slot);
      const current=await getFile(path);
      const raw=String(body.content||'').replace(/^data:image\/[^;]+;base64,/,'');
      const bytes=Buffer.from(raw,'base64');
      if(bytes.length>4*1024*1024) throw Object.assign(new Error('Image is too large after compression. Keep it under 4 MB.'),{status:413});
      await putFile(path,raw,`Admin: replace ${path}`,current?.sha);
      const manifest=await getManifest(); manifest.hiddenImages=(manifest.hiddenImages||[]).filter(p=>p!==path);
      await saveManifest(manifest,`Admin: show ${path}`);
      return res.status(200).json({ok:true,path});
    }
    if(body.action==='delete-image'){
      const path=imagePath(body.category,body.slot);
      await deleteFile(path,`Admin: remove ${path}`);
      const manifest=await getManifest(); manifest.hiddenImages=[...(manifest.hiddenImages||[]).filter(p=>p!==path),path];
      await saveManifest(manifest,`Admin: hide ${path}`);
      return res.status(200).json({ok:true,path});
    }
    if(body.action==='upload-home'){
      const path=homePath(body.slot);
      const current=await getFile(path); const raw=String(body.content||'').replace(/^data:image\/[^;]+;base64,/,'');
      const bytes=Buffer.from(raw,'base64'); if(bytes.length>4*1024*1024) throw Object.assign(new Error('Image is too large after compression.'),{status:413});
      await putFile(path,raw,`Admin: replace ${path}`,current?.sha);
      const manifest=await getManifest(); manifest.hiddenImages=(manifest.hiddenImages||[]).filter(p=>p!==path);
      await saveManifest(manifest,`Admin: show ${path}`);
      return res.status(200).json({ok:true,path});
    }
    if(body.action==='delete-home'){
      const path=homePath(body.slot); await deleteFile(path,`Admin: remove ${path}`);
      const manifest=await getManifest(); manifest.hiddenImages=[...(manifest.hiddenImages||[]).filter(p=>p!==path),path];
      await saveManifest(manifest,`Admin: hide ${path}`); return res.status(200).json({ok:true,path});
    }
    if(body.action==='upload-video-github'){
      const path=videoPath(body.slot); const current=await getFile(path); const raw=String(body.content||'');
      const bytes=Buffer.from(raw,'base64'); if(bytes.length>4*1024*1024) throw Object.assign(new Error('Use large-video upload for files over 4 MB.'),{status:413});
      await putFile(path,raw,`Admin: replace ${path}`,current?.sha);
      const manifest=await getManifest(); if(manifest.videoOverrides) delete manifest.videoOverrides[path]; manifest.hiddenVideos=(manifest.hiddenVideos||[]).filter(p=>p!==path);
      await saveManifest(manifest,`Admin: activate ${path}`); return res.status(200).json({ok:true,path});
    }
    if(body.action==='delete-video'){
      const path=videoPath(body.slot); await deleteFile(path,`Admin: remove ${path}`);
      const manifest=await getManifest(); manifest.hiddenVideos=[...(manifest.hiddenVideos||[]).filter(p=>p!==path),path];
      if(manifest.videoOverrides) delete manifest.videoOverrides[path];
      await saveManifest(manifest,`Admin: hide ${path}`); return res.status(200).json({ok:true,path});
    }
    if(body.action==='commit-video-blob'){
      const path=videoPath(body.slot); if(!/^https:\/\/.+\.blob\.vercel-storage\.com\//.test(body.url||'')) throw Object.assign(new Error('Invalid Vercel Blob URL.'),{status:400});
      const manifest=await getManifest(); manifest.videoOverrides=manifest.videoOverrides||{}; manifest.videoOverrides[path]=body.url; manifest.hiddenVideos=(manifest.hiddenVideos||[]).filter(p=>p!==path);
      await saveManifest(manifest,`Admin: publish blob video ${path}`); return res.status(200).json({ok:true,path,url:body.url});
    }
    return res.status(400).json({error:'Unknown admin action'});
  }catch(e){return res.status(e.status||500).json({error:e.message||'Server error'});}
}
