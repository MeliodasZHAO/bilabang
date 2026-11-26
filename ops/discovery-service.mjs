import { createReadStream, realpathSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { createGunzip } from 'node:zlib';

const week = 7 * 86400;
const halfLife = 2 * 86400;
const idPattern = /^[a-f0-9]{32}$/;
const trimRegion = value => value.replace(/(?:维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/, '');

export async function readTrending(logDir, allowed, now = Date.now() / 1000) {
  const signals = new Map();
  for (const file of await readdir(logDir)) {
    if (!/^bilabang-traffic(?:-[\w.-]+)?\.jsonl(?:\.gz)?$/.test(file)) continue;
    const path = join(logDir, file);
    try {
      if ((await stat(path)).mtimeMs / 1000 < now - week) continue;
      const stream = createReadStream(path);
      const input = file.endsWith('.gz') ? stream.pipe(createGunzip()) : stream;
      if (input !== stream) stream.on('error', error => input.destroy(error));
      for await (const row of createInterface({ input, crlfDelay: Infinity })) {
        let event;
        try { event = JSON.parse(row); } catch { continue; }
        if (event?.mode !== 'live' || event.status !== 204 || event.event !== 'detail_view' ||
          event.surface !== 'editorial-detail' || !allowed.has(event.stop) || !idPattern.test(event.visitor) ||
          !Number.isFinite(event.ts) || event.ts < now - week || event.ts > now) continue;
        if (!signals.has(event.stop)) signals.set(event.stop, new Map());
        const visitors = signals.get(event.stop);
        if (visitors.size < 4096 || visitors.has(event.visitor)) {
          visitors.set(event.visitor, Math.max(visitors.get(event.visitor) || 0, event.ts));
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return [...signals.entries()].filter(([, visitors]) => visitors.size >= 3)
    .map(([stop, visitors]) => {
      const score = [...visitors.values()].reduce((sum, ts) => sum + 2 ** (-(now - ts) / halfLife), 0);
      return { stop, score };
    }).sort((a, b) => b.score - a.score || a.stop.localeCompare(b.stop)).map(({ stop }) => stop);
}

export function catalogRegion(raw, allowedRegions) {
  const [, province, city, , country] = raw.split('|');
  if (country !== 'CN' || !province) return null;
  const area = trimRegion(province);
  const locality = trimRegion(city || '');
  if (!allowedRegions.has(area)) return null;
  return { province: area, city: allowedRegions.get(area).has(locality) ? locality : '' };
}

export async function startDiscovery(bundle, logDir, port) {
  const binding = await import(new URL('./ip2region/index.js', import.meta.url).href);
  const { IPv4, IPv6, loadContentFromFile, newWithBuffer, verifyFromFile } = binding;
  const searchers = new Map([IPv4, IPv6].map((version, index) => {
    const file = join(bundle, `ip2region_v${index ? 6 : 4}.xdb`);
    verifyFromFile(file);
    return [index ? 6 : 4, newWithBuffer(version, loadContentFromFile(file))];
  }));
  const { records } = JSON.parse(await readFile(join(bundle, 'editorial-places.json'), 'utf8'));
  const allowed = new Set(records.map(place => place.id));
  const allowedRegions = new Map();
  for (const { province, city } of records) {
    if (!allowedRegions.has(province)) allowedRegions.set(province, new Set());
    allowedRegions.get(province).add(city);
  }
  let trending = [];
  async function refresh() {
    try { trending = await readTrending(logDir, allowed); } catch { console.error('Discovery heat refresh failed'); }
    setTimeout(refresh, 10 * 60 * 1000).unref();
  }
  void refresh();
  const server = createServer({ requestTimeout: 5000, headersTimeout: 5000 }, async (request, response) => {
    if (request.method !== 'GET' || request.url?.split('?')[0] !== '/_discover') {
      response.writeHead(404).end();
      return;
    }
    let region = null;
    if (request.headers['x-bilabang-geo'] === '1') {
      const ip = String(request.headers['x-bilabang-client-ip'] || '').replace(/^::ffff:/i, '');
      const searcher = searchers.get(isIP(ip));
      if (searcher) {
        try { region = catalogRegion(await searcher.search(ip), allowedRegions); } catch { /* National fallback */ }
      }
    }
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' });
    response.end(JSON.stringify({ region, trending }));
  });
  server.listen(port, '127.0.0.1');
  return server;
}

if (process.argv[1] && process.argv[2] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await startDiscovery(process.argv[2], process.argv[3] || '/var/log/caddy', Number(process.argv[4] || '5198'));
}
