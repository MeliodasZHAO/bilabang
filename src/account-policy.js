export const accountPolicyVersion = '2026-09-09.1';
export const commentCooldownSeconds = 30;
export const supportEmail = '695325137@qq.com';
export const agreementLinks = [
  {href:'/terms',label:'服务协议'},
  {href:'/privacy',label:'隐私说明'},
  {href:'/rules',label:'社区规则'},
];

const commonPasswords = new Set(['12345678','123456789','1234567890','12345678910','12345678901','87654321','password','password1','password123','password123!','qwertyui','qwertyuiop','qwerty123','qwerty123456','11111111','00000000','88888888','abcd1234','abc12345','abc123456','admin123','admin123456','iloveyou','welcome123','letmein123']);
export function registrationPasswordError(password,name='') {
  if(typeof password!=='string'||password.length<8||password.length>128)return '密码需为 8–128 位，可使用较长的短语';
  const value=password.normalize('NFKC').toLowerCase();
  const account=name.normalize('NFKC').trim().toLowerCase();
  if(commonPasswords.has(value)||/^(.)\1+$/u.test(value)||!value.trim()||account&&[account,account+'123',account+'123456'].includes(value))return '这个密码容易被猜到，请换用独立的密码或短语';
  return '';
}
