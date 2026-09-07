import crypto from 'node:crypto';

const COOKIE = '__Host-arun-admin';
const MAX_AGE = 60 * 60 * 8;

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}
function sign(payload) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(payload).digest('base64url');
}
function makeSession(user) {
  const payload = b64url(JSON.stringify({ u: user, exp: Math.floor(Date.now()/1000) + MAX_AGE }));
  return `${payload}.${sign(payload)}`;
}
function validSession(token) {
  if (!token || !process.env.ADMIN_SESSION_SECRET) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return !!data.u && Number(data.exp) > Math.floor(Date.now()/1000);
  } catch { return false; }
}
function cookies(req){
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(s=>s.trim()).filter(Boolean).map(p=>{const i=p.indexOf('=');return [p.slice(0,i),p.slice(i+1)]}));
}
function setCookie(res, value, maxAge=MAX_AGE){
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`);
}

export default async function handler(req,res){
  if(!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET){
    return res.status(500).json({error:'Admin environment variables are not configured.'});
  }
  if(req.method==='GET'){
    return res.status(200).json({authenticated: validSession(cookies(req)[COOKIE])});
  }
  if(req.method==='DELETE'){
    setCookie(res,'',0);
    return res.status(200).json({ok:true});
  }
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const {user,password}=req.body||{};
  if(user!==process.env.ADMIN_USER || password!==process.env.ADMIN_PASSWORD){
    return res.status(401).json({error:'Incorrect User ID or Password.'});
  }
  setCookie(res,makeSession(user));
  return res.status(200).json({ok:true});
}

export function requireAdmin(req){
  const token=cookies(req)[COOKIE];
  if(!validSession(token)){
    const err=new Error('Unauthorized'); err.status=401; throw err;
  }
}
