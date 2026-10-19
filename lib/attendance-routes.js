'use strict';
const attendance=require('./attendance-v2');
const {normalizeSeatNumber}=require('./student-identity');
function createAttendanceRouter(pool,{secret,deviceKey,now=()=>Date.now(),publicOrigin,
  principal,jsonBody,write,httpError}){
 const signer=attendance.createQrSigner(secret,now);
 if(typeof deviceKey!=='string'||Buffer.byteLength(deviceKey)<32)throw Error('ATTENDANCE_DEVICE_KEY must contain 32+ bytes');
 const attempts=new Map();
 function limited(req,b){
  const crypto=require('node:crypto');
  const key=crypto.createHash('sha256').update((req.socket.remoteAddress||'unknown')+':'+normalizeSeatNumber(b.studentId)).digest('hex');
  const time=Date.now();
  if(attempts.size>5000)for(const [id,row] of attempts)if(time-row.start>60000)attempts.delete(id);
  let row=attempts.get(key);if(!row||time-row.start>60000){row={start:time,count:0};attempts.set(key,row)}
  return ++row.count>12;
 }
 async function lecturer(req,action){
  const user=await principal(req);
  if(!user)throw httpError(401,'AUTH_REQUIRED');
  if(user.role!=='lecturer'||user.disabled_at||user.must_change_password)
    throw httpError(403,'FORBIDDEN');
  return user;
 }
 return async function route(req,res,action,method){
  if(method==='POST'&&action==='attendance/checkin'){
   const body=await jsonBody(req);
   if(limited(req,body))throw httpError(429,'TOO_MANY_CHECKINS');
   return write(res,200,await attendance.recordAttendance(pool,body,signer,deviceKey));
  }
  if(method==='GET'&&action==='lecturer/lectures'){
   const user=await lecturer(req,'course.assigned.list');
   return write(res,200,{items:await attendance.listLectures(pool,user)});
  }
  if(method==='POST'&&action==='lecturer/lectures'){
   const user=await lecturer(req,'lecture.create');
   return write(res,201,await attendance.createLecture(pool,user,await jsonBody(req)));
  }
  const m=/^lecturer\/lectures\/([a-f0-9-]{36})\/(live|close)$/.exec(action);
  if(m){
   const user=await lecturer(req,m[2]);
   if(method==='GET'&&m[2]==='live'){
    const item=await attendance.liveLecture(pool,user,m[1],signer);
    if(!item.closed){
     const qr=require('qrcode');
     const origin=publicOrigin||('http://'+req.headers.host);
     item.qr=await qr.toDataURL(origin+'/checkin?t='+encodeURIComponent(item.token),{errorCorrectionLevel:'M',width:420,margin:2});
    }
    return write(res,200,item);
   }
   if(method==='POST'&&m[2]==='close')return write(res,200,await attendance.closeLecture(pool,user,m[1]));
  }
  throw httpError(404,'NOT_FOUND');
 };
}
module.exports={createAttendanceRouter};
