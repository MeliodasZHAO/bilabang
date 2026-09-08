import {installModeration} from './server-moderation.js';
import express from "express";
import {queryRegions} from './server-regions.js';
import {regionPath} from './src/regions.js';
import {migrateV3} from './server-migrations.js';
import {renderPublicPage,siteOrigin,sitemap} from "./server-public.js";
import {sourceImages} from "./src/data/source-images.js";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { normalizePlace } from "./src/place-schema.js";
import { dimensions, score } from "./src/scoring.js";
const root = path.dirname(fileURLToPath(import.meta.url));
const production =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production";
const data = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
fs.mkdirSync(path.join(data, "images"), { recursive: true });
const db = new DatabaseSync(path.join(data, "bilabang.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT UNIQUE,password TEXT,salt TEXT,role TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS verifications(id TEXT PRIMARY KEY,phone TEXT,code TEXT,expires INTEGER,attempts INTEGER DEFAULT 0,verified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL,receipt TEXT UNIQUE,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,place_id TEXT REFERENCES places(id),kind TEXT);
CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,place_id TEXT,user_id TEXT,payload TEXT,status TEXT,UNIQUE(place_id,user_id));
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,place_id TEXT,reason TEXT,status TEXT DEFAULT 'pending',created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,target TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);`);
const id = () => randomBytes(18).toString("hex");
if(!production)migrateV3(db,data);
const codeHash=(challenge,code)=>createHash('sha256').update(challenge+':'+code).digest('hex');
if (!production && !db.prepare("SELECT id FROM users LIMIT 1").get()) {
  const salt = id();
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
    id(),
    "Meos",
    scryptSync("meos", salt, 64).toString("hex"),
    salt,
    "admin",
  );
}
const app = express();
app.use(compression());
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  if (
    req.method !== "GET" &&
    req.headers.origin &&
    req.headers.origin !== `${req.protocol}://${req.headers.host}`
  )
    return res.status(403).json({ error: "请求来源不匹配" });
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use((req, res, next) => {
  const token = req.headers.cookie
    ?.split("; ")
    .find((s) => s.startsWith("session="))
    ?.slice(8);
  req.user =
    !production && token
      ? db
          .prepare(
            "SELECT users.id,name,role FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
          )
          .get(token, Date.now())
      : null;
  next();
});
const auth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: "请先登录" });
const admin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : res.status(403).json({ error: "需要管理员权限" });
const localOnly = (req, res, next) =>
  !production
    ? next()
    : res
        .status(503)
        .json({ error: "尚未接入正式身份验证服务，暂不接受投稿、注册或登录" });
const audit = (actor, action, target) =>
  db
    .prepare("INSERT INTO audit(actor,action,target) VALUES(?,?,?)")
    .run(actor, action, target);
app.get("/api/config", (req, res) =>
  res.json({ demo: !production, writeEnabled: !production }),
);
app.get("/api/me", (req, res) => res.json(req.user || null));
app.get('/api/regions',(req,res)=>{res.setHeader('Cache-Control','public, max-age=86400');res.json(queryRegions(Object.fromEntries(['q','parent','id','offset'].map(k=>[k,typeof req.query[k]==='string'?req.query[k]:'']))));});
app.post(
  "/api/verification/send",
  rateLimit({ windowMs: 60000, limit: 3 }),
  localOnly,
  (req, res) => {
    const phone = req.body.phone;
    const purpose=req.body.purpose||'submission';
    if(!['submission','register'].includes(purpose))return res.status(400).json({error:'验证用途无效'});
    if (typeof phone !== "string" || !/^1[3-9]\d{9}$/.test(phone))
      return res.status(400).json({ error: "请输入有效的中国大陆手机号" });
    const challenge = id();
    const code = String(randomInt(100000, 1000000));
    db.prepare("DELETE FROM verifications WHERE expires<?").run(Date.now());
    db.prepare(
      "INSERT INTO verifications(id,phone,code,expires,purpose) VALUES(?,?,?,?,?)",
    ).run(challenge, phone, codeHash(challenge,code), Date.now() + 300000,purpose);
    res.json({ challenge, demoCode: code });
  },
);
app.post("/api/verification/check", localOnly, (req, res) => {
  const { challenge, code } = req.body;
  if (typeof challenge !== "string" || typeof code !== "string")
    return res.status(400).json({ error: "验证码格式错误" });
  const row = db
    .prepare("SELECT * FROM verifications WHERE id=?")
    .get(challenge);
  if (!row || row.expires < Date.now() || row.attempts >= 5 || row.used_at)
    return res.status(400).json({ error: "验证码已失效，请重新获取" });
  db.prepare("UPDATE verifications SET attempts=attempts+1 WHERE id=?").run(
    challenge,
  );
  if (row.code !== codeHash(challenge,code)) return res.status(400).json({ error: "验证码不正确" });
  db.prepare("UPDATE verifications SET verified=1 WHERE id=?").run(challenge);
  res.json({ verification: challenge });
});
function verified(token,purpose='submission',allowConsumed=false) {
  return (
    typeof token === "string" &&
    db
      .prepare(
        "SELECT id FROM verifications WHERE id=? AND purpose=? AND verified=1 AND expires>? AND (?=1 OR used_at IS NULL)",
      )
      .get(token,purpose, Date.now(),allowConsumed?1:0)
  );
}
app.post("/api/register", localOnly, (req, res) => {
  const { name, password, verification } = req.body;
  if (!verified(verification,'register'))
    return res.status(400).json({ error: "请先完成手机号验证" });
  if (
    typeof name !== "string" ||
    !/^\S{2,24}$/.test(name) ||
    typeof password !== "string" ||
    password.length < 4 ||
    password.length > 128
  )
    return res.status(400).json({ error: "昵称需 2–24 字，密码需 4–128 字符" });
  if (db.prepare("SELECT id FROM users WHERE name=?").get(name))
    return res.status(409).json({ error: "该昵称已被使用" });
  const uid = id(),salt = id(),token = id();
  db.exec('BEGIN IMMEDIATE');
  try{
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
    uid,
    name,
    scryptSync(password, salt, 64).toString("hex"),
    salt,
    "member",
  );
  db.prepare("UPDATE verifications SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(verification);
  db.prepare('INSERT INTO identities(id,user_id,provider,subject,environment) VALUES(?,?,?,?,?)').run(id(),uid,'local-demo',id(),'local');
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    token,
    uid,
    Date.now() + 86400000,
  );
  db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');return res.status(500).json({error:'注册暂未完成，请稍后重试'});}
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    maxAge: 86400000,
  });
  res.json({ id: uid, name, role: "member" });
});
app.post(
  "/api/login",
  rateLimit({ windowMs: 60000, limit: 10 }),
  localOnly,
  (req, res) => {
    const { name, password } = req.body;
    if (
      typeof name !== "string" ||
      typeof password !== "string" ||
      password.length > 128
    )
      return res.status(400).json({ error: "账号或密码格式错误" });
    const user = db.prepare("SELECT * FROM users WHERE name=?").get(name);
    if (
      !user ||
      !timingSafeEqual(
        scryptSync(password, user.salt, 64),
        Buffer.from(user.password, "hex"),
      )
    )
      return res.status(401).json({ error: "账号或密码不正确" });
    const token = id();
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      token,
      user.id,
      Date.now() + 86400000,
    );
    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: production,
      maxAge: 86400000,
    });
    res.json({ id: user.id, name: user.name, role: user.role });
  },
);
app.post("/api/logout", (req, res) => {
  const token = req.headers.cookie
    ?.split("; ")
    .find((s) => s.startsWith("session="))
    ?.slice(8);
  if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
  res.clearCookie("session");
  res.json({ ok: true });
});
function publicPlace(row) {
  const payload = JSON.parse(row.payload);
  const reviews = db
    .prepare(
      "SELECT payload FROM reviews WHERE place_id=? AND status='approved'",
    )
    .all(row.id)
    .map((r) => JSON.parse(r.payload));
  return {
    id: row.id,
    regionPath: regionPath(payload.regionId),
    ...Object.fromEntries(Object.entries(payload).filter(([k])=>!["requestActor","requestId","submittedBy"].includes(k))),
    ...sourceImages[row.id],
    photos: db
      .prepare("SELECT id,kind FROM photos WHERE place_id=?")
      .all(row.id).map((p,i)=>({...p,...payload.photoMetadata?.[i]})),
    scores: Object.fromEntries(
      ["overall", ...dimensions].map((k) => [k, score(reviews, k)]),
    ),
  };
}
app.get("/api/places", (req, res) =>
  res.json(
    db
      .prepare("SELECT * FROM places WHERE status='approved'")
      .all()
      .map(publicPlace)
      .filter((p) => !production || !p.demo),
  ),
);
app.get("/api/places/:id/reviews", (req, res) =>
  res.json(
    production ? [] : db
      .prepare(
        "SELECT reviews.id,reviews.payload,users.name FROM reviews JOIN users ON users.id=reviews.user_id JOIN places ON places.id=reviews.place_id WHERE reviews.place_id=? AND reviews.status='approved' AND places.status='approved'",
      )
      .all(req.params.id)
      .map((r) => ({ id: r.id, name: r.name, ...JSON.parse(r.payload) })),
  ),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6, fields: 20 },
});
app.post(
  "/api/submissions",
  rateLimit({ windowMs: 3600000, limit: 15 }),
  localOnly,
  upload.array("photos", 6),
  async (req, res, next) => {
    let written = [];
    try {
      const b = req.body;
      if (!req.user && !verified(b.verification,'submission',true))
        return res
          .status(400)
          .json({ error: "请先完成手机号验证，无需创建账户" });
      let payload, photoMetadata;
      try {payload=JSON.parse(b.payload);photoMetadata=JSON.parse(b.photoMetadata||'[]');}catch{return res.status(400).json({error:'请使用新版创建流程'});}
      if(!Array.isArray(photoMetadata)||photoMetadata.length!==req.files.length)return res.status(400).json({error:'图片与说明数量不一致'});
      const requestId=typeof payload.requestId==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(payload.requestId)?payload.requestId:null;
      const actor=req.user?.id||b.verification;
      if(requestId){const existing=db.prepare("SELECT id,receipt,status FROM places WHERE json_extract(payload,'$.requestId')=? AND json_extract(payload,'$.requestActor')=?").get(requestId,actor);if(existing)return res.status(200).json(existing);}
      if(!req.user&&!verified(b.verification))return res.status(400).json({error:'验证已使用，请重新验证后投稿'});
      const publish=payload.publish===true;
      try{payload=normalizePlace(payload,photoMetadata);}catch(e){return res.status(400).json({error:e.message,fields:e.fields});}
      if(publish&&(req.user?.role!=='admin'||payload.customRegion))return res.status(403).json({error:'仅管理员可发布，待补录地区需先核实'});
      const converted = [];
      for (const f of req.files) {
        const metadata = await sharp(f.buffer, {
          limitInputPixels: 40000000,
        }).metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format))
          throw new Error("仅支持 JPG、PNG 和 WebP 实拍图片");
        converted.push(
          await sharp(f.buffer, { limitInputPixels: 40000000 })
            .rotate()
            .resize({
              width: 1800,
              height: 1800,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .toBuffer(),
        );
      }
      const placeId = id(),
        receipt = id();
      for (const buffer of converted) {
        const photoId = id();
        fs.writeFileSync(path.join(data, "images", photoId + ".webp"), buffer);
        written.push(photoId);
      }
      db.exec("BEGIN");
      try {
        // Image decoding yields; recheck within the transaction to serialize concurrent retries.
        if(requestId){const existing=db.prepare("SELECT id,receipt,status FROM places WHERE json_extract(payload,'$.requestId')=? AND json_extract(payload,'$.requestActor')=?").get(requestId,actor);if(existing){db.exec('ROLLBACK');for(const p of written)fs.rmSync(path.join(data,'images',p+'.webp'),{force:true});return res.status(200).json(existing);}}
        if(!req.user&&!verified(b.verification))throw Error('验证已使用，请重新验证后投稿');
        db.prepare(
          "INSERT INTO places(id,payload,status,receipt) VALUES(?,?,?,?)",
        ).run(
          placeId,
          JSON.stringify({...payload,requestId,requestActor:actor,demo:true,submittedBy:req.user?.id||'verified-guest'}),
          publish ? "approved" : "pending",
          receipt,
        );
        for (const [index,p] of written.entries())
          db.prepare("INSERT INTO photos VALUES(?,?,?)").run(
            p,
            placeId,
            photoMetadata[index].kind,
          );
        audit(req.user?.id||"verified-guest", "submit", placeId);
        if(publish)audit(req.user.id,"approved",placeId);
        if(!req.user)db.prepare('UPDATE verifications SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(b.verification);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      res.status(201).json({ receipt, id: placeId, status:publish?"approved":"pending" });
    } catch (e) {
      for (const p of written)
        fs.rmSync(path.join(data, "images", p + ".webp"), { force: true });
      next(e);
    }
  },
);
app.get("/api/receipts/:token", (req, res) => {
  if (production) return res.status(404).json({ error: "未找到投稿回执" });
  const row = db
    .prepare("SELECT id,status,created FROM places WHERE receipt=?")
    .get(req.params.token);
  if(!row)return res.status(404).json({error:'未找到投稿回执'});
  const reason=db.prepare("SELECT public_reason FROM moderation_events WHERE target_type='places' AND target_id=? ORDER BY id DESC LIMIT 1").get(row.id)?.public_reason||'';
  res.json({status:row.status,created:row.created,reason});
});
app.get("/api/photos/:id", (req, res) => {
  if (production) return res.sendStatus(404);
  const row = db
    .prepare(
      "SELECT places.status FROM photos JOIN places ON places.id=photos.place_id WHERE photos.id=?",
    )
    .get(req.params.id);
  if (!row || (row.status !== "approved" && req.user?.role !== "admin"))
    return res.sendStatus(404);
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(path.join(data, "images", req.params.id + ".webp"));
});
app.post("/api/places/:id/reviews", auth, localOnly, (req, res) => {
  const b = req.body;
  if (
    !db
      .prepare("SELECT id FROM places WHERE id=? AND status='approved'")
      .get(req.params.id)
  )
    return res.status(404).json({ error: "地点尚未公开" });
  if (
    !dimensions.every(
      (k) => Number.isInteger(b[k]) && b[k] >= 1 && b[k] <= 5,
    ) ||
    typeof b.text !== "string" ||
    b.text.length < 2 ||
    b.text.length > 1000 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
    b.date > new Date().toISOString().slice(0, 10)
  )
    return res
      .status(400)
      .json({ error: "请填写有效的评分、到访日期和 2–1000 字评价" });
  const payload = JSON.stringify(
    Object.fromEntries([...dimensions, "text", "date"].map((k) => [k, b[k]])),
  );
  db.prepare(
    "INSERT INTO reviews VALUES(?,?,?,?,?) ON CONFLICT(place_id,user_id) DO UPDATE SET payload=excluded.payload,status=excluded.status",
  ).run(id(), req.params.id, req.user.id, payload, "pending");
  res.json({ ok: true });
});
app.post(
  "/api/places/:id/reports",
  localOnly,
  rateLimit({ windowMs: 3600000, limit: 10 }),
  (req, res) => {
    if (
      typeof req.body.reason !== "string" ||
      req.body.reason.trim().length < 4 ||
      req.body.reason.length > 1000
    )
      return res.status(400).json({ error: "请填写 4–1000 字具体原因" });
    if (
      !db
        .prepare("SELECT id FROM places WHERE id=? AND status='approved'")
        .get(req.params.id)
    )
      return res.status(404).json({ error: "地点不存在" });
    db.prepare("INSERT INTO reports(id,place_id,reason) VALUES(?,?,?)").run(
      id(),
      req.params.id,
      req.body.reason,
    );
    res.json({ ok: true });
  },
);
app.get("/api/admin", admin, (req, res) =>
  res.json({
    places: db
      .prepare("SELECT * FROM places ORDER BY created DESC")
      .all()
      .map((r) => ({ ...publicPlace(r), status: r.status, version:r.version })),
    reviews: db
      .prepare("SELECT * FROM reviews")
      .all()
      .map((r) => ({ ...r, ...JSON.parse(r.payload) })),
    reports: db.prepare("SELECT * FROM reports ORDER BY created DESC").all(),
  }),
);
installModeration(app,db,{admin,audit});
app.use("/api", (req, res) => res.status(404).json({ error: "接口不存在" }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res
    .status(400)
    .json({
      error:
        err instanceof multer.MulterError
          ? "每次最多 6 张图片，每张不超过 8 MB"
          : "图片处理失败，请使用有效的 JPG、PNG 或 WebP 图片",
    });
});
const server = createHttpServer(app);
// Licensed source images follow the same publication state as their place.
// Keep this before static hosting so a direct asset URL cannot bypass removal.
app.use((req,res,next)=>{
  let requestPath;
  try{requestPath=path.posix.normalize(decodeURIComponent(req.path).replaceAll('\\','/'));}catch{return res.sendStatus(404);}
  if(!/^\/sourced(?:\/|$)/i.test(requestPath))return next();
  const entry=Object.entries(sourceImages).find(([,media])=>media.image===requestPath);
  if(!entry||!['GET','HEAD'].includes(req.method))return res.sendStatus(404);
  const row=db.prepare('SELECT status,payload FROM places WHERE id=?').get(entry[0]);
  if(!row||(row.status!=='approved'&&req.user?.role!=='admin')||(production&&JSON.parse(row.payload).demo))return res.sendStatus(404);
  res.setHeader('Cache-Control','private, no-store');
  res.sendFile(path.join(root,'public',entry[1].image));
});
if (production || process.argv.includes('--preview')) {
  const origin=siteOrigin(process.env.SITE_URL);
  const template=()=>fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
  const visiblePlaces=()=>db.prepare("SELECT * FROM places WHERE status='approved'").all().map(publicPlace).filter(p=>!production||!p.demo);
  app.get('/robots.txt',(req,res)=>res.type('text/plain').send(production&&origin?`User-agent: *\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n'));
  app.get('/sitemap.xml',(req,res)=>{if(!production||!origin)return res.status(503).type('text/plain').send('正式域名尚未配置或当前为本地体验模式');res.setHeader('Cache-Control','no-store');res.type('application/xml').send(sitemap(visiblePlaces(),origin));});
  app.get('/',(req,res)=>{
    const places=visiblePlaces();const requested=req.query.place;const place=typeof requested==='string'?places.find(p=>p.id===requested):null;const missing=requested!==undefined&&!place;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag',production&&origin&&!missing?'index, follow':'noindex, nofollow');
    res.status(missing?404:200).type('html').send(renderPublicPage(template(),{place,places,missing,origin,indexable:production&&!!origin}));
  });
  app.use(express.static(path.join(root, "dist")));
  app.use("/assets",(req,res)=>res.sendStatus(404));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 5186);
server.listen(port, "127.0.0.1", () =>
  console.log(
    `必拉榜 http://127.0.0.1:${server.address().port} (${production ? "production: identity gate closed" : "local demo"})`,
  ),
);
