import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
async function start(dir, production = false) {
  const child = spawn(
    process.execPath,
    ["server.js", ...(production ? ["--production"] : [])],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATA_DIR: dir, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const url = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(
      () => reject(new Error("Server startup timeout " + log)),
      20000,
    );
    child.stdout.on("data", (d) => {
      log += d;
      const match = log.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.stderr.on("data", (d) => (log += d));
    child.on("exit", (c) => {
      clearTimeout(timer);
      reject(new Error(`exit ${c}: ${log}`));
    });
  });
  return { child, url };
}
async function stop(child) {
  const done = new Promise((r) => child.once("exit", r));
  child.kill();
  await done;
}
test("runtime: verified extensionless upload, moderation, sessions, review upsert, reports and member registration", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bilabang-test-"));
  const { child, url } = await start(dir);
  let cookie = "";
  const request = async (p, body, options = {}) =>
    fetch(url + "/api" + p, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...options.headers,
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
  try {
    assert.equal((await request("/admin")).status, 403);
    assert.equal(
      (await request("/login", { name: "Meos", password: "wrong" })).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/login",
          { name: "Meos", password: "meos" },
          { headers: { Origin: "https://untrusted.invalid" } },
        )
      ).status,
      403,
    );
    const challenge = await (
      await request("/verification/send", { phone: "13800000000" })
    ).json();
    assert.equal(
      (
        await request("/verification/check", {
          challenge: challenge.challenge,
          code: "000000",
        })
      ).status,
      400,
    );
    const { verification } = await (
      await request("/verification/check", {
        challenge: challenge.challenge,
        code: challenge.demoCode,
      })
    ).json();
    const image = await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#557766" },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    const form = (buffer = image) => {
      const f = new FormData();
      f.set('payload', JSON.stringify({template:'visited',name:'上传验收地点',regionId:'CN-310109',address:'测试地址',locationMode:'precise',lat:'30',lng:'120',date:'2026-09-01',description:'仅用于自动化验证的地点',consent:true}));
      f.set('photoMetadata',JSON.stringify([{kind:'exterior',caption:'测试外观',rights:'own'}]));
      f.set('verification',verification);
      f.append("photos", new Blob([buffer]), "upload_temp_no_extension");
      return f;
    };
    const invalid = await request(
      "/submissions",
      form(Buffer.from("not an image")),
    );
    assert.equal(invalid.status, 400);
    const submitted = await request("/submissions", form());
    assert.equal(submitted.status, 201);
    const receipt = await submitted.json();
    assert.equal(
      (await (await request("/receipts/" + receipt.receipt)).json()).status,
      "pending",
    );
    assert.deepEqual(await (await request("/places")).json(), []);
    const logged = await request("/login", { name: "Meos", password: "meos" });
    assert.equal(logged.status, 200);
    cookie = logged.headers.get("set-cookie").split(";")[0];
    let desk = await (await request("/admin")).json();
    const p = desk.places[0];
    assert.equal(p.photos.length, 1);
    const photo = p.photos[0].id;
    const imageResult = await request("/photos/" + photo);
    assert.equal(imageResult.status, 200);
    const meta = await sharp(
      Buffer.from(await imageResult.arrayBuffer()),
    ).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(meta.format, "webp");
    const adminCookie = cookie;
    cookie = "";
    assert.equal((await request("/photos/" + photo)).status, 404);
    cookie = adminCookie;
    assert.equal(
      (await request("/admin/places/" + p.id, { status: "approved", version:1, reason:"资料已经核实" })).status,
      200,
    );
    cookie = "";
    assert.equal((await request("/photos/" + photo)).status, 200);
    assert.equal(
      (await request("/places/" + p.id + "/reviews", { text: "不应允许" }))
        .status,
      401,
    );
    cookie = adminCookie;
    const review = {
      scenery: 5,
      cleanliness: 4,
      access: 3,
      facilities: 4,
      text: "现场体验不错",
      date: "2026-09-01",
    };
    assert.equal(
      (await request("/places/" + p.id + "/reviews", review)).status,
      200,
    );
    assert.equal(
      (await (await request("/places/" + p.id + "/reviews")).json()).length,
      0,
    );
    await request("/places/" + p.id + "/reviews", {
      ...review,
      text: "更新后的评价",
    });
    desk = await (await request("/admin")).json();
    assert.equal(desk.reviews.length, 1);
    await request("/admin/reviews/" + desk.reviews[0].id, {
      status: "approved", reason:"评价符合规则",
    });
    const list = await (await request("/places")).json();
    assert.equal(list[0].scores.overall.count, 1);
    assert.equal(list[0].scores.overall.rank, null);
    await request("/places/" + p.id + "/reports", {
      reason: "此位置需要进行纠错",
    });
    desk = await (await request("/admin")).json();
    assert.equal(desk.reports.length, 1);
    await request("/admin/reports/" + desk.reports[0].id, {
      status: "resolved", reason:"问题已处理完成",
    });
    await request("/admin/places/" + p.id, { status: "rejected", version:2, reason:"位置需再次核实", internalNote:"仅限内部" });
    cookie = "";
    assert.equal((await request("/photos/" + photo)).status, 404);
    const db = new DatabaseSync(path.join(dir, "bilabang.sqlite"));
    db.prepare("DELETE FROM users WHERE name=?").run("Meos");
    db.close();
    const registrationChallenge=await (await request("/verification/send",{phone:"13800000000",purpose:"register"})).json();
    const checked=await (await request("/verification/check",{challenge:registrationChallenge.challenge,code:registrationChallenge.demoCode})).json();
    const registered = await request("/register", {
      name: "Meos",
      password: "meos",
      verification:checked.verification,
    });
    assert.equal(registered.status, 200);
    const member = await registered.json();
    assert.equal(member.role, "member");
    cookie = registered.headers.get("set-cookie").split(";")[0];
    assert.equal((await request("/admin")).status, 403);
    await request("/logout", {});
    assert.equal(await (await request("/me")).json(), null);
  } finally {
    await stop(child);
    await rm(dir, { recursive: true, force: true });
  }
});
test("compiled site runs with production identity gate closed", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bilabang-prod-"));
  const { child, url } = await start(dir, true);
  try {
    assert.equal((await fetch(url)).status, 200);
    assert.deepEqual(await (await fetch(url + "/api/config")).json(), {
      demo: false,
      writeEnabled: false,
    });
    for (const p of [
      "/login",
      "/register",
      "/verification/send",
      "/submissions",
    ])
      assert.equal(
        (
          await fetch(url + "/api" + p, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
        503,
      );
    assert.deepEqual(await (await fetch(url + "/api/places")).json(), []);
  } finally {
    await stop(child);
    await rm(dir, { recursive: true, force: true });
  }
});
