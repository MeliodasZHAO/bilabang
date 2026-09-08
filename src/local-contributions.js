export function readReceipts(storage=localStorage){
 try{const raw=storage.getItem('bilabang-receipts-v1')||'[]',rows=JSON.parse(raw);const recent=Array.isArray(rows)?rows.filter(r=>typeof r.token==='string'&&/^[a-f0-9]{36}$/.test(r.token)&&typeof r.name==='string'&&Number.isFinite(r.savedAt)&&Date.now()-r.savedAt<30*86400000).slice(0,30):[];
 const cleaned=JSON.stringify(recent);if(cleaned!==raw)try{storage.setItem('bilabang-receipts-v1',cleaned);}catch{}return recent;
 }catch{return [];}
}
export function saveReceipt(result,name,storage=localStorage){const rows=readReceipts(storage).filter(r=>r.token!==result.receipt);storage.setItem('bilabang-receipts-v1',JSON.stringify([{token:result.receipt,name:String(name).slice(0,200),savedAt:Date.now()},...rows].slice(0,30)));}
export function forgetReceipts(storage=localStorage){storage.removeItem('bilabang-receipts-v1');}
function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open('bilabang-local-drafts',1);req.onupgradeneeded=()=>req.result.createObjectStore('photos');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('草稿存储被其他窗口占用'));});}
async function transaction(key,mode,value){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('photos',mode),store=tx.objectStore('photos');const req=mode==='readonly'?store.get(key):value===null?store.delete(key):store.put(value,key);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('草稿保存中断'));});}finally{db.close();}}
export const readDraftPhotos=key=>transaction(key,'readonly');
export const writeDraftPhotos=(key,photos)=>transaction(key,'readwrite',photos.map(({url,...p})=>p));
export const deleteDraftPhotos=key=>transaction(key,'readwrite',null);
