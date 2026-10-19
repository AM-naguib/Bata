const test=require('node:test');
const assert=require('node:assert/strict');
const {bootstrap,validate}=require('../scripts/bootstrap-superadmin');
const data={email:'boss@example.test',name:'أدمن تجريبي',password:'very-long-private-test-password'};
test('bootstrap validates private credentials and never allows weak password',()=>{
 assert.throws(()=>validate({...data,password:'1234'}));
 assert.throws(()=>validate({...data,email:'bad'}));
 assert.throws(()=>validate({...data,name:''}));
 assert.doesNotThrow(()=>validate(data));
});
test('bootstrap inserts exactly one superadmin with a hashed secret and audit event',async()=>{
 const calls=[];
 const client={
  query:async(sql,args=[])=>{
   calls.push({sql,args});
   if(sql.startsWith('SELECT'))return {rows:[]};
   if(sql.startsWith('INSERT INTO app_users'))return {rows:[{id:'new-id'}]};
   return {rows:[]};
  },release:()=>{calls.push({sql:'release'})}
 };
 const created=await bootstrap({connect:async()=>client},data);
 assert.equal(created,'new-id');
 assert.equal(calls[0].sql,'BEGIN');
 const insertion=calls.find(c=>c.sql.startsWith('INSERT INTO app_users'));
 assert.ok(insertion);assert.equal(insertion.args[0],data.email);
 assert.ok(insertion.args[2].startsWith('scrypt:v1:'));
 assert.ok(!JSON.stringify(calls).includes(data.password));
 assert.ok(calls.some(c=>c.sql.startsWith('INSERT INTO audit_events')));
 assert.ok(calls.some(c=>c.sql==='COMMIT'));
 assert.ok(calls.some(c=>c.sql==='release'));
});
test('bootstrap rolls back instead of overwriting existing superadmin',async()=>{
 const calls=[];
 const client={
  query:async(sql,args=[])=>{calls.push(sql);
    if(sql.startsWith('SELECT'))return {rows:[{id:'already-exists'}]};
    return {rows:[]};
  },release:()=>calls.push('release')
 };
 await assert.rejects(bootstrap({connect:async()=>client},data),/already exists/);
 assert.ok(calls.includes('ROLLBACK'));
 assert.ok(!calls.some(c=>c.startsWith('INSERT')));
});
