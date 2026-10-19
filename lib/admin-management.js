'use strict';
// Data-access functions for the FUTURE role-aware HTTP API.
// principal must be loaded from a verified DB session, never request JSON.
// This module intentionally contains NO queries against students, lectures, attendances or reports.
const crypto=require('node:crypto');
const {authorize}=require('./permissions');
const {hashPassword}=require('./passwords');
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function denied(result){const e=new Error(result.reason);e.status=result.status;throw e}
async function requireAdmin(principal,action){
 const result=await authorize({principal,action});if(!result.allowed)denied(result);
}
function validateId(id){if(typeof id!=='string'||!UUID.test(id)){const e=new Error('Invalid ID');e.status=400;throw e}}
function fail(message,status=400){const e=new Error(message);e.status=status;throw e}

async function listLecturers(pool,principal){
 await requireAdmin(principal,'lecturer.list');
 const r=await pool.query("SELECT id,email,display_name,disabled_at,created_at FROM app_users WHERE role='lecturer' ORDER BY created_at DESC");
 return r.rows;
}
async function listCourseCatalog(pool,principal){
 await requireAdmin(principal,'course.catalog.list');
 const r=await pool.query('SELECT id,name,code FROM courses WHERE archived_at IS NULL ORDER BY name,id');
 return r.rows;
}
// A catalog entry is administrative metadata, NOT permission to inspect course teaching data.
// The owner approved course *creation only*; edit/archive/delete are deliberately absent.
async function createCourse(pool,principal,{name}={}){
 await requireAdmin(principal,'course.create');
 if(typeof name!=='string')fail('Course name required');
 const cleanName=name.trim();
 if(cleanName.length<1||cleanName.length>150||/[\x00-\x1f\x7f]/.test(cleanName))
   fail('Course name must be 1-150 characters without control codes');
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const created=await client.query(
    'INSERT INTO courses(name,created_by) VALUES($1,$2) RETURNING id,name,code,created_at',
    [cleanName,principal.id]
  );
  await client.query(
    "INSERT INTO audit_events(actor_id,action,target_type,target_id) VALUES($1,'course.create','course',$2)",
    [principal.id,created.rows[0].id]
  );
  await client.query('COMMIT');
  return created.rows[0];
 }catch(e){await client.query('ROLLBACK');throw e}
 finally {client.release()}
}
async function listAssignments(pool,principal){
 await requireAdmin(principal,'assignment.list');
 const r=await pool.query('SELECT lecturer_id,course_id,assigned_at FROM lecturer_courses WHERE unassigned_at IS NULL ORDER BY lecturer_id,course_id');
 return r.rows;
}
async function createLecturer(pool,principal,{email,displayName}={}){
 await requireAdmin(principal,'lecturer.create');
 if(typeof email!=='string'||email.length>254||!EMAIL.test(email.trim()))fail('Valid email required');
 if(typeof displayName!=='string'||!displayName.trim()||displayName.trim().length>120)fail('Valid display name required');
 // One-time temporary password must be displayed ONLY over a secure admin session; no logs.
 const initialPassword=crypto.randomBytes(24).toString('base64url');
 const passwordHash=await hashPassword(initialPassword);
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const created=await client.query(
    "INSERT INTO app_users(email,display_name,role,password_hash,must_change_password) VALUES ($1,$2,'lecturer',$3,true) RETURNING id,email,display_name",
    [email.trim().toLowerCase(),displayName.trim(),passwordHash]
  );
  await client.query("INSERT INTO audit_events(actor_id,action,target_type,target_id) VALUES($1,'lecturer.create','app_user',$2)",
    [principal.id,created.rows[0].id]);
  await client.query('COMMIT');
  return {...created.rows[0],initialPassword};
 }catch(e){await client.query('ROLLBACK');if(e.code==='23505')fail('Email already exists',409);throw e}
 finally {client.release()}
}
async function assignCourse(pool,principal,{lecturerId,courseId}={}){
 await requireAdmin(principal,'assignment.grant');
 validateId(lecturerId);validateId(courseId);
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const lecturer=await client.query("SELECT id FROM app_users WHERE id=$1 AND role='lecturer' AND disabled_at IS NULL FOR UPDATE",[lecturerId]);
  if(!lecturer.rows.length)fail('Lecturer not found',404);
  const course=await client.query('SELECT id FROM courses WHERE id=$1 AND archived_at IS NULL FOR UPDATE',[courseId]);
  if(!course.rows.length)fail('Course not found',404);
  await client.query('INSERT INTO lecturer_courses(lecturer_id,course_id,assigned_by,unassigned_at) VALUES($1,$2,$3,NULL) ON CONFLICT (lecturer_id,course_id) DO UPDATE SET assigned_by=EXCLUDED.assigned_by,assigned_at=now(),unassigned_at=NULL',
    [lecturerId,courseId,principal.id]);
  await client.query("INSERT INTO audit_events(actor_id,action,target_type,target_id,detail) VALUES($1,'assignment.grant','lecturer_course',$2,$3::jsonb)",
    [principal.id,lecturerId,JSON.stringify({courseId})]);
  await client.query('COMMIT');
  return {ok:true};
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
async function unassignCourse(pool,principal,{lecturerId,courseId}={}){
 await requireAdmin(principal,'assignment.revoke');
 validateId(lecturerId);validateId(courseId);
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const r=await client.query('UPDATE lecturer_courses SET unassigned_at=now() WHERE lecturer_id=$1 AND course_id=$2 AND unassigned_at IS NULL RETURNING lecturer_id',
   [lecturerId,courseId]);
  if(!r.rows.length)fail('Active assignment not found',404);
  await client.query("INSERT INTO audit_events(actor_id,action,target_type,target_id,detail) VALUES($1,'assignment.revoke','lecturer_course',$2,$3::jsonb)",
   [principal.id,lecturerId,JSON.stringify({courseId})]);
  await client.query('COMMIT');return {ok:true};
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
module.exports={listLecturers,listCourseCatalog,listAssignments,createCourse,createLecturer,assignCourse,unassignCourse};
