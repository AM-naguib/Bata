'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validateRoster,loadRoster,importRoster}=require('../scripts/import-roster');
const doc='b84d2fee-7a80-43ad-882a-8e6ca3eaeace';
const course='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1';
const synthetic=[
 {id:'0072',name:'مريم أحمد حسن'},
 {id:'0073',name:'سارة علي'}
];
test('private JSON validator preserves leading zeros and rejects duplicated/broken rosters',()=>{
 const data=validateRoster(synthetic);
 assert.deepEqual(data[0],{roll:'0072',name:'مريم أحمد حسن'});
 assert.throws(()=>validateRoster([{id:'01',name:'X'},{id:'01',name:'Y'}]),/Duplicate/);
 assert.throws(()=>validateRoster([{id:'01'}]),/Invalid/);
 assert.throws(()=>validateRoster([{id:'',name:'X'}]),/Invalid/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bata-private-'));
 try{
  const file=path.join(dir,'private-roster.json');fs.writeFileSync(file,JSON.stringify(synthetic));
  assert.deepEqual(loadRoster(file),data);
  assert.throws(()=>loadRoster('relative.json'),/absolute/);
 }finally{fs.rmSync(dir,{force:true,recursive:true})}
});
test('private import is a single transaction, checks actual lecturer assignment and logs counts not names',async()=>{
 const seen=[],students=new Map();
 const query=async(sql,p=[])=>{
  seen.push({sql,p});
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql.includes('FROM app_users u JOIN lecturer_courses'))return {rows:[{ok:1}]};
  if(sql.startsWith('INSERT INTO students(')){
   const row={id:p[0]==='0072'?'13823c35-164a-4c08-bb88-3256f584116a':'31ca620d-4d43-4adc-90fa-9b52699eebc4',full_name:p[1]};
   if(students.has(p[0]))return {rows:[]};students.set(p[0],row);return {rows:[row]};
  }
  if(sql.startsWith('SELECT id,full_name FROM students'))return {rows:[students.get(p[0])]};
  if(sql.startsWith('INSERT INTO enrollments('))return {rows:[{student_id:p[0]}]};
  if(sql.startsWith('INSERT INTO audit_events('))return {rows:[]};
  throw Error('Unknown SQL '+sql);
 };
 let released=false;const pool={connect:async()=>({query,release:()=>{released=true}})};
 const result=await importRoster(pool,{lecturerId:doc,courseId:course,rows:validateRoster(synthetic)});
 assert.equal(result.count,2);assert.equal(released,true);
 assert.equal(seen[0].sql,'BEGIN');assert.ok(seen.some(s=>s.sql==='COMMIT'));
 assert.ok(seen.some(s=>s.sql.includes('FROM app_users u JOIN lecturer_courses')));
 assert.ok(seen.some(s=>s.sql.includes('enrollment.private_import')));
 assert.ok(!seen.some(s=>s.sql.includes('DELETE FROM attendances')));
 const audit=seen.find(s=>s.sql.includes('enrollment.private_import'));
 assert.equal(audit.p[0],doc);assert.equal(audit.p[1],course);
 assert.equal(JSON.parse(audit.p[2]).count,2);
});
test('import refuses missing permission and transaction rolls back without writing roster',async()=>{
 const seen=[];
 const pool={connect:async()=>({query:async(sql)=>{
  seen.push(sql);
  if(sql.includes('FROM app_users u JOIN lecturer_courses'))return {rows:[]};
  return {rows:[]};
 },release(){}})};
 await assert.rejects(importRoster(pool,{lecturerId:doc,courseId:course,rows:validateRoster(synthetic)}),/active course assignment/);
 assert.ok(seen.includes('ROLLBACK'));assert.ok(!seen.some(x=>x.includes('INSERT INTO students')));
});
test('import encounters conflicting name, rolls back instead of overwriting global roster',async()=>{
 const calls=[];
 const pool={connect:async()=>({query:async(sql)=>{
  calls.push(sql);
  if(sql.includes('FROM app_users u JOIN lecturer_courses'))return {rows:[{ok:1}]};
  if(sql.startsWith('INSERT INTO students('))return {rows:[]};
  if(sql.startsWith('SELECT id,full_name FROM students'))return {rows:[{id:'old-id',full_name:'DIFFERENT NAME'}]};
  return {rows:[]};
 },release(){}})};
 await assert.rejects(importRoster(pool,{lecturerId:doc,courseId:course,rows:validateRoster(synthetic)}),/Conflicting/);
 assert.ok(calls.includes('ROLLBACK'));
 assert.ok(!calls.some(x=>x.includes('INSERT INTO enrollments')));
});
