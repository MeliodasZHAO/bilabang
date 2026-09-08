import {normalizePlace} from './src/place-schema.js';
export function installModeration(app,db,{admin,audit}){
 const reasonValid=b=>typeof b.reason==='string'&&b.reason.trim().length>=3&&b.reason.length<=1200&&(!b.internalNote||(typeof b.internalNote==='string'&&b.internalNote.length<=2000));
 app.get('/api/admin/places/:id/history',admin,(req,res)=>{
  res.json({revisions:db.prepare('SELECT version,reason,actor,created FROM place_revisions WHERE place_id=? ORDER BY version DESC').all(req.params.id),moderation:db.prepare("SELECT old_status,new_status,public_reason,internal_note,actor,created FROM moderation_events WHERE target_type='places' AND target_id=? ORDER BY id DESC").all(req.params.id)});
 });
 app.post('/api/admin/places/:id/edit',admin,(req,res)=>{
  const b=req.body;if(!reasonValid(b))return res.status(400).json({error:'请填写3–1200字修订原因，内部备注最多2000字'});
  const row=db.prepare('SELECT * FROM places WHERE id=?').get(req.params.id);if(!row)return res.status(404).json({error:'地点不存在'});
  if(!Number.isInteger(b.version)||b.version!==row.version)return res.status(409).json({error:'资料已由其他操作更新，请重新加载后修改'});
  if(!b.place||typeof b.place!=='object'||Array.isArray(b.place))return res.status(400).json({error:'地点资料无效'});
  const old=JSON.parse(row.payload);let next;
  try{next={...old,...normalizePlace({...old,...b.place,template:old.template,consent:true},old.photoMetadata||[])};}catch(e){return res.status(400).json({error:e.message,fields:e.fields});}
  if(row.status==='approved'&&next.customRegion)return res.status(400).json({error:'公开地点必须先规范地区；未核实请先下架'});
  db.exec('BEGIN IMMEDIATE');try{
   const result=db.prepare('UPDATE places SET payload=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(next),row.id,b.version);if(!result.changes)throw Error('资料版本冲突');
   db.prepare('INSERT INTO place_revisions(place_id,version,before_payload,after_payload,actor,reason) VALUES(?,?,?,?,?,?)').run(row.id,b.version+1,row.payload,JSON.stringify(next),req.user.id,b.reason.trim());
   audit(req.user.id,'edit',row.id);db.exec('COMMIT');res.json({ok:true,version:b.version+1});
  }catch(e){db.exec('ROLLBACK');res.status(409).json({error:'未能保存，请重新加载资料后重试'});}
 });
 app.post('/api/admin/:type/:id',admin,(req,res)=>{
  const {type,id}=req.params,b=req.body,table={places:'places',reviews:'reviews',reports:'reports'}[type];
  if(!table||!(type==='reports'?['resolved']:['approved','rejected']).includes(b.status))return res.status(400).json({error:'无效的审核操作'});
  if(!reasonValid(b))return res.status(400).json({error:'请填写3–1200字公开处理说明，内部备注最多2000字'});
  const row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);if(!row)return res.status(404).json({error:'记录不存在'});
  if(type==='places'&&(!Number.isInteger(b.version)||b.version!==row.version))return res.status(409).json({error:'资料已经更新，请重新加载后审核'});
  if(type==='places'&&b.status==='approved'&&JSON.parse(row.payload).customRegion)return res.status(400).json({error:'请先修正待规范地区再发布'});
  db.exec('BEGIN IMMEDIATE');try{
   db.prepare(`UPDATE ${table} SET status=?${type==='places'?',version=version+1':''} WHERE id=?`).run(b.status,id);
   db.prepare('INSERT INTO moderation_events(target_type,target_id,old_status,new_status,public_reason,internal_note,actor) VALUES(?,?,?,?,?,?,?)').run(type,id,row.status,b.status,b.reason.trim(),b.internalNote?.trim()||'',req.user.id);
   audit(req.user.id,b.status,id);db.exec('COMMIT');res.json({ok:true,version:type==='places'?row.version+1:undefined});
  }catch(e){db.exec('ROLLBACK');res.status(409).json({error:'处理未保存，请刷新后重试'});}
 });
}
