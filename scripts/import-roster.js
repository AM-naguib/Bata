'use strict';
// One-off PRIVATE roster import. Explicit --apply is required for database writes.
// NEVER commit the real JSON roster, DATABASE_URL, or output student names to CI/logs.
const fs=require('node:fs');
const path=require('node:path');
const {normalizeSeatNumber,normalizeStudentName}=require('../lib/student-identity');
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
function fail(message){throw Error(message)}
function validateRoster(raw){
 if(!Array.isArray(raw)||raw.length===0||raw.length>10000)fail('Roster must be a non-empty array of at most 10000');
 const seen=new Set();
 return raw.map(row=>{
  const roll=normalizeSeatNumber(row?.id??row?.roll_number??row?.studentId);
  const name=normalizeStudentName(row?.name??row?.full_name??row?.studentName);
  if(!roll||roll.length>64||!name||name.length>200||/[\x00-\x1f\x7f]/.test(roll)||/[\x00-\x1f\x7f]/.test(name))
   fail('Invalid student record; inspect private source file');
  if(seen.has(roll))fail('Duplicate roll number in private source');
  seen.add(roll);
  return {roll,name};
 });
}
function loadRoster(filename){
 if(typeof filename!=='string'||!path.isAbsolute(filename))
  fail('IMPORT_FILE must be an absolute path to a PRIVATE JSON file');
 const st=fs.statSync(filename);
 if(!st.isFile()||st.size>2*1024*1024)fail('Invalid or oversized private roster file');
 return validateRoster(JSON.parse(fs.readFileSync(filename,'utf8')));
}
async function importRoster(pool,{lecturerId,courseId,rows}){
 if(!UUID.test(lecturerId||'')||!UUID.test(courseId||''))fail('Valid lecturer and course UUIDs required');
 if(!Array.isArray(rows)||rows.length===0)fail('Validated roster required');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  // A verified active lecturer-course assignment is required. This locks the assignment
  // so it cannot be revoked mid-import. Superadmin cannot import students this way.
  const allowed=await client.query(
   "SELECT 1 FROM app_users u JOIN lecturer_courses lc ON lc.lecturer_id=u.id JOIN courses c ON c.id=lc.course_id WHERE u.id=$1 AND u.role='lecturer' AND u.disabled_at IS NULL AND u.must_change_password=false AND lc.course_id=$2 AND lc.unassigned_at IS NULL AND c.archived_at IS NULL FOR SHARE OF lc",
   [lecturerId,courseId]
  );
  if(!allowed.rows.length)fail('Lecturer has no active course assignment');
  let added=0;
  for(const {roll,name} of rows){
   const created=await client.query(
    'INSERT INTO students(roll_number,full_name) VALUES($1,$2) ON CONFLICT (roll_number) DO NOTHING RETURNING id,full_name',
    [roll,name]
   );
   let student=created.rows[0];
   if(!student){
    const previous=await client.query('SELECT id,full_name FROM students WHERE roll_number=$1 FOR UPDATE',[roll]);
    student=previous.rows[0];
   }
   if(!student||normalizeStudentName(student.full_name)!==name)fail('Conflicting student record: no changes applied');
   const result=await client.query(
    'INSERT INTO enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT (student_id,course_id) DO UPDATE SET removed_at=NULL RETURNING student_id',
    [student.id,courseId]
   );
   if(!result.rows.length)fail('Enrollment write failed');
   added++;
  }
  await client.query(
   "INSERT INTO audit_events(actor_id,action,target_type,target_id,detail) VALUES($1,'enrollment.private_import','course',$2,$3::jsonb)",
   [lecturerId,courseId,JSON.stringify({count:added})]
  );
  await client.query('COMMIT');
  return {count:added};
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
async function main(){
 const records=loadRoster(process.env.IMPORT_FILE);
 if(!process.argv.includes('--apply')){
  console.log('Private roster validated: '+records.length+' records. Dry run only; NO database writes.');
  console.log('Set IMPORT_COURSE_ID and IMPORT_LECTURER_ID and pass --apply only after course assignment has been verified.');
  return;
 }
 if(!process.env.DATABASE_URL)fail('DATABASE_URL missing');
 const {Pool}=require('pg');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
 try{
  const result=await importRoster(pool,{lecturerId:process.env.IMPORT_LECTURER_ID,courseId:process.env.IMPORT_COURSE_ID,rows:records});
  console.log('Private course roster imported: '+result.count+' entries. No student names printed.');
 }finally{await pool.end()}
}
if(require.main===module)main().catch(e=>{
 console.error('Private roster import FAILED; transaction rolled back. Check file/role/course settings privately.');
 process.exitCode=1;
});
module.exports={validateRoster,loadRoster,importRoster};
