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
  fs.copyFileSync(path.join(root, 'public/student.html'), path.join(dir, 'public/student.html'));
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
    const a=await call('/api/lectures','POST',{title:'Synthetic',lecturerName:'Test Doctor',courseName:'Test Course',lat:30,lng:31},cookie);assert.equal(a.status,200);
    const roster=await call('/api/lectures','GET',undefined,cookie);
    assert.equal(roster.data[0].lecturerName,'Test Doctor');assert.equal(roster.data[0].courseName,'Test Course');
    const studentPage=await fetch(base+'/');assert.equal(studentPage.status,200);
    assert.match(await studentPage.text(),/تعديل \/ تغيير رقم الجلوس/);
    const id=a.data.id,live=(await call('/api/lectures/'+id+'/live','GET',undefined,cookie)).data;
    assert.equal(live.lecturerName,'Test Doctor');assert.equal(live.courseName,'Test Course');
    const rep=(await call('/api/report','GET',undefined,cookie)).data;
    assert.equal(rep.lectures[0].courseName,'Test Course');
    const csv=await fetch(base+'/api/report.csv',{headers:{cookie}});
    assert.equal(csv.status,200);assert.match(await csv.text(),/Test Course/);
    const t=live.token;
    const attendance={token:t,studentId:'TEST01',deviceId:'test-device',lat:30,lng:31};
    for(const accuracy of [undefined,-1,0,null,151]){
      const r=await call('/api/attend','POST',{...attendance,accuracy});assert.equal(r.status,400);
    }
    assert.equal((await call('/api/lectures/'+id+'/close','GET',undefined,cookie)).status,405);
    assert.equal((await call('/api/lectures/'+id+'/live','GET',undefined,cookie)).data.open,true);
    const success=await call('/api/attend','POST',{...attendance,accuracy:10});
    assert.equal(success.status,200);assert.equal(success.data.studentName,'Test Student');
    const duplicated=await call('/api/attend','POST',{...attendance,accuracy:10});assert.equal(duplicated.data.studentName,'Test Student');
    const blocked=await call('/api/lectures/'+id+'/delete','POST',{},cookie);
    assert.equal(blocked.status,409,'never discard recorded attendance');
    const mistaken=await call('/api/lectures','POST',{title:'Accidental Lecture',courseName:'Test Course',lecturerName:'Test Doctor',lat:30,lng:31},cookie);
    assert.equal(mistaken.status,200);
    const mistakenId=mistaken.data.id;
    assert.equal((await call('/api/lectures/'+mistakenId+'/delete','GET',undefined,cookie)).status,404);
    const archived=await call('/api/lectures/'+mistakenId+'/delete','POST',{},cookie);
    assert.equal(archived.status,200);
    const listed=(await call('/api/lectures','GET',undefined,cookie)).data;
    assert.equal(listed.some(l=>l.id===mistakenId),false);
    const deleted=(await call('/api/lectures/deleted','GET',undefined,cookie)).data;
    assert.equal(deleted.some(l=>l.id===mistakenId),true);
    const reportWithout=(await call('/api/report','GET',undefined,cookie)).data;
    assert.equal(reportWithout.lectures.some(l=>l.id===mistakenId),false);
    assert.equal((await call('/api/lectures/'+mistakenId+'/live','GET',undefined,cookie)).status,404);
    assert.equal((await call('/api/lectures/'+mistakenId+'/restore','POST',{},cookie)).status,200);
    const reportRestored=(await call('/api/report','GET',undefined,cookie)).data;
    assert.equal(reportRestored.lectures.some(l=>l.id===mistakenId),true);
    assert.equal((await call('/api/lectures/'+mistakenId+'/live','GET',undefined,cookie)).data.open,false);
    assert.equal((await call('/api/logout','POST',{},cookie)).status,200);
    assert.equal((await call('/api/lectures','GET',undefined,cookie)).status,401);
  } finally {child.kill();cleanup(dir)}
});
