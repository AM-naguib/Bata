'use strict';
const roll=document.getElementById('roll'),fullName=document.getElementById('fullName');
const msg=document.getElementById('checkinMessage');
const keyRoll='sid',keyName='studentFullName',keyDevice='attendifyDeviceId';
const params=new URLSearchParams(location.search);
const token=params.get('t');
roll.value=localStorage.getItem(keyRoll)||'';
fullName.value=localStorage.getItem(keyName)||'';
function say(value,isError=false){msg.textContent=value;msg.className=isError?'error':'success'}
function setLocked(locked){
 document.getElementById('submitAttendance').disabled=locked;
 document.getElementById('submitAttendance').textContent=locked?'جاري تسجيل الحضور...':'تسجيل الحضور باستخدام موقعي';
}
document.getElementById('edit').addEventListener('click',()=>{
 localStorage.removeItem(keyRoll);localStorage.removeItem(keyName);
 roll.value='';fullName.value='';roll.focus();say('اكتبي رقم الجلوس والاسم الصحيحين.');
});
document.getElementById('checkinForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const studentId=roll.value.trim(),studentName=fullName.value.trim().replace(/\s+/gu,' ');
 if(!studentId||!studentName)return say('اكتبي رقم الجلوس واسمك بالكامل.',true);
 if(!token)return say('لازم تفتحي الرابط عن طريق QR المحاضرة المتغير.',true);
 if(!navigator.geolocation)return say('المتصفح مش بيدعم GPS.',true);
 let deviceId=localStorage.getItem(keyDevice);
 if(!deviceId){deviceId=crypto.randomUUID();localStorage.setItem(keyDevice,deviceId)}
 setLocked(true);say('جاري تحديد الموقع...');
 navigator.geolocation.getCurrentPosition(async ({coords})=>{
  try{
   const r=await fetch('/api/v2/attendance/checkin',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({token,studentId,studentName,deviceId,
      lat:coords.latitude,lng:coords.longitude,accuracy:coords.accuracy})
   });
   const data=await r.json();
   if(!r.ok||!data.ok)throw Error(data.error||'تعذر تسجيل الحضور');
   localStorage.setItem(keyRoll,studentId);localStorage.setItem(keyName,studentName);
   say(data.alreadyRegistered?'حضورك متسجّل بالفعل ✔':'تم تسجيل حضورك بنجاح ✅');
   history.replaceState({},'','/checkin');
  }catch(err){say(err.message,true)}finally{setLocked(false)}
 },()=>{say('لازم تسمحي للموقع باستخدام GPS الدقيق.',true);setLocked(false)},
 {enableHighAccuracy:true,timeout:15000,maximumAge:0});
});
if(!token)say('افتحي QR المحاضرة باستخدام كاميرا الموبايل الأول.',true);
