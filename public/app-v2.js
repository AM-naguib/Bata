'use strict';
const el=id=>document.getElementById(id);
const state={lecturers:[],courses:[],assignments:[]};
function flash(message,failed=false){
 const node=el('flash');node.textContent=message||'';node.className=failed?'error':'success';
}
async function api(route,body){
 const options={credentials:'same-origin'};
 if(body!==undefined){
  options.method='POST';options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(body);
 }
 const response=await fetch('/api/v2/'+route,options);
 let data;try{data=await response.json()}catch{throw Error('تعذر قراءة رد السيرفر')}
 if(!response.ok)throw Error(data.error||'فشل الطلب');
 return data;
}
function setView(show,who){
 el('loginBox').hidden=show;el('portalBox').hidden=!show;
 el('adminControls').hidden=true;el('lecturerControls').hidden=true;
 el('welcome').textContent=who?'مرحبًا، '+who.name:'';
 el('identity').textContent=who?who.email:'';
 if(!who)return;
 const locked=who.mustChangePassword;
 el('changePasswordCard').classList.toggle('notice',locked);
 if(locked)flash('لازم تغير كلمة المرور المؤقتة الأول قبل استخدام الحساب',true);
 if(!locked){
  el('adminControls').hidden=who.role!=='superadmin';
  el('lecturerControls').hidden=who.role!=='lecturer';
 }
}
function li(text,button){
 const item=document.createElement('li');item.append(document.createTextNode(text));
 if(button)item.append(button);
 return item;
}
function makeButton(text,callback){
 const b=document.createElement('button');b.type='button';b.className='secondary';
 b.textContent=text;b.addEventListener('click',callback);return b;
}
function option(select,value,label){
 const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);
}
function entries(list,items,mapping){
 list.replaceChildren();
 if(!items.length){list.append(li('لا يوجد بيانات حتى الآن'));return}
 for(const row of items)list.append(li(mapping(row)));
}
async function refreshAdmin(){
 const [lecturers,courses,assignments]=await Promise.all([
  api('lecturers'),api('courses'),api('assignments')
 ]);
 state.lecturers=lecturers.items;state.courses=courses.items;state.assignments=assignments.items;
 entries(el('lecturerList'),state.lecturers,l=>l.display_name+' — '+l.email);
 entries(el('courseList'),state.courses,c=>c.name);
 const a=el('lecturerSelect'),b=el('courseSelect');a.replaceChildren();b.replaceChildren();
 option(a,'','اختار الدكتور');option(b,'','اختار المقرر');
 state.lecturers.forEach(l=>option(a,l.id,l.display_name+' ('+l.email+')'));
 state.courses.forEach(c=>option(b,c.id,c.name));
 const ul=el('assignmentList');ul.replaceChildren();
 if(!state.assignments.length)ul.append(li('مفيش تكليفات حتى الآن'));
 for(const row of state.assignments){
  const teacher=state.lecturers.find(l=>l.id===row.lecturer_id);
  const course=state.courses.find(c=>c.id===row.course_id);
  const text=(teacher?.display_name||'دكتور غير معروف')+' ← '+(course?.name||'مقرر غير معروف');
  const button=makeButton('إلغاء التكليف',async()=>{
   if(!confirm('إلغاء تكليف الدكتور بهذا المقرر؟'))return;
   try{await api('assignments/revoke',{lecturerId:row.lecturer_id,courseId:row.course_id});
    await refreshAdmin();flash('تم إلغاء التكليف')}catch(e){flash(e.message,true)}
  });
  ul.append(li(text,button));
 }
}
async function refreshLecturer(){
 const data=await api('lecturer/courses');
 entries(el('myCourses'),data.items,c=>c.name);
}
async function refreshPortal(){
 let me;
 try{me=await api('me')}catch{setView(false);return}
 setView(true,me);
 if(me.mustChangePassword)return;
 try{if(me.role==='superadmin')await refreshAdmin();
     else if(me.role==='lecturer')await refreshLecturer();}
 catch(e){flash(e.message,true)}
}
el('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();flash('');
 try{
  await api('login',{email:el('email').value,password:el('password').value});
  el('password').value='';await refreshPortal();
 }catch(err){flash(err.message,true)}
});
el('logoutButton').addEventListener('click',async()=>{
 try{await api('logout',{})}catch{}
 el('temporaryPasswordCard').hidden=true;el('tempPassword').textContent='';
 flash('تم تسجيل الخروج');setView(false);
});
el('lecturerForm').addEventListener('submit',async e=>{
 e.preventDefault();flash('');
 try{
  const teacher=await api('lecturers',{displayName:el('lecturerName').value,email:el('lecturerEmail').value});
  el('tempPassword').textContent=teacher.initialPassword;
  el('temporaryPasswordCard').hidden=false;
  el('lecturerForm').reset();await refreshAdmin();flash('تم إنشاء الدكتور. انقل كلمة المرور المؤقتة بشكل آمن.');
 }catch(err){flash(err.message,true)}
});
el('dismissSecret').addEventListener('click',()=>{
 el('tempPassword').textContent='';el('temporaryPasswordCard').hidden=true;
});
el('courseForm').addEventListener('submit',async e=>{
 e.preventDefault();flash('');
 try{
  await api('courses',{name:el('courseName').value});
  el('courseForm').reset();await refreshAdmin();flash('تم إنشاء المقرر. اختار الدكتور لتعيينه.');
 }catch(err){flash(err.message,true)}
});
el('assignForm').addEventListener('submit',async e=>{
 e.preventDefault();flash('');
 const lecturerId=el('lecturerSelect').value,courseId=el('courseSelect').value;
 if(!lecturerId||!courseId)return flash('اختار الدكتور والمقرر',true);
 try{await api('assignments',{lecturerId,courseId});
  await refreshAdmin();flash('تم تعيين المقرر للدكتور');
 }catch(err){flash(err.message,true)}
});
el('changePasswordForm').addEventListener('submit',async e=>{
 e.preventDefault();flash('');
 try{
  await api('password',{currentPassword:el('currentPassword').value,newPassword:el('newPassword').value});
  el('changePasswordForm').reset();setView(false);
  flash('تم تغيير كلمة المرور. سجّل دخولك بكلمة المرور الجديدة.');
 }catch(err){flash(err.message,true)}
});
refreshPortal();
