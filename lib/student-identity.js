'use strict';
// Attendance identifier: student types BOTH seat number and full name.
// This is a record-matching check, NOT strong identity authentication.
const normalizeStudentName=value=>
  typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/gu,' '):'';
const normalizeSeatNumber=value=>
  typeof value==='string'?value.trim():typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
function validStudentIdentity({studentId,studentName}={}, student){
  const id=normalizeSeatNumber(studentId);
  const name=normalizeStudentName(studentName);
  if(!student||!id||!name||id.length>64||name.length>200)return false;
  const storedId=normalizeSeatNumber(student.roll_number??student.id);
  const storedName=normalizeStudentName(student.name??student.full_name);
  return id===storedId&&name===storedName;
}
module.exports={normalizeStudentName,normalizeSeatNumber,validStudentIdentity};
