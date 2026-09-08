import React from 'react';
import {EnvelopeSimple,Copy,ArrowUpRight,WechatLogo} from '@phosphor-icons/react';

const email='695325137@qq.com';
const qrImage='/community/wechat-group-20260909.jpg';
// The supplied invitation image states "9月16日前有效". Replace both when renewed.
const qrExpiresAt=Date.parse('2026-09-16T00:00:00+08:00');

export default function ContactPage({notify,onBack}) {
  const expired=Date.now()>=qrExpiresAt;
  return <main className="contact-page">
    <button className="page-back" onClick={onBack}>← 返回发现</button>
    <div className="contact-heading"><p className="eyebrow">好坑位，一起发现</p><h1>合作与交流</h1><p>有想法，来聊聊。也欢迎进群，分享下一站的好风景。</p></div>
    <div className="contact-layout">
      <section className="contact-email" aria-labelledby="contact-email-title">
        <EnvelopeSimple size={30}/><h2 id="contact-email-title">合作，发封邮件</h2>
        <p>地点线索、内容共创、图片授权，或是让必拉榜更好用的建议，都欢迎。</p>
        <a className="contact-address" href={`mailto:${email}`}>{email}</a>
        <div className="contact-actions"><a className="primary" href={`mailto:${email}?subject=${encodeURIComponent('必拉榜合作与交流')}`}>邮件联系 <ArrowUpRight size={18}/></a><button className="outline" onClick={async()=>{try{await navigator.clipboard.writeText(email);notify('邮箱已复制');}catch{notify('复制不可用，请手动复制邮箱地址');}}}><Copy size={17}/>复制邮箱</button></div>
        <p className="contact-email-note">可以简单说说你是谁、想一起做什么，以及方便联系你的方式。</p>
      </section>
      <section className="contact-group" aria-labelledby="contact-group-title">
        <div className="contact-group-heading"><WechatLogo size={27}/><div><h2 id="contact-group-title">来群里，报个好坑位</h2><p>必拉榜 · 微信交流群</p></div></div>
        <a className="contact-qr" href={qrImage} target="_blank" rel="noreferrer" aria-label="打开必拉榜微信群二维码原图"><img src={qrImage} width="1031" height="1449" alt="必拉榜微信群二维码，图片标注 9 月 16 日前有效"/></a>
        <p className="contact-qr-help">用微信扫一扫；手机上可打开原图，保存后在微信中识别。</p>
        <p className="contact-qr-validity" role="note">{expired?'这张群二维码可能已过期，请通过邮箱联系获取新的群邀请。':'这张二维码标注 9 月 16 日前有效，以微信提示为准。无法加入时可邮件联系。'}</p>
        <a className="text-action" href={qrImage} target="_blank" rel="noreferrer">打开二维码原图 <ArrowUpRight size={16}/></a>
      </section>
    </div>
  </main>;
}
