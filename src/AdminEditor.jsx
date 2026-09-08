import React,{useState} from 'react';
import RegionPicker from './RegionPicker.jsx';
import MapPicker from './MapPicker.jsx';
import Select from './Select.jsx';
export default function AdminEditor({place,api,onSaved,onCancel}){
 const [b,setB]=useState({...place}),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const change=(k,v)=>setB(p=>({...p,[k]:v}));
 const field=(k,label,type='text')=><label className="wizard-field" key={k}>{label}{type==='textarea'?<textarea value={b[k]||''} maxLength={2000} onChange={e=>change(k,e.target.value)}/>:<input type={type} value={b[k]??''} maxLength={2000} onChange={e=>change(k,e.target.value)}/>}</label>;
 async function save(){setBusy(true);setError('');try{await api('/admin/places/'+encodeURIComponent(place.id)+'/edit',{method:'POST',body:{version:place.version,place:b,reason}});onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="admin-editor submission-wizard"><h3>修正地点资料</h3><p className="muted">保存会更新当前条目，并记录修订原因。版本 {place.version}；不改变审核状态。</p>
 <div className="form-grid">{field('name','厕所名称')}<div className="wizard-field">所在地区<RegionPicker creation value={b.regionId} onChange={v=>change('regionId',v)}/></div>{field('customRegion','待规范地区（核实并选择地区后清空）')}{field('address','详细地址 / 入口 / 楼层')}</div>
 {field('description','介绍','textarea')}<MapPicker value={b} onChange={v=>setB(p=>({...p,...v}))}/><label className="wizard-field">定位方式<Select value={b.locationMode} onChange={e=>change('locationMode',e.target.value)}><option value="text">文字路线</option><option value="reference">附近地标</option><option value="precise">厕所入口</option></Select></label>
 {b.locationMode!=='text'&&<div className="form-grid">{field('lat','纬度','number')}{field('lng','经度','number')}</div>}{field('landmark','参考地标')}{field('directions','找路步骤','textarea')}
 <div className="form-grid">{field('hours','开放时间')}{field('fee','费用')}{b.template==='visited'?field('date','到访日期','date'):<>{field('sourceUrl','来源网址','url')}{field('publisher','作者 / 发布者')}{field('checkedAt','核查日期','date')}</>}
 {['wheelchair','babycare','paper','water'].map((k,i)=><label key={k} className="wizard-field">{['无障碍设施','母婴设施','卫生纸','洗手水源'][i]}<Select value={b[k]||'unknown'} onChange={e=>change(k,e.target.value)}><option value="unknown">不清楚</option><option value="yes">有</option><option value="no">没有</option></Select></label>)}</div>
 <label className="wizard-field">修订原因 · 必填<textarea value={reason} maxLength={1200} placeholder="例如：根据运营方信息修正了入口位置与开放时间" onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert" className="notice">{error}</p>}<div className="wizard-actions"><button disabled={busy} className="outline" onClick={onCancel}>取消修改</button><button className="primary" disabled={busy||reason.trim().length<3} onClick={save}>{busy?'正在保存…':'保存修订'}</button></div></section>;
}
