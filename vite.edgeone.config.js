import {defineConfig,loadEnv} from 'vite';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'VITE_');
 const value=process.env.VITE_API_ORIGIN||env.VITE_API_ORIGIN;
 let origin;try{origin=new URL(value);}catch{throw new Error('Set VITE_API_ORIGIN to the HTTPS origin of the Hong Kong backend before building.');}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||/^(localhost|127\.|0\.|\[::1\])/.test(origin.hostname)||/\.(localhost|local|chatgpt\.site)$/.test(origin.hostname))throw new Error('VITE_API_ORIGIN must be an independent HTTPS origin, without credentials, path, or a Sites/localhost address.');
 return {build:{outDir:'dist/edgeone',emptyOutDir:true}};
});
