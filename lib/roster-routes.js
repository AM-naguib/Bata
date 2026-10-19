'use strict';
const roster=require('./course-roster');
function httpError(status,message){const e=new Error(message);e.status=status;return e}
// GET/POST lecturer/courses/:courseId/students; POST .../students/remove
function createRosterRouter(pool,{principal,jsonBody,write}){
 return async function route(req,res,action,method){
  const m=/^lecturer\/courses\/([a-f0-9-]{36})\/students(\/remove)?$/.exec(action);
  if(!m||!((method==='GET'&&!m[2])||method==='POST'))
   throw httpError(404,'NOT_FOUND');
  const user=await principal(req);
  if(!user)throw httpError(401,'AUTH_REQUIRED');
  const courseId=m[1];
  if(method==='GET'&&!m[2])
   return write(res,200,{items:await roster.listStudents(pool,user,courseId)});
  if(method==='POST'&&!m[2])
   return write(res,201,await roster.addStudent(pool,user,courseId,await jsonBody(req)));
  if(method==='POST'&&m[2]){
   const body=await jsonBody(req);
   return write(res,200,await roster.removeStudent(pool,user,courseId,body.studentId));
  }
  throw httpError(405,'METHOD_NOT_ALLOWED');
 };
}
module.exports={createRosterRouter};
