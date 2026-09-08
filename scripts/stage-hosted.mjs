import fs from 'node:fs/promises';
const target='output/hosted-package-'+Date.now();
await fs.mkdir(target+'/dist',{recursive:true});
await fs.cp('.openai',target+'/.openai',{recursive:true});
for(const dir of ['client','server','.openai'])await fs.cp('dist/'+dir,target+'/dist/'+dir,{recursive:true});
console.log(target);
