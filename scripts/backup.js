import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function imagePaths(db){return db.prepare('SELECT id FROM photos ORDER BY id').all().map(({id})=>{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('数据库包含无效图片路径');return `images/${id}.webp`;});}
function inspect(file){const db=new DatabaseSync(file,{readOnly:true});try{if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('数据库完整性检查失败');if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('数据库关联完整性检查失败');return imagePaths(db);}finally{db.close();}}
export function createBackup(dataDir,outputDir){
 const source=path.resolve(dataDir),destination=path.resolve(outputDir);
 if(!fs.existsSync(path.join(source,'bilabang.sqlite')))throw Error('源数据库不存在');
 if(fs.existsSync(destination))throw Error('备份目标已存在，拒绝覆盖');
 fs.mkdirSync(destination,{recursive:true});
 const db=new DatabaseSync(path.join(source,'bilabang.sqlite'),{readOnly:true});
 try{db.exec(`VACUUM INTO '${path.join(destination,'bilabang.sqlite').replaceAll("'","''")}'`);}finally{db.close();}
 const names=['bilabang.sqlite',...inspect(path.join(destination,'bilabang.sqlite'))];
 for(const name of names.slice(1)){const original=path.join(source,name);if(!fs.existsSync(original))throw Error(`图片缺失：${name}，备份未完成`);fs.mkdirSync(path.dirname(path.join(destination,name)),{recursive:true});fs.copyFileSync(original,path.join(destination,name),fs.constants.COPYFILE_EXCL);}
 const manifest={version:1,createdAt:new Date().toISOString(),files:names.map(name=>({name,bytes:fs.statSync(path.join(destination,name)).size,sha256:digest(path.join(destination,name))}))};
 fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
 return verifyBackup(destination);
}
export function verifyBackup(directory){
 const root=path.resolve(directory),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 if(manifest.version!==1||!Array.isArray(manifest.files)||!manifest.files.length)throw Error('无效备份清单');
 const names=new Set();
 for(const entry of manifest.files){
  if(typeof entry.name!=='string'||!(/^(bilabang\.sqlite|images\/[a-zA-Z0-9_-]+\.webp)$/.test(entry.name))||names.has(entry.name))throw Error('清单路径无效或重复');
  names.add(entry.name);const file=path.join(root,entry.name);const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==entry.bytes||digest(file)!==entry.sha256)throw Error(`备份校验失败：${entry.name}`);
 }
 if(!names.has('bilabang.sqlite'))throw Error('清单缺少数据库');
 const expected=inspect(path.join(root,'bilabang.sqlite'));if(expected.some(name=>!names.has(name))||names.size!==expected.length+1)throw Error('图片清单与数据库不一致');
 return {directory:root,files:manifest.files.length,images:expected.length,verified:true};
}
export function restoreBackup(directory,target){
 const result=verifyBackup(directory),destination=path.resolve(target);
 if(fs.existsSync(destination))throw Error('恢复目标必须不存在；禁止覆盖现有服务数据');
 fs.mkdirSync(destination,{recursive:true});const manifest=JSON.parse(fs.readFileSync(path.join(result.directory,'manifest.json'),'utf8'));
 for(const entry of manifest.files){const file=path.join(destination,entry.name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(result.directory,entry.name),file,fs.constants.COPYFILE_EXCL);}
 inspect(path.join(destination,'bilabang.sqlite'));return {...result,directory:destination,restored:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [command,...args]=process.argv.slice(2);let result;
 if(command==='create')result=createBackup(args[0]||'data',args[1]||path.join('output','backups',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()));
 else if(command==='verify'&&args[0])result=verifyBackup(args[0]);
 else if(command==='restore'&&args[0]&&args[1])result=restoreBackup(args[0],args[1]);
 else throw Error('用法：node scripts/backup.js create [数据目录] [新备份目录] | verify <备份目录> | restore <备份目录> <不存在的新目录>');
 console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=1;}
}
