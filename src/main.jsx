import {apiUrl,sitesIdentityEnabled} from './deployment.js';
import CommunityReviews from './CommunityReviews.jsx';
import Select from './Select.jsx';
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LinkSimple,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Mountains,
  Star,
  Plus,
  MagnifyingGlass,
  X,
  Check,
  Camera,
  ShieldCheck,
  Compass,
  UploadSimple,
  List,
  SignOut,
  Flag,
  Leaf,
  Path,
  Drop,
  Clock,
} from "@phosphor-icons/react";
import { demoPlaces } from "./demo";
import "./theme.css";
import "./style.css";
import './controls.css';
import './playful.css';
import './pages.css';
import './editorial.css';
import PlaceGallery from './PlaceGallery.jsx';
import ContactPage from './ContactPage.jsx';
const EditorialPlaces=React.lazy(()=>import('./EditorialPlaces.jsx'));
import LegalPage,{LegalContent} from './LegalPage.jsx';
import {AgreementFields,agreementPayload,AccountRestriction} from './AccountAgreement.jsx';
import {registrationPasswordError} from './account-policy.js';
import RegionPicker from './RegionPicker.jsx';
import AdminDesk from './AdminDesk.jsx';
import ReceiptPanel from './ReceiptPanel.jsx';
import {api} from './api.js';
import SubmissionWizard from './SubmissionWizard.jsx';
import {withinRegion,regionLabel,regionMap} from './regions.js';
const labels = {
  overall: "综合推荐",
  scenery: "风景最美",
  cleanliness: "干净安心",
  access: "轻松到达",
  facilities: "设施齐全",
};
const dateNow = new Date().toISOString().slice(0, 10);
const pagePaths={editorial:'/editorial',contact:'/contact',submit:'/share',terms:'/terms',privacy:'/privacy',rules:'/rules'};
const readView = () => Object.keys(pagePaths).find(key=>pagePaths[key]===location.pathname)||(['discover','ranking','about','admin','submit','contact'].includes(new URLSearchParams(location.search).get('view'))?new URLSearchParams(location.search).get('view'):'discover');
function App() {
  const [places, setPlaces] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [user, setUser] = useState(null),
    [config, setConfig] = useState({}),
    [view, setView] = useState(readView),
    [modal, setModal] = useState(null),
    [detail, setDetail] = useState(new URLSearchParams(location.search).has("place")?{loading:true}:null),
    [query, setQuery] = useState(new URLSearchParams(location.search).get("q")||""),
    [country, setCountry] = useState(new URLSearchParams(location.search).get("region")||""),
    [sort, setSort] = useState(new URLSearchParams(location.search).get("sort")||"overall"),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false);
  const updateRegion=(value)=>{const params=new URLSearchParams(location.search);if(value)params.set('region',value);else params.delete('region');history.pushState(null,'',location.pathname+(params.size?'?'+params:''));setCountry(value);};
  useEffect(()=>{const listener=()=>{const p=new URLSearchParams(location.search);setCountry(p.get('region')||'');setQuery(p.get('q')||'');setSort(Object.hasOwn(labels,p.get('sort'))?p.get('sort'):'overall');setView(readView());};window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener);},[]);
  useEffect(()=>{const params=new URLSearchParams(location.search);if(query)params.set('q',query);else params.delete('q');if(sort!=='overall')params.set('sort',sort);else params.delete('sort');history.replaceState(history.state,'',location.pathname+(params.size?'?'+params:''));},[query,sort]);
  function openPlace(place){
    history.replaceState({...history.state,scrollY:window.scrollY},'',location.href);
    const params=new URLSearchParams(location.search);params.set('place',place.id);
    history.pushState({fromList:true},'','/?'+params);
    setDetail({place});setModal(null);setMenu(false);window.scrollTo(0,0);
  }
  function closeModal(){setModal(null);}
  function returnToList(){
    if(history.state?.fromList){history.back();return;}
    navigate(view);
  }
  useEffect(()=>{
    if(loading||error)return;
    const restore=()=>{const id=new URLSearchParams(location.search).get('place');const place=places.find(p=>p.id===id);setDetail(id?(place?{place}:{unavailable:true}):null);};
    const pop=()=>{restore();setModal(null);requestAnimationFrame(()=>window.scrollTo(0,history.state?.scrollY||0));};
    restore();window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
  },[places,loading,error]);
  useEffect(()=>{document.title=detail?.place?detail.place.name+' · 必拉榜':view==='contact'?'合作与交流 · 必拉榜':view==='submit'?'分享一处风景 · 必拉榜':['terms','privacy','rules'].includes(view)?({terms:'服务协议',privacy:'隐私说明',rules:'社区规则'}[view]+' · 必拉榜'):'必拉榜 · 换个地方，看世界';},[detail,view]);
  const notify = (t) => setToast(t);
  const refresh = () =>
    api("/places")
      .then(p=>{setPlaces(p);setError("");})
      .catch((e) => setError(e.message));
  useEffect(() => {
    let active=true;
    api('/places').then(p=>{if(active)setPlaces(p);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    api('/me').then(u=>{if(active)setUser(u);}).catch(()=>{if(active)setToast('账号服务暂不可用，仍可浏览公开地点。刷新页面可重试。');});
    api('/config').then(c=>{if(active)setConfig(c);}).catch(()=>{if(active){setConfig({writeEnabled:false,unavailable:true});setToast('投稿服务暂不可用，仍可浏览公开地点。刷新页面可重试。');}});
    return()=>{active=false;};
  }, []);
  useEffect(()=>{
    if(!user?.account)return;
    let active=true;
    const sync=()=>{if(document.visibilityState==='visible')api('/me').then(next=>{if(active)setUser(next);}).catch(()=>{});};
    sync();const timer=setInterval(sync,15000);window.addEventListener('focus',sync);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',sync);};
  },[user?.id,view]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function navigate(v) {
    const params=new URLSearchParams(location.search);if(v!=='discover'&&!pagePaths[v])params.set("view",v);else params.delete("view");params.delete("place");history.pushState(null,"",(pagePaths[v]||'/')+(params.size?"?"+params:""));
    setView(v);
    setDetail(null);setModal(null);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const isDemo = config.demo && places.length === 0;
  const items = isDemo ? demoPlaces : places;
  const filtered = items
    .filter(
      (p) =>
        withinRegion(p,country) &&
        `${p.name}${regionLabel(p.regionId)}${p.country}${p.city}${p.scene || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) => (b.scores?.[sort]?.rank ?? -1) - (a.scores?.[sort]?.rank ?? -1),
    );
  const image = (p) => p.image || (p.photos?.length ? apiUrl(`/api/photos/${p.photos[0].id}`) : "/no-photo.svg");
  return (
    <>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("discover");
          }}
        >
          <span className="brand-icon">
            <Mountains size={26} weight="bold" />
          </span>
          必拉榜<span className="brand-en">THE SCENIC STOP</span>
        </a>
        <nav className={menu ? "open" : ""}>
          {[
            ["discover", "发现风景"],
            ["editorial", "城市精选"],
            ["ranking", "探索榜单"],
            ["about", "关于必拉榜"],
            ["contact", "合作与交流"],
          ].map(([v, t]) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => navigate(v)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <button
                className="login"
                onClick={() =>
                  user.role === "admin"
                    ? navigate("admin")
                    : notify("你已登录，可以在地点详情评分和留言")
                }
              >
                {user.name}
                {user.role === "admin" ? " · 管理" : ""}
              </button>
              <button
                className="icon-button"
                aria-label="退出登录"
                onClick={async () => {
                  if(sitesIdentityEnabled&&config.auth==='chatgpt'){location.assign('/signout-with-chatgpt?return_to=/');return;}
                    await api("/logout", { method: "POST" });
                  setUser(null);
                  navigate("discover");
                }}
              >
                <SignOut size={20} />
              </button>
            </>
          ) : (
            <button
              className="login"
              onClick={() => setModal({ type: "login" })}
            >
              登录 / 注册
            </button>
          )}
          <button
            className="primary compact"
            onClick={() => navigate("submit")}
          >
            <Plus size={17} />
            分享一处风景
          </button>
          <button
            className="mobile-menu icon-button"
            aria-label="展开导航"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <List size={24} />
          </button>
        </div>
      </header>
      {config.demo && (
        <div className="demo-bar">
          本地体验版 <span>· 投稿与评分仅用于测试，尚未开放公众服务</span>
        </div>
      )}
      {config.publicPreview && <div className="demo-bar">公开预览 <span>· 可浏览地点与体验地图；投稿、评论暂未开放，持续更新中</span></div>}
      {!detail && view === "discover" && (
        <section className="hero">
          <div className="hero-photo" />
          <div className="hero-shade" />
          <div className="hero-copy">
            <div className="eyebrow light">
              <span /> 人生大事，也要选个好风景
            </div>
            <h1>
              世界那么大，
              <br />
              蹲哪儿<span className="orange">？</span>
            </h1>
            <p>
              有人追日落，有人追厕所。
              <br />
              我们负责把这两件事，认真地凑到一起。
            </p>
            <button
              className="hero-cta"
              onClick={() =>
                document
                  .getElementById("explore")
                  .scrollIntoView({ behavior: "smooth" })
              }
            >
              带我找个好坑位 <ArrowUpRight size={22} />
            </button>
          </div>
          <div className="toilet-stamp" aria-hidden="true"><strong>WC</strong><span>值得专程<br/>上个厕所</span></div><div className="hero-caption">
            <span className="caption-line" />
            <div>
              <span>设计想象 / 山湖之间</span>
              <small>AI 生成概念图 · 非真实地点</small>
            </div>
            <span className="photo-index">CONCEPT / 001</span>
          </div>
          <div className="vertical-label">蹲得讲究 · 评得认真</div>
        </section>
      )}
      {!detail && (view === "discover" || view === "ranking") && (
        <main id="explore">
          <a className="editorial-home-entry" href="/editorial" onClick={e=>{e.preventDefault();navigate('editorial')}}><strong>一城一厕 · 编辑推荐 TOP30 ↗</strong><span>84处特色厕所资料，沿着城市与风景找下一站。</span></a>
          <div className="section-heading">
            <div>
              <h2>
                {view === "ranking"
                  ? "厕所也能争 C 位。"
                  : "下一站，在哪儿蹲？"}
              </h2>
            </div>
            <button className="random-stop" disabled={!filtered.length} onClick={()=>openPlace(filtered[Math.floor(Math.random()*filtered.length)])}>随缘蹲一站 ↗</button><span className="small-note">
              {isDemo
                ? "从第一份真实分享开始"
                : `${filtered.length} / ${places.length} 处地点 · 资料与实地分享`}
            </span>
          </div>
          <div className="filter-bar">
            <div className="tabs" aria-label="排行榜维度">
              {Object.entries(labels).map(([k, v]) => (
                <button
                  aria-pressed={sort === k}
                  className={sort === k ? "selected" : ""}
                  onClick={() => setSort(k)}
                  key={k}
                >
                  {k === "overall" ? (
                    <Compass />
                  ) : k === "scenery" ? (
                    <Mountains />
                  ) : k === "cleanliness" ? (
                    <Drop />
                  ) : k === "access" ? (
                    <Path />
                  ) : (
                    <ShieldCheck />
                  )}
                  {v}
                </button>
              ))}
            </div>
            <div className="search-controls">
              <label className="search">
                <MagnifyingGlass size={19} />
                <input
                  aria-label="搜索地点"
                  placeholder="搜索目的地、风景…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <RegionPicker value={country} onChange={updateRegion} places={items}/>
              {country&&<button onClick={()=>updateRegion('')}>清除地区 ×</button>}

            </div>
          </div>
          {isDemo && !loading && (
            <div className="editorial-note">
              <Leaf size={19} />
              <span>
                灵感先行，真实分享由你开启。以下为旅行风景示意，未核实为厕所，不参与排名。
              </span>
              <button onClick={() => navigate("submit")}>
                分享一处风景 <ArrowRight />
              </button>
            </div>
          )}
          {view === "ranking" && (
            <div className="ranking-explainer">
              榜单至少需要 5 位有效评价。综合权重：风景 40% · 卫生 30% · 到达
              20% · 设施 10%，并进行小样本校正。
              <button onClick={() => setModal({ type: "rules" })}>
                查看评分规则
              </button>
            </div>
          )}
          {loading ? (
            <div className="empty">正在寻找风景…</div>
          ) : error ? (
            <div className="empty" role="alert">
              {error}
              <button
                onClick={() => {
                  setError("");
                  refresh();
                }}
              >
                重新加载
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <Compass size={40} />
              <h3>这一站，还没有被发现</h3>
              <p>换个关键词，或分享你知道的风景。</p>{country&&<button onClick={()=>updateRegion(regionMap.get(country)?.parentId||'')}>扩大到上一级地区</button>}
              <button
                onClick={() => {
                  setQuery("");
                  updateRegion("");
                }}
              >
                清除筛选
              </button>
            </div>
          ) : (
            <div
              className={
                view === "ranking" ? "place-grid ranking-grid" : "place-grid"
              }
            >
              {filtered.map((p, i) => (
                <article key={p.id} className="place-card">
                 <a className="place-open" aria-label={`查看${p.name}`} href={p.preview?'#':`/?place=${encodeURIComponent(p.id)}`} onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();openPlace(p);}}}>
                  <div className="card-image">
                    <img
                      src={image(p)}
                      alt={p.preview ? `${p.name}，旅行风景示意` : p.name}
                      loading="lazy"
                    />
                    <span className="image-label">
                      {p.preview
                        ? "灵感示意"
                        : p.demo
                          ? "本地测试投稿"
                          : p.template === "source" ? "公开资料收录" : "社区实拍"}
                    </span>
                    <span className="image-arrow">
                      <ArrowUpRight size={23} />
                    </span>
                    {view === "ranking" && (
                      <span className="rank-number">
                        {p.scores?.[sort]?.rank
                          ? String(i + 1).padStart(2, "0")
                          : "—"}
                      </span>
                    )}
                  </div>
                  <div className="card-body"><div className="card-meta">
                    <span>
                      <MapPin size={14} />
                      {p.regionId?regionLabel(p.regionId):`${p.country} · ${p.city}`}
                    </span>
                    <span>{p.imageCredit?`摄影：${p.imageCredit.author}`:p.scene || (p.template === "source" ? (p.imageCredit?"开放许可图片":"待补实拍") : "实拍分享")}</span>
                  </div>
                  <div className="card-title">
                    <h3>{p.name}</h3>
                    {p.scores?.[sort]?.average ? (
                      <strong>
                        <Star size={17} weight="fill" />
                        {p.scores[sort].average.toFixed(1)}
                      </strong>
                    ) : (
                      <span className="no-score">暂无评分</span>
                    )}
                  </div>
                  <p>{p.description}</p>

                  <div className="card-bottom">
                    <span>
                      {p.preview
                        ? "等待真实地点投稿"
                        : `${p.scores?.overall?.count || 0} 位评价 · ${(p.scores?.overall?.count || 0) < 5 ? "评价不足，暂不上榜" : "社区评价"}`}
                    </span>
                    <span>
                      去看看 <ArrowRight size={16} />
                    </span>
                  </div>
                  </div>
                 </a>
                 {!p.preview&&<button type="button" className="card-share" aria-label={`复制${p.name}的链接`} onClick={async()=>{const url=new URL(location.href);url.search='';url.searchParams.set('place',p.id);try{await navigator.clipboard.writeText(url.href);notify('地点链接已复制');}catch{notify('复制不可用，请打开地点后复制地址栏链接');}}}><LinkSimple size={15}/>复制链接</button>}
                </article>
              ))}
            </div>
          )}
          <section className="invite">
            <div className="invite-number">＋</div>
            <div>
              <h2>
                你见过的风景，
                <br />
                也许是别人的下一站。
              </h2>
              <p>
                一张实拍，一个位置，一段真实体验。
                <br />
                无需创建账户，也能为这份特别的清单添上一笔。
              </p>
            </div>
            <button
              className="primary"
              onClick={() => navigate("submit")}
            >
              <Camera size={21} />
              分享一处风景 <ArrowUpRight size={20} />
            </button>
          </section>
        </main>
      )}
      {!detail && view === "about" && (
        <main className="about">
          <div className="eyebrow">ABOUT THE SCENIC STOP</div>
          <h1>
            让旅途中的小停留，
            <br />
            成为值得记住的风景。
          </h1>
          <p className="lead">
            必拉榜是一份由旅行者共同完善的风景厕所清单。我们关心窗外的风景，也关心是否干净、能否顺利到达，以及每一次普通而真实的使用体验。
          </p>
          <div className="about-points">
            {[
              [
                "01",
                "实拍，而非想象",
                "照片需说明拍摄视角。周边风景不等于厕内视野，示意图片不会进入正式榜单。",
              ],
              [
                "02",
                "好看，也要好用",
                "分开评价风景、卫生、到达和设施。每份评价都有到访日期，少量评价不会被包装成权威排名。",
              ],
              [
                "03",
                "尊重每个人的隐私",
                "不拍摄如厕中的人，不暴露隔间隐私。投稿先审核，位置指向公共地点，而非个人行踪。",
              ],
            ].map(([n, t, p]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{p}</p>
              </article>
            ))}
          </div>
          <button
            className="primary"
            onClick={() => navigate("submit")}
          >
            分享一处风景 <ArrowUpRight />
          </button>
        </main>
      )}
      {!detail && view === 'contact' && <ContactPage notify={notify} onBack={()=>navigate('discover')}/>}
      {!detail && view === 'editorial' && <React.Suspense fallback={<p role="status">正在载入城市精选…</p>}><EditorialPlaces/></React.Suspense>}
      {!detail && ['terms','privacy','rules'].includes(view) && <LegalPage type={view} config={config} onBack={()=>navigate('discover')}/>}
      {!detail && view === "admin" && (
        <AdminDesk user={user} api={api} notify={notify} refresh={refresh} onAdd={()=>navigate("submit")} onOpen={openPlace} accountRules={config.accountRules}/>
      )}
      {!detail && view === 'submit' && <main className="submission-page">
        <button className="page-back" onClick={()=>navigate('discover')}>← 返回发现</button>
        <div className="submission-heading"><p className="eyebrow">好风景，别一个人蹲</p><h1>分享一处风景</h1><p>把你发现的好地方，留给下一位路过的人。</p></div>
        <div className="submission-layout"><section className="submission-main" aria-label="地点投稿">{user?.account?.status==='muted'?<AccountRestriction account={user.account}/>:<SubmissionWizard key={user?.id||'guest'} places={places} config={config} user={user} notify={notify} api={api} Verification={Verification} onDone={refresh} onReceipt={token=>setModal({type:'receipt',token})}/>}</section>
          <aside className="submission-guide"><Camera size={28}/><h2>把一处地点讲清楚</h2><p>一张看风景，一张认入口。再留几句找路说明，下一位就少绕一点路。</p><ul><li>最多 6 张照片，可选封面</li><li>地图上没有？文字路线也可以</li><li>无需注册，审核通过后公开</li></ul><p className="muted">拍建筑、拍风景，记得避开正在使用厕所的人。</p><button className="text-action" onClick={()=>setModal({type:'rules'})}>查看投稿规则 <ArrowUpRight size={16}/></button></aside></div>
      </main>}
      {detail && <main className="place-page">
        <button className="outline place-back" onClick={returnToList}>← 返回地点列表</button>
        {detail.place?<>
          <div className="place-page-heading"><p className="eyebrow">这站，值得蹲一蹲吗？</p><h1>{detail.place.name}</h1><p className="muted">{detail.place.regionId?regionLabel(detail.place.regionId):[detail.place.country,detail.place.city].filter(Boolean).join(' / ')}</p></div>
          <div className="place-page-layout"><article className="place-page-content"><Detail key={detail.place.id} place={detail.place} config={config} user={user} image={image(detail.place)} notify={notify} login={()=>setModal({type:'login'})}/></article>
            <aside className="place-page-nav" onClick={e=>{const a=e.target.closest("a");if(a&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();document.querySelector(a.hash)?.scrollIntoView({behavior:"smooth"});}}}><strong>这站怎么看</strong><a href="#place-photos">照片与地点介绍</a><a href="#place-directions">位置与找路说明</a><a href="#place-scores">到访者评分</a><a href="#place-community">评论与现场动态</a><p>先看入口怎么走，再看看最近去过的人怎么说。</p><button className="primary" onClick={()=>document.getElementById('place-community')?.scrollIntoView({behavior:'smooth'})}>我也来补充</button></aside>
          </div>
        </>:<section className="empty" role="status"><h1>{error?'地点暂时加载失败':detail.loading?'正在寻找这个坑位…':'这个地点暂时无法查看'}</h1><p>{error||(detail.loading?'正在读取地点资料，请稍候。':'链接可能有误，或地点尚未公开。')}</p>{error&&<button onClick={refresh}>重新加载</button>}</section>}
      </main>}
      <footer>
        <div className="footer-top">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("discover");
            }}
          >
            <Mountains size={27} />
            必拉榜
          </a>
          <p>世界很大，厕所也得挑一下。</p>
          <span>发现 · 分享 · 认真评价</span>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} 必拉榜 · 本站用户体验不代表官方评级
          </span>
          <div>
            <button onClick={() => navigate('contact')}>合作与交流</button>
            <button onClick={() => navigate('terms')}>服务协议</button>
            <button onClick={() => navigate('privacy')}>
              隐私说明
            </button>
            <button onClick={() => navigate('rules')}>
              投稿与评分规则
            </button>
            <button onClick={() => setModal({ type: "receipt" })}>
              查询投稿
            </button>
          </div>
        </div>
      </footer>
      {modal && (
        <Modal
          close={closeModal}
          title={
            {
              unavailable: "地点暂不可用",
              upload: "分享一处风景",
              login: "欢迎来到必拉榜",
              detail: modal.place?.name,
              privacy: "隐私与数据说明",
              rules: "投稿与评分规则",
              receipt: "查询投稿进度",
            }[modal.type]
          }
        >
          {modal.type === "unavailable" ? <div className="notice"><h3>这个地点暂时无法查看</h3><p>链接可能有误，或地点尚未公开、已下架。</p><button onClick={closeModal}>返回发现页</button></div> : modal.type === "upload" ? (
            <SubmissionWizard places={places} config={config} user={user} notify={notify} api={api} Verification={Verification} onDone={refresh} onReceipt={token=>setModal({type:"receipt",token})} />
          ) : modal.type === "login" ? (
            <Login
              config={config}
              onLogin={(u) => {
                setUser(u);
                setModal(null);
                notify("登录成功");
              }}
            />
          ) : modal.type === "receipt" ? (
            <ReceiptPanel api={api} initialToken={modal.token||""}/>
          ) : (
            <Policy type={modal.type} config={config} />
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
function Modal({ children, title, close }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      aria-label={title}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="关闭弹窗" onClick={close}>
          <X size={24} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
function Login({ config, onLogin }) {
  const [register, setRegister] = useState(false),
    [verification, setVerification] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const strictRules=!!config.accountRules;
  if(sitesIdentityEnabled&&config.auth==='chatgpt')return <section className="notice"><h3>使用 ChatGPT 登录</h3><p>浏览和投稿不需要账户；评论、回复与评分会关联到你的登录身份。</p><p>首次登录会建立本站资料，公开显示旅人昵称，不公开邮箱。</p><a className="primary" href={'/signin-with-chatgpt?return_to='+encodeURIComponent(location.pathname+location.search)} target="_top">使用 ChatGPT 登录</a></section>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const data=new FormData(e.currentTarget);
          if(register&&strictRules){
            const invalid=registrationPasswordError(data.get('password'),data.get('name')||'');
            if(invalid)throw Error(invalid);
            if(data.get('password')!==data.get('passwordConfirmation'))throw Error('两次输入的密码不一致，请检查');
          }
          onLogin(
            await api(register ? "/register" : "/login", {
              method: "POST",
              body: {
                ...Object.fromEntries(data),
                ...(register&&strictRules?agreementPayload(data):{}),
                verification,
              },
            }),
          );
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
      className="account-login"
    >
      <p className="form-intro">登录后，留下评价，也让每一份评分更可信。</p>
      <div className="notice">
        {config.demo
          ? "本地管理员：Meos / meos。也可使用模拟手机号验证注册测试账户；请勿填写真实个人信息。"
          : config.auth==='password' ? "用户名会公开显示。注册后可评论、补图和评分；发布内容需审核。请使用独立密码，当前不支持自助找回。" : "手机号注册与验证尚未开放。"}
      </div>
      <div className="tabs">
        <button
          type="button"
          className={!register ? "selected" : ""}
          disabled={busy}
          onClick={() => {setRegister(false);setError('');}}
        >
          登录
        </button>
        <button
          type="button"
          className={register ? "selected" : ""}
          disabled={busy}
          onClick={() => {setRegister(true);setError('');}}
        >
          注册账户
        </button>
      </div>
      <Field
        label={config.auth==='password' ? "用户名" : register ? "昵称" : "账号"}
        name="name"
        required
        autoComplete="username"
        maxLength={24}
        disabled={busy}
        aria-describedby="account-name-hint"
        placeholder={config.demo?'Meos':'例如：山海漫游者'}
      />
      <p id="account-name-hint" className="field-hint">2–24 位文字、数字、下划线或短横线；用户名会公开显示，请勿填写手机号或冒充他人。</p>
      <Field
        label="密码"
        name="password"
        type={showPassword?'text':'password'}
        required
        minLength={register&&strictRules?8:4}
        maxLength={128}
        disabled={busy}
        aria-describedby="account-password-hint"
        autoComplete={register ? "new-password" : "current-password"}
      />
      <div className="account-password-help"><p id="account-password-hint" className="field-hint">{register&&strictRules?'8–128 位，建议使用独立的长密码或短语。':'使用注册时设置的密码。当前不支持自助找回。'}</p><button type="button" className="text-action" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'隐藏密码':'显示密码'}</button></div>
      {register&&strictRules&&<><Field label="再次输入密码" name="passwordConfirmation" type={showPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy}/><AgreementFields disabled={busy}/></>}
      {register && config.auth!=='password' && (
        <Verification config={config} onVerified={setVerification} purpose="register" />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        disabled={busy || !config.writeEnabled || (register && config.auth!=='password' && !verification)}
        className="primary full"
      >
        {busy ? "正在处理…" : register ? "创建账户" : "登录"}
        <ArrowRight />
      </button>
    </form>
  );
}
function Detail({ place: p, user, image, notify, login, config }) {

  const [reviews, setReviews] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState(false);
  useEffect(() => {
    if (!p.preview)
      api(`/places/${p.id}/reviews`)
        .then(setReviews)
        .catch((e) => setError(e.message));
  }, [p.id,config?.community]);
  return (
    <>
      <PlaceGallery place={p}/>
      <section className="place-introduction"><div className="section-title"><h2>这一站的看点</h2>{!p.preview&&<button className="text-action" onClick={async()=>{const url=new URL(location.origin);url.searchParams.set('place',p.id);try{await navigator.clipboard.writeText(url.href);notify('地点链接已复制');}catch{notify('复制不可用，可复制浏览器地址栏链接');}}}><LinkSimple size={16}/>复制链接</button>}</div><p>{p.description}</p></section>      {p.preview ? (
        <div className="notice">
          这是一张旅行风景示意图，未核实为真实厕所。位置、导航和评分不开放；欢迎提交你亲自到访的地点。
        </div>
      ) : (
        <>
          <section id="place-directions" className="wayfinding"><div className="section-title"><h2>先认路，再看风景</h2><MapPin size={24}/></div>
            <dl className="visit-facts"><div><dt>具体位置</dt><dd>{p.address||'详细地址待补充'}</dd></div><div><dt>开放时间</dt><dd>{p.hours||'待核实'}</dd></div><div><dt>费用与门票</dt><dd>{p.fee||'待核实'}</dd></div><div><dt>{p.date?'最近投稿到访':'资料核查'}</dt><dd>{p.date||p.checkedAt||'日期待补充'}</dd></div></dl>
            <div className="route-notes"><h3>入口怎么走</h3>{p.landmark&&<p className="landmark">参考地标：{p.landmark}</p>}<p>{p.directions||'入口路线待补充，请结合原文与现场指示确认。'}</p><button className="outline" onClick={()=>navigator.clipboard.writeText([p.name,p.address,p.landmark,p.directions].filter(Boolean).join('\n')).then(()=>notify('找路说明已复制')).catch(()=>notify('复制不可用，请手动选择文字'))}>复制找路说明</button></div>
            <div className="facility-list">{[['wheelchair','无障碍'],['babycare','母婴空间'],['paper','卫生纸'],['water','洗手水源']].map(([k,t])=><span key={k}><span>{t}</span><strong>{({yes:'有',no:'无'})[p[k]]||'待核实'}</strong></span>)}</div>
            <p className="coordinate-note">{p.lat==null?'暂无地图点位，以文字说明找路。':`${p.locationMode==='reference'?'参考地标坐标 · 非厕所入口':'厕所位置'} · WGS84 ${p.lat}, ${p.lng}`}</p>
          </section>
          {p.sourceUrl&&<div className="place-source"><span>资料来源</span><a href={p.sourceUrl} target="_blank" rel="noreferrer">{p.publisher||'查看原文'} <ArrowUpRight size={16}/></a><small>历史资料不代表当前卫生与开放状态，出发前请再次确认。</small></div>}
          <div className="section-title score-heading"><h2>这站，你给几分？</h2><span className="muted">{p.scores?.overall?.count||0} 位有效评价</span></div>          <div id="place-scores" className="scores">
            {Object.entries(labels)
              .filter(([k]) => k !== "overall")
              .map(([k, v]) => (
                <div key={k}>
                  <strong>{p.scores[k].average?.toFixed(1) || "—"}</strong>
                  <span>{v}</span>
                </div>
              ))}
          </div>
          <p className="muted">
            {p.scores.overall.count} 位有效评价 · 少于 5 位暂不上榜
          </p>
          {config?.community?<CommunityReviews place={p} user={user} api={api} login={login} notify={notify}/>:<>
          <h3>到访者的真实体验</h3>
          {reviews.length ? (
            reviews.map((r) => (
              <article className="review" key={r.id}>
                <strong>{r.name}</strong>
                <small>{r.date} 到访</small>
                <p>{r.text}</p>
              </article>
            ))
          ) : (
            <p className="muted">还没有公开评价，期待第一份真实体验。</p>
          )}
          {user ? (
            <form
              className="review-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const b = Object.fromEntries(new FormData(e.currentTarget));
                for (const k of Object.keys(labels).filter(
                  (k) => k !== "overall",
                ))
                  b[k] = Number(b[k]);
                try {
                  await api(`/places/${p.id}/reviews`, {
                    method: "POST",
                    body: b,
                  });
                  notify("评价已提交，审核后公开；重复提交会更新你的评价");
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>留下这次到访的感受</h3>
              <div className="form-grid">
                {Object.entries(labels)
                  .filter(([k]) => k !== "overall")
                  .map(([k, v]) => (
                    <Field label={v} key={k}>
                      <Select name={k} required defaultValue="">
                        <option value="" disabled>
                          请选择评分
                        </option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} 分 ·{" "}
                            {["很差", "较差", "一般", "不错", "非常好"][n - 1]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ))}
              </div>
              <Field
                label="到访日期"
                type="date"
                name="date"
                max={dateNow}
                required
              />
              <Field label="评价内容">
                <textarea
                  name="text"
                  required
                  minLength={2}
                  maxLength={1000}
                  rows={3}
                />
              </Field>
              <button className="primary" disabled={busy}>
                {busy ? "正在提交…" : "提交评价"}
              </button>
            </form>
          ) : (
            <button className="outline" onClick={login}>
              登录后评分与留言 <ArrowRight />
            </button>
          )}
          </>}
          <button className="report-button" onClick={() => setReport(!report)}>
            <Flag />
            举报 / 信息纠错
          </button>
          {report && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                try {
                  await api(`/places/${p.id}/reports`, {
                    method: "POST",
                    body: Object.fromEntries(new FormData(e.currentTarget)),
                  });
                  setReport(false);
                  notify("已收到举报，管理员将核查处理");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Field label="请说明侵权、隐私问题或需要纠正的信息">
                <textarea
                  name="reason"
                  required
                  minLength={4}
                  maxLength={1000}
                />
              </Field>
              <button className="outline">提交举报</button>
            </form>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
function Verification({ config, onVerified, skip = false, purpose = "submission" }) {
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(""),
    [demoCode, setDemoCode] = useState(""),
    [done, setDone] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if(config.guestSubmission&&!skip)return <div className="notice">无需账户或手机号，提交后会获得查询回执；审核通过才公开。</div>;
  if (skip) return <div className="notice">已登录，使用当前账户提交。</div>;
  return (
    <section className="verification">
      <h3>验证手机号，无需创建账户</h3>
      {done ? (
        <p className="notice">
          <Check size={15} /> 本地模拟验证已通过（5 分钟内有效）
        </p>
      ) : (
        <>
          <div className="form-grid">
            <Field
              label="手机号（本地请使用测试号码）"
              type="tel"
              value={phone}
              placeholder="例如 13800000000"
              maxLength={11}
              onChange={(e) => {
                setPhone(e.target.value);
                setChallenge("");
                setDemoCode("");
              }}
            />
            <button
              type="button"
              className="outline verification-button"
              disabled={busy || !config.writeEnabled}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const r = await api("/verification/send", {
                    method: "POST",
                    body: { phone, purpose },
                  });
                  setChallenge(r.challenge);
                  setDemoCode(r.demoCode);
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              获取验证码
            </button>
          </div>
          {demoCode && (
            <p className="notice">
              模拟验证码：<strong>{demoCode}</strong> ·
              未发送短信，仅用于本地测试
            </p>
          )}
          {challenge && (
            <div className="form-grid">
              <Field
                label="验证码"
                inputMode="numeric"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                type="button"
                className="outline verification-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const r = await api("/verification/check", {
                      method: "POST",
                      body: { challenge, code },
                    });
                    onVerified(r.verification);
                    setDone(true);
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                验证
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function Policy({ type,config }) {
  return <LegalContent type={type} config={config}/>;
}
createRoot(document.getElementById("root")).render(<App />);
