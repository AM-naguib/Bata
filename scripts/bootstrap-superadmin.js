'use strict';
const {hashPassword,validPassword}=require('../lib/passwords');
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(config) {
 if(!config||typeof config.email!=='string'||!EMAIL.test(config.email.trim())||config.email.length>254)
   throw Error('A valid INIT_ADMIN_EMAIL is required');
 if(typeof config.name!=='string'||!config.name.trim()||config.name.trim().length>120)
   throw Error('INIT_ADMIN_NAME is required (max 120 characters)');
 if(!validPassword(config.password))
   throw Error('A strong INIT_ADMIN_PASSWORD is required (at least 12 UTF-8 bytes)');
}
async function bootstrap(pool,config) {
 validate(config);
 const passwordHash=await hashPassword(config.password);
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const existing=await client.query("SELECT id FROM app_users WHERE role='superadmin' LIMIT 1");
  if(existing.rows.length)throw Error('A superadmin already exists: refusing to create another');
  const created=await client.query(
    "INSERT INTO app_users(email,display_name,role,password_hash) VALUES ($1,$2,'superadmin',$3) RETURNING id",
    [config.email.trim().toLowerCase(),config.name.trim(),passwordHash]
  );
  const id=created.rows[0].id;
  await client.query(
    "INSERT INTO audit_events(actor_id,action,target_type,target_id) VALUES($1,'superadmin.bootstrap','app_user',$2)",
    [id,id]
  );
  await client.query('COMMIT');
  return id;
 } catch(err) {
  await client.query('ROLLBACK');
  throw err;
 } finally {client.release()}
}

async function main() {
 const url=process.env.DATABASE_URL;
 if(!url||!/^postgres(?:ql)?:\/\//.test(url))throw Error('DATABASE_URL (Neon connection string) required');
 // pg is loaded ONLY for explicit command invocation (not normal Node tests).
 const {Pool}=require('pg');
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:10000});
 try {
  const id=await bootstrap(pool,{
    email:process.env.INIT_ADMIN_EMAIL,name:process.env.INIT_ADMIN_NAME,password:process.env.INIT_ADMIN_PASSWORD
  });
  console.log('Superadmin created successfully (ID: '+id+'). Remove INIT_ADMIN_PASSWORD from shell/env.');
 } finally {await pool.end()}
}
if(require.main===module)main().catch(e=>{
 // Never log configuration values, password hashes or connection strings.
 console.error('Superadmin setup failed: '+(e.code==='23505'?'Account already exists':e.message.replace(/password/ig,'credential')));
 process.exitCode=1;
});
module.exports={bootstrap,validate};
