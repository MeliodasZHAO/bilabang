export const statement=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
export const first=(env,sql,...values)=>statement(env,sql,...values).first();
export const rows=async(env,sql,...values)=>(await statement(env,sql,...values).all()).results;
export const run=(env,sql,...values)=>statement(env,sql,...values).run();
