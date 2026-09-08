// Read-only checks. Never creates a database, an account, or a listener.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';

export function validateConfig(env) {
  const errors=[];
  const origins={};
  for(const key of ['SITE_URL','API_ORIGIN']) {
    try {
      const u=new URL(env[key]);
      if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.port||!u.hostname.includes('.')||/^(localhost|127\.|0\.|\[)/.test(u.hostname)||/\.(test|local|localhost|chatgpt\.site)$/.test(u.hostname))throw Error();
      origins[key]=u;
    } catch { errors.push(`${key}: requires a public HTTPS origin without path or port`); }
  }
  if(env.NODE_ENV!=='production')errors.push('NODE_ENV must be production');
  if(env.HOST!=='127.0.0.1')errors.push('HOST must be 127.0.0.1 behind the HTTPS proxy');
  if(!/^\d+$/.test(env.PORT||'')||Number(env.PORT)<1024||Number(env.PORT)>65535)errors.push('PORT must be an integer from 1024 to 65535');
  if(!env.DATA_DIR||!path.isAbsolute(env.DATA_DIR))errors.push('DATA_DIR must be absolute');
  if(!env.RATE_SALT||env.RATE_SALT.length<32||/REPLACE|example|test-only/i.test(env.RATE_SALT))errors.push('RATE_SALT must be a random secret of at least 32 characters');
  if(origins.SITE_URL&&origins.API_ORIGIN&&origins.SITE_URL.hostname===origins.API_ORIGIN.hostname)errors.push('Use separate app and api hostnames for this deployment');
  return errors;
}

export async function portOccupied(host,port) {
  return new Promise((resolve,reject)=>{
    const socket=net.connect({host,port});
    const finish=(error,value)=>{socket.destroy();error?reject(error):resolve(value);};
    socket.setTimeout(2000,()=>finish(new Error('Port check timed out')));
    socket.once('connect',()=>finish(null,true));
    socket.once('error',e=>e.code==='ECONNREFUSED'?finish(null,false):finish(new Error(`Port check failed: ${e.code}`)));
  });
}

async function main() {
  const errors=validateConfig(process.env);
  if(Number(process.versions.node.split('.')[0])<24)errors.push('Node 24 or newer is required');
  if(!fs.existsSync('server/production.mjs'))errors.push('Independent production backend is not implemented; do not substitute server.js --preview');
  if(process.env.DATA_DIR&&path.isAbsolute(process.env.DATA_DIR)) {
    const data=path.resolve(process.env.DATA_DIR),root=process.cwd();
    if(data===root||data.startsWith(root+path.sep))errors.push('DATA_DIR must be outside the release directory');
    try {fs.accessSync(data,fs.constants.R_OK|fs.constants.W_OK);} catch {errors.push('DATA_DIR must exist and be readable/writable by the service user');}
  }
  if(!errors.length&&await portOccupied(process.env.HOST,Number(process.env.PORT)))errors.push('API port is already occupied; do not terminate another service');
  if(errors.length){for(const error of errors)console.error(error);process.exitCode=1;return;}
  console.log('Infrastructure checks passed. This does not prove authentication, schema, or public network readiness.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
