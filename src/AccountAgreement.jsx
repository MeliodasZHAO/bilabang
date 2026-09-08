import React,{useState} from 'react';
import {accountPolicyVersion,agreementLinks,supportEmail} from './account-policy.js';

export function AgreementFields({disabled=false}) {
 return <div className="account-agreements">
  <label className="consent"><input name="agreements" type="checkbox" required disabled={disabled}/><span>我已阅读并同意{agreementLinks.map((link,i)=><React.Fragment key={link.href}>{i>0?'、':''}<a href={link.href} target="_blank" rel="noreferrer">《{link.label}》</a></React.Fragment>)}。</span></label>
  <label className="consent"><input name="hkStorageConsent" type="checkbox" required disabled={disabled}/><span>我单独同意：本站将账户及我主动提交的内容存储在香港服务器，用于登录、发布与审核。<a href="/privacy#storage" target="_blank" rel="noreferrer">查看数据范围、处理方式与权利申请</a>。</span></label>
  <p className="field-hint">协议版本 {accountPolicyVersion} · 确认只用于本站服务，不包含订阅或营销。</p>
 </div>;
}
export function agreementPayload(data) {
 return {agreements:data.get('agreements')==='on',hkStorageConsent:data.get('hkStorageConsent')==='on',policyVersion:accountPolicyVersion};
}
export default function AccountAgreement({api,onAccepted}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="account-agreement-panel" onSubmit={async e=>{
  e.preventDefault();if(busy)return;const data=new FormData(e.currentTarget);setBusy(true);setError('');
  try{onAccepted(await api('/account/agreements',{method:'POST',body:agreementPayload(data)}));}catch(e){setError(e.message);}finally{setBusy(false);}
 }}><h3>发言前，先确认一下社区约定</h3><p>浏览公开内容不需要确认。准备分享时，请阅读我们如何处理账户、照片和评价。</p><AgreementFields disabled={busy}/>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'正在保存…':'确认并继续填写'}</button></form>;
}
export function AccountRestriction({account}) {
 return <div className="account-restriction" role="status"><h3>此账号暂时不能发布内容</h3><p>{account.reason}</p><p>你仍可浏览地点及自己的记录。如对处理有异议，请附上用户名与情况说明，<a href={`mailto:${supportEmail}?subject=${encodeURIComponent('必拉榜账号申诉')}`}>通过邮箱申诉</a>。</p></div>;
}
