'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..','public',name),'utf8');

test('responsive RTL staff portal keeps every JS-dependent element reachable',()=>{
 const html=read('portal.html'),js=read('app-v2.js'),css=read('app-v2.css');
 assert.match(html,/<html lang="ar" dir="rtl">/);
 const jsIds=[...new Set([...js.matchAll(/\bel\('([^']+)'\)/g)].map(m=>m[1]))];
 assert.ok(jsIds.length>=40,'test is exercising the real staff portal bindings');
 for(const id of jsIds)assert.ok(html.includes('id="'+id+'"'),'Missing portal element '+id);
 for(const id of ['loginForm','adminControls','lecturerControls','adminNav','lecturerNav',
  'rosterSearch','rosterList','rosterPagination','changePasswordForm','temporaryPasswordCard'])
  assert.ok(html.includes('id="'+id+'"'),id+' expected');
 for(const route of ['overview','lecturers','courses','assignments','roster','lectures','security'])
  assert.ok(html.includes('data-page="'+route+'"'),'Missing role panel '+route);
 for(const gate of ['superadmin','lecturer','student'])
  assert.ok(html.includes('data-gateway="'+gate+'"'),'Visible gate missing: '+gate);
 for(const field of ['entryEyebrow','entryTitle','entryEmphasis','entryDescription','loginTitle','loginDescription'])
  assert.ok(html.includes('id="'+field+'"'),'Missing separate gate title: '+field);
 assert.match(js,/function showEntryGate\(/,'staff routes should show dedicated admin/lecturer copy');
 assert.match(js,/server_error/i,'backend failures must be translated for the user');
 assert.match(js,/lecturers\/password\/reset/,'admin UI must call the scoped reset endpoint');
 assert.match(js,/إعادة تعيين الباسورد/,'lecturer list must have reset action');
 assert.match(js,/hideTemporaryPassword\(\)/,'admin must be able to dismiss the one-time secret');
 assert.ok(html.includes('id="tempPasswordHeading"'),'one-time password notice should identify the selected doctor');
 assert.doesNotMatch(html,/value="[^"]*temporaryPassword"/,'never embed temporary password in page source');
 assert.ok(css.includes('@media(max-width:580px)'),'mobile layout breakpoint');
 assert.ok(css.includes('[hidden]{display:none!important}'),'hidden sections must stay concealed');
 assert.doesNotMatch(js,/\.innerHTML\s*=/,'dynamic academic records must use safe DOM APIs');
});

test('public home and student help never request identity or bypass disabled attendance',()=>{
 const home=read('index.html'),student=read('student-guide.html'),checkin=read('checkin.html');
 for(const file of [home,student,checkin])assert.match(file,/<html lang="ar" dir="rtl">/);
 for(const route of ['/admin','/lecturer','/student'])assert.ok(home.includes('href="'+route+'"'));
 assert.doesNotMatch(student,/<input\b/i,'student guide is informational only');
 assert.match(student,/غير مفعّل حاليًا/,'accurate readiness notice');
 assert.match(checkin,/id="roll"/);
 assert.match(checkin,/id="fullName"/);
 assert.match(checkin,/id="checkinForm"/);
 for(const file of [home,student,checkin])
  assert.doesNotMatch(file,/\bstyle="/i,'inline style would violate strict Content Security Policy');
});
