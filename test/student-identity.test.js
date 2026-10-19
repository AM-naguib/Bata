const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeStudentName,normalizeSeatNumber,validStudentIdentity}=require('../lib/student-identity');
test('full name and roll number must both match a roster record',()=>{
 const student={id:'101',name:'سارة أحمد محمد'};
 assert.equal(validStudentIdentity({studentId:'101',studentName:'سارة أحمد محمد'},student),true);
 assert.equal(validStudentIdentity({studentId:'101',studentName:'  سارة   أحمد  محمد  '},student),true);
 assert.equal(validStudentIdentity({studentId:'102',studentName:'سارة أحمد محمد'},student),false);
 assert.equal(validStudentIdentity({studentId:'101',studentName:'هدى أحمد محمد'},student),false);
 assert.equal(validStudentIdentity({studentId:'101'},student),false);
 assert.equal(validStudentIdentity({studentName:student.name},student),false);
 assert.equal(validStudentIdentity({studentId:'101',studentName:student.name},null),false);
 assert.equal(validStudentIdentity({studentId:'101',studentName:''},student),false);
});
test('DB course roster shape also matches while keeping names private',()=>{
 const enrolled={roll_number:'000007',full_name:'Nada  Hassan'};
 assert.equal(validStudentIdentity({studentId:'000007',studentName:'Nada Hassan'},enrolled),true);
 assert.equal(validStudentIdentity({studentId:'7',studentName:'Nada Hassan'},enrolled),false);
 assert.equal(validStudentIdentity({studentId:'000007',studentName:'Nada'},enrolled),false);
 assert.equal(normalizeSeatNumber(' 000007 '),'000007');
 assert.equal(normalizeStudentName('  Nada\t Hassan  '),'Nada Hassan');
});
test('reject nonstring names, oversized input and ambiguous IDs',()=>{
 const student={id:'123',name:'Alaa Adel'};
 assert.equal(validStudentIdentity({studentId:'123',studentName:'x'.repeat(201)},student),false);
 assert.equal(validStudentIdentity({studentId:'1'.repeat(65),studentName:student.name},student),false);
 assert.equal(validStudentIdentity({studentId:'123',studentName:123},student),false);
 assert.equal(validStudentIdentity({studentId:'123',studentName:student.name},{}),false);
});
