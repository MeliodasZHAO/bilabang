// Public routing information only. Never put tokens or credentials in VITE_*.
export const apiOrigin=(import.meta.env?.VITE_API_ORIGIN||'').replace(/\/$/,'');
export const sitesIdentityEnabled=import.meta.env?.MODE!=='edgeone';
export function apiUrl(path,origin=apiOrigin){
 if(!path.startsWith('/api/'))throw new Error('API path must start with /api/');
 return origin+path;
}
