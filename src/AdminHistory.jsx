import React,{useState} from 'react';
export default function AdminHistory({id,api}){
 const [data,setData]=useState(null),[open,setOpen]=useState(false),[error,setError]=useState('');
 return <div className="admin-history"><button type="button" className="outline" aria-expanded={open} onClick={async()=>{setOpen(!open);if(!open)try{setData(await api('/admin/places/'+encodeURIComponent(id)+'/history'));setError('');}catch(e){setError(e.message);}}}>修订与处理记录</button>{open&&<div>{error?<p role="alert">{error}</p>:!data?<p>加载中…</p>:<>{!data.revisions.length&&!data.moderation.length&&<p className="muted">暂无新版本记录。旧资料的历史不会虚构补录。</p>}{data.revisions.map(r=><p key={'v'+r.version}><strong>版本 {r.version}</strong> · {r.reason}<small>{r.created} UTC</small></p>)}{data.moderation.map((r,i)=><p key={'m'+i}><strong>{r.new_status}</strong> · {r.public_reason}{r.internal_note&&<span>内部备注：{r.internal_note}</span>}<small>{r.created} UTC</small></p>)}</>}</div>}</div>;
}
