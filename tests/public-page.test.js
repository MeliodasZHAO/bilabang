import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPublicPage,siteOrigin,sitemap} from '../server-public.js';
const template=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('HTML exposes public content without JavaScript and escapes submitted text in body and metadata',()=>{
 const html=renderPublicPage(template,{place:{id:'a&b',name:'<script>alert(1)</script>',description:'" onload="alert(1)',address:'<img src=x onerror=alert(1)>',locationMode:'text',sourceUrl:'javascript:alert(1)'},origin:'https://example.com',indexable:true});
 assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>alert(1)</script>'));
 assert.ok(!html.includes('href="javascript:'));
 assert.ok(html.includes('https://example.com/?place=a%26b'));
 assert.ok(html.includes('<h2>位置与找路</h2>'));
});
test('local or unavailable pages cannot claim indexability; origin never derives from request host',()=>{
 assert.ok(renderPublicPage(template,{missing:true,indexable:true,origin:'https://example.com'}).includes('noindex,nofollow'));
 assert.ok(renderPublicPage(template,{}).includes('noindex,nofollow'));
 assert.equal(siteOrigin('https://example.com/'),'https://example.com');
 for(const url of ['http://example.com','https://user:pass@example.com','https://example.com/path'])assert.throws(()=>siteOrigin(url));
 assert.ok(sitemap([{id:'a&b'}],'https://example.com').includes('place=a%26b'));
});
