'use strict';
// Course-scoped PostgreSQL attendance. IDs are not authentication: QR + seat/name matching
// reduces casual mistakes, but GPS/device IDs supplied by browsers can be spoofed.
const crypto=require('node:crypto');
const {authorize}=require('./permissions');
const {findEnrolledStudent}=require('./student-enrollment');
const {normalizeStudentName,normalizeSeatNumber}=require('./student-identity');

const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const SLOT_MS=30000,MAX_GPS_ACCURACY=150;
function error(status,message){const e=new Error(message);e.status=status;return e}
function requireUuid(value){if(typeof value!=='string'||!UUID.test(value))throw error(400,'INVALID_ID');return value}
function validGps(b){
 return b&&typeof b.lat==='number'&&Number.isFinite(b.lat)&&Math.abs(b.lat)<=90
 &&typeof b.lng==='number'&&Number.isFinite(b.lng)&&Math.abs(b.lng)<=180
 &&typeof b.accuracy==='number'&&Number.isFinite(b.accuracy)
 &&b.accuracy>0&&b.accuracy<=MAX_GPS_ACCURACY;
}
function distanceMeters(lat1,lon1,lat2,lon2){
 const rad=Math.PI/180,R=6371000,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
 const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
 return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
function createQrSigner(secret,now=()=>Date.now()){
 if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)
  throw Error('ATTENDANCE_QR_SECRET required (at least 32 bytes)');
 function signature(id,slot){
  return crypto.createHmac('sha256',secret).update('attendify-qr-v2:'+id+':'+slot).digest('hex').slice(0,32);
 }
 return {
  issue(id){requireUuid(id);const slot=Math.floor(now()/SLOT_MS);return id+'.'+slot+'.'+signature(id,slot)},
  verify(token){
   if(typeof token!=='string'||token.length>128)return null;
   const m=/^([a-f0-9-]{36})\.([0-9]{1,14})\.([a-f0-9]{32})$/.exec(token);
   if(!m||!UUID.test(m[1]))return null;
   const slot=Number(m[2]),current=Math.floor(now()/SLOT_MS);
   if(!Number.isSafeInteger(slot)||slot>current||slot<current-1)return null;
   const got=Buffer.from(m[3],'hex'),expected=Buffer.from(signature(m[1],slot),'hex');
   if(!crypto.timingSafeEqual(got,expected))return null;
   return m[1];
  },
  secondsRemaining(){return Math.max(1,Math.ceil((SLOT_MS-now()%SLOT_MS)/1000))}
 };
}
async function authorizeCourse(pool,user,courseId,action){
 requireUuid(courseId);
 const permission=await authorize({principal:user,action,courseId,isAssignedToCourse:async(userId,id)=>{
  const r=await pool.query('SELECT 1 FROM lecturer_courses lc JOIN courses c ON c.id=lc.course_id WHERE lc.lecturer_id=$1 AND lc.course_id=$2 AND lc.unassigned_at IS NULL AND c.archived_at IS NULL',[userId,id]);
  return r.rows.length>0;
 }});
 if(!permission.allowed)throw error(permission.status,permission.reason);
}
async function listLectures(pool,user){
 const permission=await authorize({principal:user,action:'course.assigned.list'});
 if(!permission.allowed)throw error(permission.status,permission.reason);
 const r=await pool.query(
  "SELECT l.id,l.course_id,l.title,l.opened_at,l.closed_at,co.name AS course_name FROM lectures l JOIN lecturer_courses lc ON lc.course_id=l.course_id JOIN courses co ON co.id=l.course_id WHERE lc.lecturer_id=$1 AND lc.unassigned_at IS NULL AND co.archived_at IS NULL AND l.archived_at IS NULL ORDER BY l.opened_at DESC LIMIT 100",
  [user.id]);
 return r.rows;
}
async function createLecture(pool,user,b){
 if(!b||typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>120
  ||!validGps(b)||!Number.isInteger(b.radius)||b.radius<20||b.radius>500)
  throw error(400,'INVALID_LECTURE');
 const courseId=requireUuid(b.courseId);
 await authorizeCourse(pool,user,courseId,'lecture.create');
 const r=await pool.query(
  "INSERT INTO lectures(course_id,created_by,title,location_lat,location_lng,radius_m) SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS (SELECT 1 FROM lecturer_courses lc JOIN courses c ON c.id=lc.course_id WHERE lc.lecturer_id=$2 AND lc.course_id=$1 AND lc.unassigned_at IS NULL AND c.archived_at IS NULL) RETURNING id,course_id,title,opened_at,closed_at",
  [courseId,user.id,b.title.trim(),b.lat,b.lng,b.radius]
 );
 if(!r.rows.length)throw error(403,'COURSE_NOT_ASSIGNED');
 return r.rows[0];
}
async function scopedLecture(pool,user,lectureId,action){
 requireUuid(lectureId);
 // A lecturer only sees lectures for currently assigned courses.
 const r=await pool.query(
  'SELECT l.id,l.course_id,l.title,l.closed_at,l.archived_at,c.name AS course_name FROM lectures l JOIN courses c ON c.id=l.course_id JOIN lecturer_courses lc ON lc.course_id=l.course_id WHERE l.id=$1 AND lc.lecturer_id=$2 AND lc.unassigned_at IS NULL AND c.archived_at IS NULL AND l.archived_at IS NULL',
  [lectureId,user.id]
 );
 if(!r.rows.length)throw error(404,'LECTURE_NOT_FOUND');
 await authorizeCourse(pool,user,r.rows[0].course_id,action);
 return r.rows[0];
}
async function closeLecture(pool,user,id){
 await scopedLecture(pool,user,id,'lecture.close');
 const r=await pool.query(
  'UPDATE lectures l SET closed_at=now() WHERE l.id=$1 AND l.closed_at IS NULL AND l.archived_at IS NULL AND EXISTS (SELECT 1 FROM lecturer_courses lc WHERE lc.course_id=l.course_id AND lc.lecturer_id=$2 AND lc.unassigned_at IS NULL) RETURNING l.id',
  [id,user.id]
 );
 if(!r.rows.length)throw error(409,'LECTURE_ALREADY_CLOSED');
 return {ok:true};
}
async function liveLecture(pool,user,id,signer){
 const row=await scopedLecture(pool,user,id,'lecture.read');
 const count=await pool.query('SELECT count(*)::int AS total FROM attendances WHERE lecture_id=$1',[id]);
 return {id:row.id,title:row.title,courseId:row.course_id,courseName:row.course_name,
  closed:Boolean(row.closed_at),attendees:count.rows[0]?.total||0,
  token:row.closed_at?null:signer.issue(id),secondsLeft:signer.secondsRemaining()};
}
async function recordAttendance(pool,b,signer,deviceKey){
 const lectureId=signer.verify(b?.token);
 if(!lectureId)throw error(400,'INVALID_OR_EXPIRED_QR');
 const roll=normalizeSeatNumber(b?.studentId),name=normalizeStudentName(b?.studentName);
 if(!roll||roll.length>64||!name||name.length>200)throw error(400,'STUDENT_DATA_MISMATCH');
 if(!validGps(b))throw error(400,'INVALID_GPS');
 if(typeof b.deviceId!=='string'||!/^[-_a-zA-Z0-9]{16,128}$/.test(b.deviceId))
  throw error(400,'INVALID_DEVICE');
 if(typeof deviceKey!=='string'||Buffer.byteLength(deviceKey)<32)throw error(503,'DEVICE_KEY_NOT_CONFIGURED');
 const deviceHash=crypto.createHmac('sha256',deviceKey).update('attendify-device-v2:'+b.deviceId).digest('hex');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  // Row lock serializes lecture closing and check-ins, preventing post-close attendance.
  const res=await client.query(
   'SELECT l.id,l.course_id,l.closed_at,l.archived_at,l.location_lat,l.location_lng,l.radius_m,c.archived_at AS course_archived FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=$1 FOR UPDATE OF l',
   [lectureId]
  );
  const lecture=res.rows[0];
  if(!lecture||lecture.closed_at||lecture.archived_at||lecture.course_archived)
   throw error(409,'LECTURE_NOT_OPEN');
  const student=await findEnrolledStudent(client,{courseId:lecture.course_id,studentId:roll,studentName:name});
  if(!student)throw error(400,'STUDENT_DATA_MISMATCH');
  const d=distanceMeters(lecture.location_lat,lecture.location_lng,b.lat,b.lng);
  if(!Number.isFinite(d)||d>lecture.radius_m)throw error(403,'OUTSIDE_LECTURE');
  const existing=await client.query(
   'SELECT student_id,device_fingerprint_hash FROM attendances WHERE lecture_id=$1 AND (student_id=$2 OR device_fingerprint_hash=$3)',
   [lectureId,student.id,deviceHash]
  );
  if(existing.rows.some(row=>row.student_id!==student.id))
   throw error(409,'DEVICE_ALREADY_USED');
  if(existing.rows.some(row=>row.student_id===student.id)){
   await client.query('COMMIT');
   return {ok:true,alreadyRegistered:true,studentName:name};
  }
  await client.query(
   'INSERT INTO attendances(lecture_id,student_id,device_fingerprint_hash,distance_m) VALUES($1,$2,$3,$4)',
   [lectureId,student.id,deviceHash,Math.round(d)]
  );
  await client.query('COMMIT');
  return {ok:true,alreadyRegistered:false,studentName:name};
 }catch(e){
  await client.query('ROLLBACK');
  if(e.code==='23505')throw error(409,'ATTENDANCE_CONFLICT');
  throw e;
 }finally{client.release()}
}
module.exports={createQrSigner,distanceMeters,authorizeCourse,listLectures,createLecture,scopedLecture,closeLecture,liveLecture,recordAttendance};
