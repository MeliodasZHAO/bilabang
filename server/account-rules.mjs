import {randomUUID} from 'node:crypto';
import {accountPolicyVersion,commentCooldownSeconds,supportEmail} from '../src/account-policy.js';
const fail=(status,message,extra={})=>{throw Object.assign(Error(message),{status,...extra});};
const now=()=>new Date().toISOString();
export function validateAgreement(input) {
 if(input?.agreements!==true||input?.hkStorageConsent!==true)fail(400,'请阅读并主动确认协议及香港存储说明');
 if(input.policyVersion!==accountPolicyVersion)fail(409,'协议已更新，请刷新页面后重新阅读确认');
}
export function saveAgreement(db,userId,input) {
 validateAgreement(input);
 db.prepare('INSERT OR IGNORE INTO account_consents(user_id,policy_version,accepted_at,hk_storage_consent) VALUES(?,?,?,1)').run(userId,accountPolicyVersion,now());
}
export function accountRules(db) {
 function state(userId) {
  const consent=db.prepare('SELECT accepted_at FROM account_consents WHERE user_id=? AND policy_version=?').get(userId,accountPolicyVersion);
  const control=db.prepare('SELECT status,reason,version FROM account_controls WHERE user_id=?').get(userId);
  return {policyVersion:accountPolicyVersion,policyAccepted:!!consent,acceptedAt:consent?.accepted_at||null,status:control?.status||'active',reason:control?.reason||'',version:control?.version||0};
 }
 function assertCanPublish(userId) {
  const current=state(userId);
  if(current.status==='muted')fail(403,`此账号暂时不能发布内容：${current.reason}。如有异议，请联系 ${supportEmail}`);
  if(!current.policyAccepted)fail(403,'请先阅读并确认最新服务协议、隐私说明和社区规则');
 }
 return {
  state,assertCanPublish,
  config:{policyVersion:accountPolicyVersion,commentCooldownSeconds},
  async publishSubmission(user,statements) {
   db.exec('BEGIN IMMEDIATE');
   try {
    if(user&&state(user.id).status==='muted')assertCanPublish(user.id);
    const result=statements.map(s=>s.execute());db.exec('COMMIT');return result;
   } catch(e){db.exec('ROLLBACK');throw e;}
  },
  async publishReview(user,statements,input) {
   // All async photo work is finished. Check permissions and cooldown in the same
   // write transaction as the review so concurrent requests cannot bypass either.
   db.exec('BEGIN IMMEDIATE');
   try {
    assertCanPublish(user.id);
    if(input.contentConsent!==true)fail(400,'请确认内容真实、图片归属及隐私要求');
    const latest=db.prepare('SELECT created FROM reviews WHERE user_id=? ORDER BY created DESC LIMIT 1').get(user.id);
    const wait=latest?Math.ceil((Date.parse(latest.created)+commentCooldownSeconds*1000-Date.now())/1000):0;
    if(wait>0)fail(429,`请在 ${wait} 秒后再发布下一条`,{retryAfter:wait});
    const result=statements.map(s=>s.execute());db.exec('COMMIT');return result;
   } catch(e){db.exec('ROLLBACK');throw e;}
  },
  listUsers() {
   return db.prepare('SELECT u.id,u.name,u.created,c.role FROM users u JOIN auth_credentials c ON c.user_id=u.id ORDER BY u.created DESC LIMIT 500').all().map(u=>({...u,account:state(u.id)}));
  },
  control(actor,userId,input) {
   const target=db.prepare('SELECT role FROM auth_credentials WHERE user_id=?').get(userId);
   if(!target)fail(404,'账号不存在');
   if(target.role==='admin'||userId===actor.id)fail(400,'不能通过此入口限制管理员或自己');
   const reason=typeof input?.reason==='string'?input.reason.trim():'';
   if(!['active','muted'].includes(input?.status)||reason.length<3||reason.length>600)fail(400,'请选择有效状态，并填写 3–600 字的处理原因');
   db.exec('BEGIN IMMEDIATE');
   try {
    const current=state(userId);
    if(input.version!==current.version)fail(409,'账号状态已更新，请刷新后重试');
    if(current.status===input.status)fail(409,'账号已处于该状态，请刷新列表');
    const time=now();
    db.prepare('INSERT INTO account_controls(user_id,status,reason,version,updated_at,actor) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,version=excluded.version,updated_at=excluded.updated_at,actor=excluded.actor').run(userId,input.status,reason,current.version+1,time,actor.id);
    db.prepare('INSERT INTO account_control_events(id,user_id,actor,status,reason,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),userId,actor.id,input.status,reason,time);
    db.exec('COMMIT');return state(userId);
   } catch(e){db.exec('ROLLBACK');throw e;}
  },
 };
}
