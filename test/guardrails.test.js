const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname,'..');
const pass = 'test-only-strong-password';
function fixture(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bata-test-'));
  fs.copyFileSync(path.join(root, 'server.js'), path.join(dir, 'server.js'));
  fs.mkdirSync(path.join(dir, 'public'));
  fs.copyFileSync(path.join(root, 'public/doctor.html'), path.join(dir, 'public/doctor.html'));
  fs.writeFileSync(path.join(dir, 'students.json'), JSON.stringify([{id:'TEST01',name:'Test Student'}]));
  if (data !== undefined) fs.writeFileSync(path.join(dir, 'data.json'), data);
  return dir;
}
function cleanup(dir) { fs.rmSync(dir, {recursive:true, force:true}); }
test('refuses default admin password', () => {
  const dir=fixture();
  try {
    const r=spawnSync(process.execPath,['server.js'], {cwd:dir,env:{...process.env,DOCTOR_PASSWORD:'1234'},encoding:'utf8',timeout:1500});
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/DOCTOR_PASSWORD/);
  } finally {cleanup(dir)}
});
test('corrupt attendance records are preserved and startup fails', () => {
  const dir=fixture('{invalid JSON');
  try {
    const r=spawnSync(process.execPath,['server.js'], {cwd:dir,env:{...process.env,DOCTOR_PASSWORD:pass},encoding:'utf8',timeout:1500});
    assert.notEqual(r.status,0);
    assert.equal(fs.readFileSync(path.join(dir,'data.json'),'utf8'),'{invalid JSON');
  } finally {cleanup(dir)}
});
test('validates GPS and revokes logout session; GET cannot close lecture',async()=>{
  const dir=fixture(),port=12000+Math.floor(Math.random()*30000);
  const child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,DOCTOR_PASSWORD:pass,PORT:String(port)},stdio:'ignore'});
  const base='http://127.0.0.1:'+port;
  const call=async(p,method,body,cookie)=>{
    const r=await fetch(base+p,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,cookie:r.headers.get('set-cookie'),data:await r.json()};
  };
  try {
    let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/doctor')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,30))} assert.ok(ready);
    const l=await call('/api/login','POST',{password:pass});assert.equal(l.status,200);const cookie=l.cookie.split(';')[0];
    const a=await call('/api/lectures','POST',{title:'Synthetic',lat:30,lng:31},cookie);assert.equal(a.status,200);
    const id=a.data.id,t=(await call('/api/lectures/'+id+'/live','GET',undefined,cookie)).data.token;
    const attendance={token:t,studentId:'TEST01',deviceId:'test-device',lat:30,lng:31};
    for(const accuracy of [undefined,-1,0,null,151]){
      const r=await call('/api/attend','POST',{...attendance,accuracy});assert.equal(r.status,400);
    }
    assert.equal((await call('/api/lectures/'+id+'/close','GET',undefined,cookie)).status,405);
    assert.equal((await call('/api/lectures/'+id+'/live','GET',undefined,cookie)).data.open,true);
    assert.equal((await call('/api/attend','POST',{...attendance,accuracy:10})).status,200);
    assert.equal((await call('/api/logout','POST',{},cookie)).status,200);
    assert.equal((await call('/api/lectures','GET',undefined,cookie)).status,401);
  } finally {child.kill();cleanup(dir)}
});
