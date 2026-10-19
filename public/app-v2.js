'use strict';
// Staff portal: role-specific navigation and DOM-safe rendering. All permissions live on the server.
const el=id=>document.getElementById(id);
const state={role:null,profile:null,lecturers:[],courses:[],assignments:[],assignedCourses:[],
  roster:[],rosterPage:1,rosterCourseId:'',reportData:null,reportPage:1,reportCourseId:'',selectedQr:null,qrUpdating:false,flashTimer:null};
const PAGE_NAMES={
  overview:'نظرة عامة',lecturers:'حسابات الدكاترة',courses:'المقررات',
  assignments:'تكليفات الدكاترة',roster:'كشف الطالبات',reports:'تقارير وExcel',lectures:'المحاضرات والحضور',
  security:'أمان الحساب'
};
const ERROR_MESSAGES={
  SERVER_ERROR:'السيرفر واجه مشكلة أثناء تنفيذ الطلب. جرّب تاني، ولو استمرت المشكلة تواصل مع المسؤول.',
  INVALID_CREDENTIALS:'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  CURRENT_PASSWORD_INVALID:'كلمة المرور الحالية غير صحيحة.',
  PASSWORD_REQUIREMENTS:'كلمة المرور الجديدة لازم تكون 12 حرفًا على الأقل، ومختلفة عن الحالية.',
  TOO_MANY_ATTEMPTS:'محاولات دخول كتير. جرّب تاني بعد 15 دقيقة.',
  AUTH_REQUIRED:'الجلسة انتهت. سجّل دخولك تاني.',
  PASSWORD_CHANGE_REQUIRED:'لازم تغير كلمة المرور المؤقتة قبل المتابعة.',
  FORBIDDEN:'مش مصرح لحسابك باستخدام الوظيفة دي.',
  COURSE_NOT_ASSIGNED:'المقرر ده مش متعيّن لحسابك.',
  ROSTER_NOT_ENABLED:'إدارة الكشوف غير مفعّلة حاليًا.',
  ATTENDANCE_NOT_ENABLED:'ميزة حضور المحاضرات مش مفعّلة حاليًا.',
  REPORT_TOO_LARGE:'التقرير أكبر من الحد المسموح. تواصل مع المسؤول.',
  'Email already exists':'البريد الإلكتروني ده مسجل بالفعل.',
  'Invalid ID':'الاختيار غير صحيح. حدّث الصفحة وجرّب تاني.'
};
function safeMessage(code){return ERROR_MESSAGES[code]||code||'حصل خطأ غير متوقع. حاول مرة تانية.'}
function flash(message,failed=false){
 const box=el('flash');box.hidden=false;box.textContent=safeMessage(message);
 box.className='toast '+(failed?'error':'success');
 if(state.flashTimer)clearTimeout(state.flashTimer);
 state.flashTimer=setTimeout(()=>{box.hidden=true},7000);
}
async function api(route,body){
 const options={credentials:'same-origin',headers:{Accept:'application/json'}};
 if(body!==undefined){
  options.method='POST';options.headers['Content-Type']='application/json';
  options.body=JSON.stringify(body);
 }
 let response;
 try{response=await fetch('/api/v2/'+route,options)}
 catch{throw Error('تعذر الاتصال بالسيرفر. تأكد من الإنترنت وجرب تاني.')}
 let data;
 try{data=await response.json()}catch{throw Error('تعذر قراءة رد السيرفر.')}
 if(!response.ok)throw Error(safeMessage(data.error||'فشل الطلب'));
 return data;
}
function empty(list,message){
 list.replaceChildren();
 const li=document.createElement('li');li.className='empty';li.textContent=message;list.append(li);
}
function labelRow(title,description){
 const label=document.createElement('span');label.className='record-label';label.textContent=title;
 if(description){const sub=document.createElement('small');sub.className='record-sub';sub.textContent=description;label.append(sub)}
 return label;
}
function appendRow(list,label,button){
 const item=document.createElement('li');item.append(label);
 if(button)item.append(button);list.append(item);return item;
}
function actionButton(name,action){
 const button=document.createElement('button');button.type='button';button.textContent=name;
 button.addEventListener('click',action);return button;
}
function updateCount(id,value){const node=el(id);if(node)node.textContent=String(value)}
function option(select,value,label){
 const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);
}
function hasRolePage(page){
 if(page==='security')return true;
 return state.role==='superadmin'
  ?['overview','lecturers','courses','assignments'].includes(page)
  :state.role==='lecturer'
   ?['overview','roster','lectures','reports'].includes(page):false;
}
function navigate(page){
 if(!hasRolePage(page))page='overview';
 const sections=document.querySelectorAll('[data-page]');
 for(const section of sections)section.hidden=section.dataset.page!==page;
 for(const button of document.querySelectorAll('[data-nav]')){
  const active=button.dataset.nav===page;
  button.classList.toggle('is-active',active);
  if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
 if(page==='security'&&state.profile?.mustChangePassword){
  el('changePasswordCard').classList.add('notice');
 }
 const title=PAGE_NAMES[page];
 if(title)document.title='حاضر | '+title;
 if(page==='roster')el('rosterSearch').focus({preventScroll:true});
}
function showEntryGate(){
 const intent=location.pathname;
 const role=intent==='/admin'?'superadmin':intent==='/lecturer'?'lecturer':'';
 const data=role==='superadmin'
  ?{eyebrow:'بوابة الأدمن الرئيسي',title:'إدارة النظام،',emphasis:'بخطوات واضحة.',
     description:'أنشئ حسابات الدكاترة ونظّم المقررات والتكليفات؛ بيانات الطالبات والحضور مش ضمن صلاحيات الأدمن.',
     login:'دخول الأدمن الرئيسي'}
  :role==='lecturer'
  ?{eyebrow:'بوابة الدكتور',title:'محاضراتك وكشوفك،',emphasis:'في مكان واحد.',
     description:'تابع المقررات المعيّنة ليك، وابحث في كشف طالباتك وأدر المحاضرات بالصلاحيات الخاصة بدورك.',
     login:'دخول الدكتور'}
  :{eyebrow:'منصة حاضر',title:'3 بوابات،',emphasis:'تجربة لكل دور.',
     description:'اختار بوابة الأدمن أو الدكتور أو الطالبة من الأعلى. كل فئة ليها مساحتها المستقلة وصلاحياتها.',
     login:'بوابة العاملين'};
 el('entryEyebrow').textContent=data.eyebrow;
 el('entryTitle').textContent=data.title;
 el('entryEmphasis').textContent=data.emphasis;
 el('entryDescription').textContent=data.description;
 el('loginTitle').textContent=data.login;
 el('loginDescription').textContent=role
  ?'سجّل دخولك بالبريد الإلكتروني وكلمة المرور الخاصة بحسابك.'
  :'سجّل دخولك كأدمن أو دكتور، أو افتح بوابة الطالبة بدون تسجيل حساب.';
 document.body.dataset.entry=role||'general';
 for(const link of document.querySelectorAll('[data-gateway]')){
  const active=link.dataset.gateway===role;
  link.classList.toggle('is-active',active);
  if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 }
 document.title='حاضر | '+data.login;
}
function setView(show,who){
 state.profile=show?who:null;state.role=show?who.role:null;
 el('loginBox').hidden=show;el('portalBox').hidden=!show;
 el('identity').textContent=who?who.email:'';
 if(!who){
  el('adminControls').hidden=true;el('lecturerControls').hidden=true;
  el('adminNav').hidden=true;el('lecturerNav').hidden=true;
  showEntryGate();
  return;
 }
 el('welcome').textContent='أهلًا، '+who.name;
 el('roleLabel').textContent=who.role==='superadmin'?'مساحة الأدمن الرئيسي':'مساحة الدكتور';
 el('welcomeDescription').textContent=who.role==='superadmin'
  ?'إدارة الدكاترة والمقررات والصلاحيات من مكان واحد.'
  :'مساحتك الخاصة لإدارة المقررات والطالبات.';
 const forced=Boolean(who.mustChangePassword);
 el('adminControls').hidden=forced||who.role!=='superadmin';
 el('lecturerControls').hidden=forced||who.role!=='lecturer';
 el('adminNav').hidden=forced||who.role!=='superadmin';
 el('lecturerNav').hidden=forced||who.role!=='lecturer';
 const path=who.role==='superadmin'?'/admin':'/lecturer';
 if(location.pathname!==path)history.replaceState({},'',path);
 navigate(forced?'security':'overview');
 if(forced)flash('لازم تغير كلمة المرور المؤقتة الأول قبل استخدام حسابك.',true);
}
async function refreshAdmin(){
 const [lecturers,courses,assignments]=await Promise.all([
  api('lecturers'),api('courses'),api('assignments')
 ]);
 state.lecturers=lecturers.items;state.courses=courses.items;state.assignments=assignments.items;
 updateCount('adminLecturerCount',state.lecturers.length);
 updateCount('adminCourseCount',state.courses.length);
 updateCount('adminAssignmentCount',state.assignments.length);
 updateCount('lecturerCountChip',state.lecturers.length+' حساب');
 updateCount('courseCountChip',state.courses.length+' مقرر');
 updateCount('assignmentCountChip',state.assignments.length+' تكليف');
 const lecturerList=el('lecturerList'),courseList=el('courseList'),assignmentsList=el('assignmentList');
 lecturerList.replaceChildren();courseList.replaceChildren();assignmentsList.replaceChildren();
 if(!state.lecturers.length)empty(lecturerList,'لسه مفيش دكاترة. أنشئ أول حساب من النموذج.');
 else for(const teacher of state.lecturers){
  const reset=actionButton('إعادة تعيين الباسورد',async()=>{
   if(!confirm('تأكيد إنشاء باسورد مؤقت جديد للدكتور '+teacher.display_name+'؟\\nالباسورد الحالي هيتلغي، وكل جلساته المفتوحة هتتقفل.'))return;
   reset.disabled=true;
   try{
    hideTemporaryPassword();
    const response=await api('lecturers/password/reset',{lecturerId:teacher.id});
    showTemporaryPassword('باسورد مؤقت جديد — '+teacher.display_name,response.temporaryPassword);
    flash('تم تغيير باسورد الدكتور مؤقتًا. سلّمه الباسورد الجديد بشكل آمن.');
   }catch(err){flash(err.message,true)}
   finally{reset.disabled=false}
  });
  appendRow(lecturerList,labelRow(teacher.display_name,teacher.email),reset);
 }
 if(!state.courses.length)empty(courseList,'مفيش مقررات مضافة.');
 else for(const c of state.courses)appendRow(courseList,labelRow(c.name,c.code||'مقرر جامعي'));
 if(!state.assignments.length)empty(assignmentsList,'لسه مفيش تكليفات. اختار دكتور ومقرر للتكليف.');
 else for(const a of state.assignments){
  const teacher=state.lecturers.find(row=>row.id===a.lecturer_id);
  const course=state.courses.find(row=>row.id===a.course_id);
  const button=actionButton('إلغاء التكليف',async()=>{
   if(!confirm('إلغاء تكليف الدكتور بهذا المقرر؟'))return;
   button.disabled=true;
   try{
    await api('assignments/revoke',{lecturerId:a.lecturer_id,courseId:a.course_id});
    await refreshAdmin();flash('تم إلغاء تكليف الدكتور بالمقرر.');
   }catch(e){flash(e.message,true)}finally{button.disabled=false}
  });
  appendRow(assignmentsList,labelRow(course?.name||'مقرر غير معروف',teacher?.display_name||'دكتور غير معروف'),button);
 }
 const a=el('lecturerSelect'),b=el('courseSelect'),rename=el('renameCourseSelect');
 const previousRename=rename.value,previousLecturer=a.value,previousCourse=b.value;
 a.replaceChildren();b.replaceChildren();rename.replaceChildren();
 option(a,'','اختار الدكتور');option(b,'','اختار المقرر');
 option(rename,'','اختار المقرر لتعديل اسمه');
 for(const t of state.lecturers)option(a,t.id,t.display_name+' — '+t.email);
 for(const c of state.courses){option(b,c.id,c.name);option(rename,c.id,c.name)}
 if(state.courses.some(c=>c.id===previousRename))rename.value=previousRename;
 if(state.lecturers.some(t=>t.id===previousLecturer))a.value=previousLecturer;
 if(state.courses.some(c=>c.id===previousCourse))b.value=previousCourse;
}
const PAGE_SIZE=20;
function renderRoster(){
 const list=el('rosterList'),search=el('rosterSearch').value.trim().normalize('NFC').toLocaleLowerCase('ar');
 const match=state.roster.filter(s=>!search||s.full_name.normalize('NFC').toLocaleLowerCase('ar').includes(search)||s.roll_number.includes(search));
 const maxPage=Math.max(1,Math.ceil(match.length/PAGE_SIZE));
 state.rosterPage=Math.min(Math.max(1,state.rosterPage),maxPage);
 const start=(state.rosterPage-1)*PAGE_SIZE;
 list.replaceChildren();
 updateCount('rosterResults',search?'نتيجة البحث: '+match.length:'الإجمالي: '+state.roster.length);
 updateCount('rosterVisibleCount',state.roster.length||'0');
 if(!state.rosterCourseId)empty(list,'اختار مقرر لعرض كشف الطالبات.');
 else if(!match.length)empty(list,search?'مفيش نتائج مطابقة للبحث.':'لسه مفيش طالبات في المقرر.');
 else for(const student of match.slice(start,start+PAGE_SIZE)){
  const selectedCourse=state.rosterCourseId;
  const button=actionButton('إلغاء القيد',async()=>{
   if(!confirm('إلغاء قيد الطالبة من المقرر المختار؟ سجل حضورها القديم هيفضل محفوظ.'))return;
   button.disabled=true;
   try{
    await api('lecturer/courses/'+selectedCourse+'/students/remove',{studentId:student.id});
    if(state.rosterCourseId===selectedCourse)await refreshRoster();
    flash('تم إلغاء القيد من المقرر بدون مسح الحضور القديم.');
   }catch(err){flash(err.message,true);button.disabled=false}
  });
  appendRow(list,labelRow(student.full_name,student.roll_number),button);
 }
 el('rosterPagination').hidden=!state.rosterCourseId||maxPage===1;
 updateCount('rosterPage','صفحة '+state.rosterPage+' من '+maxPage);
 el('rosterPrevious').disabled=state.rosterPage<=1;
 el('rosterNext').disabled=state.rosterPage>=maxPage;
 el('rosterHint').textContent=!state.rosterCourseId?'اختار مقرر لعرض الطالبات':
  match.length?'عرض '+(start+1)+'–'+Math.min(start+PAGE_SIZE,match.length)+' من '+match.length+' طالبة':
   'لا توجد نتائج في هذا المقرر.';
}
async function refreshRoster(){
 const courseId=el('rosterCourse').value;
 state.rosterCourseId=courseId;state.rosterPage=1;state.roster=[];
 if(!courseId){renderRoster();return}
 try{
  const result=await api('lecturer/courses/'+courseId+'/students');
  if(state.rosterCourseId!==courseId)return;
  state.roster=result.items;
  renderRoster();
 }catch(err){
  if(state.rosterCourseId!==courseId)return;
  renderRoster();el('rosterHint').textContent='تعذر عرض كشف الطالبات.';
  flash(err.message,true);
 }
}
const REPORT_PAGE_SIZE=20;
function renderReports(){
 const report=state.reportData;
 const students=el('reportStudents'),lectures=el('reportLectures');
 students.replaceChildren();lectures.replaceChildren();
 if(!report){
  empty(students,'اختار المقرر لتحميل نتائج الطالبات.');
  empty(lectures,'المحاضرات المقفولة هتظهر هنا.');
  el('reportPagination').hidden=true;el('reportDownload').disabled=true;
  updateCount('reportStudentCount','—');updateCount('reportLectureCount','—');
  updateCount('reportPresentCount','—');return;
 }
 updateCount('reportStudentCount',report.totalStudents);
 updateCount('reportLectureCount',report.totalLectures);
 updateCount('reportPresentCount',report.students.reduce((sum,s)=>sum+s.attended,0));
 el('reportDownload').disabled=false;
 const query=el('reportSearch').value.trim().normalize('NFC').toLocaleLowerCase('ar');
 const matching=report.students.filter(s=>!query||
  s.fullName.normalize('NFC').toLocaleLowerCase('ar').includes(query)||s.rollNumber.includes(query));
 const maxPage=Math.max(1,Math.ceil(matching.length/REPORT_PAGE_SIZE));
 state.reportPage=Math.min(Math.max(1,state.reportPage),maxPage);
 const start=(state.reportPage-1)*REPORT_PAGE_SIZE;
 if(!matching.length)empty(students,query?'مفيش طالبة مطابقة للبحث.':'لا توجد طالبات مقيدات حاليًا.');
 else for(const student of matching.slice(start,start+REPORT_PAGE_SIZE)){
  const pct=student.percentage===null?'—':student.percentage+'٪';
  appendRow(students,labelRow(student.fullName,student.rollNumber),
   (()=>{const label=document.createElement('span');label.className='report-attendance';
    label.textContent='حضور '+student.attended+' | غياب '+student.absent+' | '+pct;return label})());
 }
 el('reportPagination').hidden=maxPage<=1;
 updateCount('reportPage','صفحة '+state.reportPage+' من '+maxPage);
 el('reportPrevious').disabled=state.reportPage<=1;
 el('reportNext').disabled=state.reportPage>=maxPage;
 if(!report.lectures.length)empty(lectures,'لسه مفيش محاضرات مقفولة. مفيش غياب محسوب.');
 else for(const lecture of report.lectures)
  appendRow(lectures,labelRow(lecture.title,new Date(lecture.closedAt).toLocaleDateString('ar-EG')),
    (()=>{const label=document.createElement('span');label.className='report-attendance';
     label.textContent=lecture.present+' حاضر | '+lecture.absent+' غائب';return label})());
 el('reportNotice').textContent=report.totalLectures
  ?'النتائج مبنية على '+report.totalLectures+' محاضرة مقفولة، وبتستبعد المحاضرات قبل قيد الطالبة.'
  :'التقرير جاهز، لكن لسه مفيش محاضرات مقفولة؛ نسبة الحضور بتظهر «—» بدل غياب غير حقيقي.';
}
async function refreshReports(){
 const courseId=el('reportCourse').value;
 state.reportCourseId=courseId;state.reportData=null;state.reportPage=1;
 renderReports();renderCorrectionControls();
 if(!courseId){el('reportNotice').textContent='اختار المقرر لعرض التقرير.';return}
 el('reportNotice').textContent='جارٍ حساب التقرير...';
 try{
  const report=await api('lecturer/courses/'+courseId+'/report');
  if(state.reportCourseId!==courseId)return;
  state.reportData=report;renderReports();renderCorrectionControls();
 }catch(err){
  if(state.reportCourseId!==courseId)return;
  el('reportNotice').textContent='تعذر تحميل التقرير. حاول مرة تانية.';
  flash(err.message,true);
 }
}
async function downloadReport(){
 const courseId=state.reportCourseId;
 if(!courseId||!state.reportData)return;
 const button=el('reportDownload');button.disabled=true;
 try{
  const response=await fetch('/api/v2/lecturer/courses/'+courseId+'/report.xlsx',{
   credentials:'same-origin',headers:{Accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
  if(!response.ok){
   const responseData=await response.json().catch(()=>({error:'تعذر تنزيل التقرير.'}));
   throw Error(safeMessage(responseData.error));
  }
  const blob=await response.blob(),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;
  link.download='hader-'+courseId+'.xlsx';document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  flash('تم تجهيز ملف Excel. احتفظ بيه في مكان آمن لأنه يحتوي على بيانات الطالبات.');
 }catch(err){flash(err.message,true)}finally{
  button.disabled=state.reportData===null;
 }
}
async function refreshLectureRecords(){
 const list=el('lectureRecordsList');list.replaceChildren();
 try{
  const result=await api('lecturer/lecture-records');
  state.lectureRecords=result.items;
  if(!result.items.length){empty(list,'لسه مفيش محاضرات سابقة.');return}
  for(const record of result.items){
   const archived=Boolean(record.archived_at);
   const tag=archived?'مؤرشفة':record.closed_at?'مقفولة':'مفتوحة';
   const label=labelRow(record.title,(record.course_name||'مقرر')+' — '+tag);
   if(!record.closed_at){appendRow(list,label);continue}
   const button=actionButton(archived?'استعادة المحاضرة':'أرشفة المحاضرة',async()=>{
    const verb=archived?'استعادة':'أرشفة';
    if(!confirm('تأكيد '+verb+' المحاضرة؟ الحضور القديم مش هيتمسح.'))return;
    button.disabled=true;
    try{
     await api('lecturer/lecture-records/'+record.id+'/'+(archived?'restore':'archive'),{});
     await Promise.all([refreshLectureRecords(),refreshReports(),refreshLectures()]);
     flash('تم '+verb+' المحاضرة بدون حذف سجلات الحضور.');
    }catch(err){flash(err.message,true)}finally{button.disabled=false}
   });
   appendRow(list,label,button);
  }
 }catch(err){empty(list,'تعذر تحميل قائمة الأرشيف.');flash(err.message,true)}
}
function renderCorrectionControls(){
 const lectureSelector=el('correctionLecture'),studentSelector=el('correctionStudent');
 const report=state.reportData;
 const oldLecture=lectureSelector.value,oldStudent=studentSelector.value;
 lectureSelector.replaceChildren();studentSelector.replaceChildren();
 option(lectureSelector,'','اختار المحاضرة');option(studentSelector,'','اختار الطالبة');
 if(!report)return;
 for(const l of report.lectures)option(lectureSelector,l.id,l.title+' — '+new Date(l.closedAt).toLocaleDateString('ar-EG'));
 for(const s of report.students)option(studentSelector,s.id,s.rollNumber+' — '+s.fullName);
 if(report.lectures.some(l=>l.id===oldLecture))lectureSelector.value=oldLecture;
 if(report.students.some(s=>s.id===oldStudent))studentSelector.value=oldStudent;
}
async function refreshLectures(){
 let result;
 try{result=await api('lecturer/lectures')}
 catch(err){
  el('lectureManager').hidden=true;el('attendanceNotice').hidden=false;
  updateCount('lectureCount','—');
  empty(el('lectureList'),'تسجيل الحضور بالـQR غير مفعّل حاليًا.');
  return;
 }
 el('attendanceNotice').hidden=true;
 el('lectureManager').hidden=false;
 updateCount('lectureCount',result.items.length);
 const list=el('lectureList');list.replaceChildren();
 if(!result.items.length){empty(list,'لسه مفيش محاضرات. أنشئ أول محاضرة من النموذج.');return}
 for(const item of result.items){
  const label=labelRow(item.title,(item.course_name||'مقرر')+' — '+(item.closed_at?'مقفولة':'مفتوحة'));
  const row=appendRow(list,label);
  if(!item.closed_at){
   const show=actionButton('عرض QR',async()=>{
    try{state.selectedQr=item.id;await refreshQr()}catch(e){flash(e.message,true)}
   });
   const close=actionButton('قفل المحاضرة',async()=>{
    if(!confirm('تأكيد قفل المحاضرة؟ QR هيتوقف ومش هيتسجّل حضور جديد.'))return;
    close.disabled=true;
    try{
     await api('lecturer/lectures/'+item.id+'/close',{});
     state.selectedQr=null;el('qrCard').hidden=true;
     await refreshLectures();flash('تم قفل المحاضرة.');
    }catch(e){flash(e.message,true)}finally{close.disabled=false}
   });
   row.append(show,close);
  }
 }
}
async function refreshLecturer(){
 const data=await api('lecturer/courses');
 state.assignedCourses=data.items;
 updateCount('lecturerCourseCount',data.items.length);
 const list=el('myCourses');list.replaceChildren();
 if(!data.items.length)empty(list,'لسه مفيش مقرر متعيّن ليك. تواصل مع الأدمن.');
 else for(const c of data.items)appendRow(list,labelRow(c.name,c.code||'مقرر جامعي'));
 const lectureSelector=el('lectureCourse'),rosterSelector=el('rosterCourse'),reportSelector=el('reportCourse'),previous=rosterSelector.value,previousReport=reportSelector.value;
 lectureSelector.replaceChildren();rosterSelector.replaceChildren();reportSelector.replaceChildren();
 option(lectureSelector,'','اختار المقرر');option(rosterSelector,'','اختار المقرر');option(reportSelector,'','اختار المقرر');
 for(const c of data.items){option(lectureSelector,c.id,c.name);option(rosterSelector,c.id,c.name);option(reportSelector,c.id,c.name)}
 rosterSelector.value=data.items.some(c=>c.id===previous)?previous:(data.items[0]?.id||'');
 reportSelector.value=data.items.some(c=>c.id===previousReport)?previousReport:(data.items[0]?.id||'');
 await Promise.all([refreshRoster(),refreshLectures(),refreshReports(),refreshLectureRecords()]);
}
async function refreshQr(){
 if(!state.selectedQr||state.qrUpdating)return;
 state.qrUpdating=true;
 try{
  const item=await api('lecturer/lectures/'+state.selectedQr+'/live');
  el('qrCard').hidden=false;
  el('qrTitle').textContent=item.courseName+' — '+item.title;
  el('qrStats').textContent='تم تسجيل حضور '+item.attendees+' طالبة — تحديث خلال '+item.secondsLeft+' ثانية';
  el('qrImage').hidden=item.closed;
  if(item.closed){state.selectedQr=null;el('qrStats').textContent='المحاضرة مقفولة.'}
  else if(item.qr)el('qrImage').src=item.qr;
 }catch(err){flash(err.message,true);state.selectedQr=null;el('qrCard').hidden=true}
 finally{state.qrUpdating=false}
}
window.setInterval(()=>{if(state.selectedQr&&!el('qrCard').hidden)refreshQr()},10000);
async function refreshPortal(){
 let me;
 try{me=await api('me')}
 catch(err){setView(false);if(!err.message.includes('الجلسة انتهت'))flash(err.message,true);return}
 setView(true,me);
 if(me.mustChangePassword)return;
 try{
  if(me.role==='superadmin')await refreshAdmin();
  else if(me.role==='lecturer')await refreshLecturer();
 }catch(err){flash(err.message,true)}
}
for(const button of document.querySelectorAll('[data-nav]'))
 button.addEventListener('click',()=>navigate(button.dataset.nav));
for(const button of document.querySelectorAll('[data-go]'))
 button.addEventListener('click',()=>navigate(button.dataset.go));
el('toggleLoginPassword').addEventListener('click',()=>{
 const field=el('password'),show=field.type==='password';
 field.type=show?'text':'password';
 el('toggleLoginPassword').textContent=show?'إخفاء':'إظهار';
 el('toggleLoginPassword').setAttribute('aria-pressed',String(show));
});
el('rosterCourse').addEventListener('change',()=>{
 el('rosterSearch').value='';refreshRoster();
});
el('rosterSearch').addEventListener('input',()=>{state.rosterPage=1;renderRoster()});
el('rosterPrevious').addEventListener('click',()=>{
 if(state.rosterPage>1){state.rosterPage--;renderRoster()}
});
el('rosterNext').addEventListener('click',()=>{
 state.rosterPage++;renderRoster();
});
el('reportCourse').addEventListener('change',()=>{el('reportSearch').value='';refreshReports()});
el('reportSearch').addEventListener('input',()=>{state.reportPage=1;renderReports()});
el('reportPrevious').addEventListener('click',()=>{if(state.reportPage>1){state.reportPage--;renderReports()}});
el('reportNext').addEventListener('click',()=>{state.reportPage++;renderReports()});
el('reportDownload').addEventListener('click',downloadReport);
el('correctionForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const courseId=state.reportCourseId,lectureId=el('correctionLecture').value,
       studentId=el('correctionStudent').value,status=el('correctionStatus').value,
       reason=el('correctionReason').value.trim();
 if(!courseId||!state.reportData||!state.reportData.lectures.some(l=>l.id===lectureId)
    ||!state.reportData.students.some(s=>s.id===studentId))return flash('اختار محاضرة وطالبة من التقرير الأول.',true);
 if(!confirm('تأكيد تصحيح حضور الطالبة؟ العملية هتتسجل باسم حسابك في سجل المراجعة.'))return;
 const button=event.submitter;if(button)button.disabled=true;
 try{
  await api('lecturer/lecture-records/'+lectureId+'/correct',{studentId,status,reason});
  el('correctionReason').value='';
  await refreshReports();
  flash('تم تصحيح الحضور وتسجيل العملية للمراجعة.');
 }catch(err){flash(err.message,true)}finally{if(button)button.disabled=false}
});

el('stopQr').addEventListener('click',()=>{state.selectedQr=null;el('qrCard').hidden=true});
el('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const button=el('loginButton');button.disabled=true;
 try{
  await api('login',{email:el('email').value,password:el('password').value});
  el('password').value='';await refreshPortal();
 }catch(err){flash(err.message,true)}finally{button.disabled=false}
});
el('logoutButton').addEventListener('click',async()=>{
 state.selectedQr=null;el('qrCard').hidden=true;
 try{await api('logout',{})}catch{}
 hideTemporaryPassword();
 const destination=state.role==='superadmin'?'/admin':state.role==='lecturer'?'/lecturer':'/portal';
 history.replaceState({},'',destination);setView(false);
 flash('تم تسجيل الخروج بنجاح.');
});
function hideTemporaryPassword(){
 el('tempPassword').textContent='';
 el('tempPasswordHeading').textContent='كلمة المرور المؤقتة للدكتور';
 el('temporaryPasswordCard').hidden=true;
}
function showTemporaryPassword(heading,password){
 el('tempPasswordHeading').textContent=heading;
 el('tempPassword').textContent=password;
 el('temporaryPasswordCard').hidden=false;
 el('temporaryPasswordCard').scrollIntoView({behavior:'smooth',block:'center'});
}
el('lecturerForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const button=event.submitter;if(button)button.disabled=true;
 try{
  const t=await api('lecturers',{displayName:el('lecturerName').value,email:el('lecturerEmail').value});
  el('lecturerForm').reset();
  await refreshAdmin();
  showTemporaryPassword('باسورد أول دخول — '+t.display_name,t.initialPassword);
  flash('تم إنشاء حساب الدكتور. احفظ كلمة مروره المؤقتة.');
 }catch(err){flash(err.message,true)}finally{if(button)button.disabled=false}
});
el('dismissSecret').addEventListener('click',hideTemporaryPassword);
el('courseForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter;if(button)button.disabled=true;
 try{
  await api('courses',{name:el('courseName').value});
  el('courseForm').reset();await refreshAdmin();flash('تم إنشاء المقرر.');
 }catch(err){flash(err.message,true)}finally{if(button)button.disabled=false}
});
el('renameCourseSelect').addEventListener('change',()=>{
 const course=state.courses.find(c=>c.id===el('renameCourseSelect').value);
 el('renameCourseName').value=course?course.name:'';
});
el('renameCourseForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter;if(button)button.disabled=true;
 const courseId=el('renameCourseSelect').value,name=el('renameCourseName').value.trim();
 try{
  if(!courseId||!name)throw Error('اختار المقرر واكتب الاسم الجديد.');
  await api('courses/rename',{courseId,name});
  await refreshAdmin();flash('تم تعديل الاسم، بدون تغيير الطالبات أو الحضور.');
 }catch(err){flash(err.message,true)}finally{if(button)button.disabled=false}
});
el('assignForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter;if(button)button.disabled=true;
 const lecturerId=el('lecturerSelect').value,courseId=el('courseSelect').value;
 try{
  if(!lecturerId||!courseId)throw Error('اختار الدكتور والمقرر الأول.');
  await api('assignments',{lecturerId,courseId});
  await refreshAdmin();flash('تم تعيين المقرر للدكتور بنجاح.');
 }catch(err){flash(err.message,true)}finally{if(button)button.disabled=false}
});
el('rosterForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter;if(button)button.disabled=true;
 const courseId=el('rosterCourse').value;
 try{
  if(!courseId)throw Error('اختار المقرر الأول.');
  await api('lecturer/courses/'+courseId+'/students',{
   studentId:el('rosterRoll').value.trim(),studentName:el('rosterName').value.trim()
  });
  el('rosterForm').reset();await refreshRoster();flash('تم إضافة الطالبة للمقرر.');
 }catch(err){flash(err.message,true)}finally{if(button)button.disabled=false}
});
el('lectureForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const courseId=el('lectureCourse').value,title=el('lectureTitle').value;
 const radius=Number(el('lectureRadius').value);
 if(!courseId)return flash('اختار المقرر.',true);
 if(!navigator.geolocation)return flash('المتصفح مش بيدعم GPS.',true);
 const button=event.submitter;if(button)button.disabled=true;
 navigator.geolocation.getCurrentPosition(async ({coords})=>{
  try{
   const item=await api('lecturer/lectures',{
    courseId,title,radius,lat:coords.latitude,lng:coords.longitude,accuracy:coords.accuracy
   });
   el('lectureTitle').value='';await refreshLectures();
   state.selectedQr=item.id;await refreshQr();flash('تم إنشاء المحاضرة.');
  }catch(err){flash(err.message,true)}finally{if(button)button.disabled=false}
 },()=>{flash('اسمح للمتصفح باستخدام GPS الدقيق من داخل القاعة.',true);if(button)button.disabled=false},
 {enableHighAccuracy:true,timeout:15000,maximumAge:0});
});
el('changePasswordForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter;if(button)button.disabled=true;
 try{
  await api('password',{
   currentPassword:el('currentPassword').value,newPassword:el('newPassword').value
  });
  const destination=state.role==='superadmin'?'/admin':state.role==='lecturer'?'/lecturer':'/portal';
  el('changePasswordForm').reset();
  history.replaceState({},'',destination);setView(false);
  flash('تم تغيير كلمة المرور. سجّل دخولك بالجديدة.');
 }catch(err){flash(err.message,true)}finally{if(button)button.disabled=false}
});
refreshPortal();
