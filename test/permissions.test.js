const test=require('node:test');
const assert=require('node:assert/strict');
const {authorize, allowsRole}=require('../lib/permissions');
const boss={id:'boss-1',role:'superadmin'};
const a={id:'dr-1',role:'lecturer'};
const courseA='ced5eb59-87cc-4286-a8ec-8a08d4d5a7b1';
const courseB='5bc34655-6777-419b-9392-5705714f20df';
test('superadmin can manage lecturer account creation and assignments but NEVER academic records',async()=>{
  for(const action of ['lecturer.create','lecturer.list','lecturer.password.reset','assignment.list','assignment.grant','assignment.revoke','course.catalog.list','course.create','course.rename']){
    assert.equal((await authorize({principal:boss,action})).allowed,true,action);
  }
  for(const action of ['lecture.read','lecture.create','lecture.archive','attendance.read','attendance.export','attendance.record.correct','enrollment.list','enrollment.add','enrollment.remove','device.reset.course','course.assigned.list']){
    assert.equal((await authorize({principal:boss,action,courseId:courseA,isAssignedToCourse:async()=>true})).status,403,action);
  }
  for(const action of ['course.delete','course.edit','lecturer.delete','students.export','report.all','*']){
    assert.equal(allowsRole('superadmin',action),false,action);
  }
});
test('lecturer may operate only on active assigned course, checked by trusted database function',async()=>{
  let dbCalls=0;
  const dbCheck=async (userId,courseId)=>{dbCalls++;assert.equal(userId,a.id);return courseId===courseA};
  const yes=await authorize({principal:a,action:'attendance.export',courseId:courseA,isAssignedToCourse:dbCheck});
  assert.equal(yes.allowed,true);
  const no=await authorize({principal:a,action:'attendance.export',courseId:courseB,isAssignedToCourse:dbCheck});
  assert.equal(no.status,403);assert.equal(no.reason,'COURSE_NOT_ASSIGNED');
  assert.equal(dbCalls,2);
  const noFn=await authorize({principal:a,action:'attendance.read',courseId:courseA});
  assert.equal(noFn.reason,'DB_ASSIGNMENT_REQUIRED');
  const badCourse=await authorize({principal:a,action:'enrollment.remove',courseId:'invalid',isAssignedToCourse:dbCheck});
  assert.equal(badCourse.reason,'COURSE_REQUIRED');
  const dbFail=await authorize({principal:a,action:'lecture.create',courseId:courseA,isAssignedToCourse:()=>{throw Error('offline')}});
  assert.equal(dbFail.status,503);
});
test('lecturer cannot create accounts, grant assignments or access other users profiles',async()=>{
  for(const action of ['lecturer.create','lecturer.list','lecturer.password.reset','assignment.grant','assignment.revoke','course.catalog.list','course.create','course.rename']){
    assert.equal((await authorize({principal:a,action})).allowed,false,action);
  }
  assert.equal((await authorize({principal:a,action:'profile.password.change.self',targetUserId:a.id})).allowed,true);
  assert.equal((await authorize({principal:a,action:'profile.password.change.self',targetUserId:boss.id})).reason,'SELF_ONLY');
  assert.equal((await authorize({principal:boss,action:'profile.update.self',targetUserId:a.id})).reason,'SELF_ONLY');
});
test('no session, disabled account, or compulsory password update fails closed',async()=>{
  assert.equal((await authorize({action:'lecturer.create'})).status,401);
  assert.equal((await authorize({principal:{...boss,disabled_at:'2026-01-01'},action:'lecturer.create'})).status,403);
  const locked={...a,must_change_password:true};
  assert.equal((await authorize({principal:locked,action:'course.assigned.list'})).reason,'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await authorize({principal:locked,action:'profile.password.change.self',targetUserId:a.id})).allowed,true);
  assert.equal((await authorize({principal:locked,action:'session.logout'})).allowed,true);
  assert.equal((await authorize({principal:{id:'x',role:'unrecognized'},action:'lecturer.create'})).status,403);
});
