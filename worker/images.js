// Browser uploads are normalized to JPEG; reject metadata-bearing originals at the boundary.
export function validateJpeg(bytes){
 if(bytes.length<10||bytes.length>8*1024*1024||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error('请重新选择照片，上传格式需为处理后的 JPEG');
 let i=2,dimensions=false;
 while(i+3<bytes.length){
  if(bytes[i++]!==255)throw new Error('照片文件损坏');
  while(bytes[i]===255)i++;
  const marker=bytes[i++];
  if(marker===218){if(!dimensions)throw new Error('无法识别照片尺寸');return;}
  const length=(bytes[i]<<8)|bytes[i+1];
  if(length<2||i+length>bytes.length)throw new Error('照片文件损坏');
  if([225,237,254].includes(marker))throw new Error('照片含位置或备注元数据，请重新选择后上传');
  if([192,193,194].includes(marker)){
   const h=(bytes[i+3]<<8)|bytes[i+4],w=(bytes[i+5]<<8)|bytes[i+6];
   if(!w||!h||w*h>16000000||w>5000||h>5000)throw new Error('照片尺寸过大');dimensions=true;
  }
  i+=length;
 }
 throw new Error('照片文件损坏');
}
