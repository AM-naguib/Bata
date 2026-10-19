'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {reportForCourse}=require('../lib/attendance-reports');
const {excelForReport}=require('../lib/report-excel');
const course='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1',otherCourse='b34e9004-c5ae-49b7-8f8e-5f12db50c12a';
const doctor='b84d2fee-7a80-43ad-882a-8e6ca3eaeace';
const s1='13823c35-164a-4c08-bb88-3256f584116a',s2='31ca620d-4d43-4adc-90fa-9b52699eebc4',s3='33cacbee-e61a-44bb-9409-39c96340b0b0';
const l1='a65c14c2-d9ec-4e2b-b289-2d329048fb32',l2='de01fe7b-4de5-4cd6-8ab9-207cdaf1f1fb';
const lecturer={id:doctor,role:'lecturer',must_change_password:false};
const admin={id:'6ac45621-6ff9-4f2c-b9fa-bea77bcd1435',role:'superadmin'};
function fakeDb({lessons=true,assigned=true}={}){
 const queries=[];
 const students=[
  {id:s1,roll_number:'0001',full_name:'آية & <اختبار>',enrolled_at:'2026-01-01T00:00:00Z'},
  {id:s2,roll_number:'0002',full_name:'نور',enrolled_at:'2026-02-01T00:00:00Z'},
  {id:s3,roll_number:'0003',full_name:'مريم',enrolled_at:'2026-01-01T00:00:00Z'}
 ];
 const closed=lessons?[
  {id:l1,title:'الأولى',opened_at:'2026-01-10T08:00:00Z',closed_at:'2026-01-10T10:00:00Z'},
  {id:l2,title:'الثانية',opened_at:'2026-02-10T08:00:00Z',closed_at:'2026-02-10T10:00:00Z'}
 ]:[];
 const rows=lessons?[{student_id:s1,lecture_id:l1},{student_id:s1,lecture_id:l2},{student_id:s2,lecture_id:l2}]:[];
 return {queries,pool:{query:async(sql,p=[])=>{
  queries.push({sql,p});
  if(sql.startsWith('SELECT 1 FROM lecturer_courses'))return {rows:assigned&&p[0]===doctor&&p[1]===course?[{yes:1}]:[]};
  if(sql.startsWith('SELECT id,name FROM courses'))return {rows:[{id:course,name:'المقرر الأول (مؤقت)'}]};
  if(sql.startsWith('SELECT s.id,s.roll_number,s.full_name,e.enrolled_at'))return {rows:students};
  if(sql.startsWith('SELECT id,title,opened_at,closed_at FROM lectures'))return {rows:closed};
  if(sql.startsWith('SELECT a.student_id,a.lecture_id FROM attendances'))return {rows};
  throw Error('Unrecognized query '+sql);
 }}};
}
function zipEntries(buffer){
 const entries={};let offset=0;
 while(buffer.readUInt32LE(offset)===0x04034b50){
  const method=buffer.readUInt16LE(offset+8),compressed=buffer.readUInt32LE(offset+18);
  const pathLength=buffer.readUInt16LE(offset+26),extras=buffer.readUInt16LE(offset+28);
  const name=buffer.subarray(offset+30,offset+30+pathLength).toString('utf8');
  const pos=offset+30+pathLength+extras;
  const packed=buffer.subarray(pos,pos+compressed);
  entries[name]=(method===8?zlib.inflateRawSync(packed):packed).toString('utf8');
  offset=pos+compressed;
 }
 assert.equal(buffer.readUInt32LE(offset),0x02014b50,'ZIP central directory is present');
 return entries;
}
test('closed-only absence: late-joined students are never marked absent before enrolling',async()=>{
 const db=fakeDb(),report=await reportForCourse(db.pool,lecturer,course);
 assert.equal(report.totalStudents,3);assert.equal(report.totalLectures,2);
 assert.deepEqual(report.students.map(s=>[s.rollNumber,s.eligible,s.attended,s.absent,s.percentage]),[
  ['0001',2,2,0,100],['0002',1,1,0,100],['0003',2,0,2,0]
 ]);
 assert.deepEqual(report.students[1].lectureStatuses,['not-enrolled','present']);
 assert.deepEqual(report.lectures.map(l=>[l.eligible,l.present,l.absent]),[[2,1,1],[3,2,1]]);
 assert.ok(db.queries.every(q=>!q.sql.includes('audit_events')));
 assert.ok(db.queries.every(q=>!q.sql.includes('password_hash')));
});
test('no closed lectures means no recorded absence and no misleading percentage',async()=>{
 const db=fakeDb({lessons:false}),report=await reportForCourse(db.pool,lecturer,course);
 assert.equal(report.totalLectures,0);
 assert.ok(report.students.every(x=>x.eligible===0&&x.absent===0&&x.percentage===null));
 const xlsx=excelForReport(report),entry=zipEntries(xlsx);
 assert.match(entry['xl/worksheets/sheet1.xml'],/لا توجد محاضرات مستحقة/);
});
test('report is denied before reading any academic data for admin, unassigned, disabled and forced-password users',async()=>{
 for(const user of [admin,{...lecturer,id:'another-doctor'},
  {...lecturer,must_change_password:true},{...lecturer,disabled_at:'2026-01-01'}]){
  const db=fakeDb();
  await assert.rejects(reportForCourse(db.pool,user,course),e=>e.status===403);
  assert.ok(db.queries.every(q=>!q.sql.includes('SELECT s.id')&&!q.sql.includes('SELECT a.student_id')));
 }
 const no=fakeDb({assigned:false});
 await assert.rejects(reportForCourse(no.pool,lecturer,course),e=>e.status===403);
 assert.equal(no.queries.length,1);
 const bad=fakeDb();
 await assert.rejects(reportForCourse(bad.pool,lecturer,'not-uuid'),e=>e.status===400);
 assert.equal(bad.queries.length,0);
});
test('genuine XLSX has three Arabic worksheets, preserves leading zeros and escapes XML safely',async()=>{
 const report=await reportForCourse(fakeDb().pool,lecturer,course);
 const xlsx=excelForReport(report);
 assert.ok(Buffer.isBuffer(xlsx));assert.equal(xlsx.subarray(0,2).toString(),'PK');
 const entry=zipEntries(xlsx);
 for(const name of ['[Content_Types].xml','_rels/.rels','xl/workbook.xml',
  'xl/styles.xml','xl/_rels/workbook.xml.rels','xl/worksheets/sheet1.xml',
  'xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml'])assert.ok(entry[name],name);
 assert.match(entry['xl/workbook.xml'],/تفاصيل الحضور/);
 assert.match(entry['xl/worksheets/sheet1.xml'],/0001/,'roll numbers not coerced to numbers');
 assert.match(entry['xl/worksheets/sheet1.xml'],/آية &amp; &lt;اختبار&gt;/);
 assert.match(entry['xl/worksheets/sheet1.xml'],/s="2"/,'numeric Excel percentage style');
 assert.match(entry['xl/worksheets/sheet3.xml'],/غير مقيّدة وقتها/);
 assert.ok(xlsx.length>1800,'not a fake CSV renamed as XLSX');
});
