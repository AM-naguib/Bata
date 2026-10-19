'use strict';
// Generate a genuine Excel 2007+ .xlsx using only Node core. No extra
// dependency, no temporary files, and all cells are XML-escaped inline strings
// or numeric values (never spreadsheet formula cells).
const zlib=require('node:zlib');
const crcTable=Array.from({length:256},(_,n)=>{
 let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
 return c>>>0;
});
function crc32(buffer){
 let c=0xffffffff;
 for(const b of buffer)c=crcTable[(c^b)&255]^(c>>>8);
 return (c^0xffffffff)>>>0;
}
function xml(value){
 return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function col(i){
 let name='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;
 return name;
}
function cell(value,r,c,{header=false,percentage=false}={}){
 if(value===null||value===undefined||value==='')return '';
 const address=col(c)+r,style=header?' s="1"':percentage?' s="2"':'';
 if(typeof value==='number'&&Number.isFinite(value))return '<c r="'+address+'"'+style+'><v>'+value+'</v></c>';
 return '<c r="'+address+'" t="inlineStr"'+style+'><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
}
function sheet(rows,{headerAt=1,percentColumns=[]}={}){
 const percent=new Set(percentColumns);
 const body=rows.map((values,index)=>{
  const row=index+1,header=row===headerAt;
  return '<row r="'+row+'">'+values.map((v,c)=>cell(v,row,c,{header,percentage:!header&&percent.has(c)})).join('')+'</row>';
 }).join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0"/></sheetViews>'+
 '<sheetFormatPr defaultRowHeight="21"/><sheetData>'+body+'</sheetData></worksheet>';
}
function zip(parts){
 const locals=[],central=[];let offset=0;
 for(const [name,source] of parts){
  const data=Buffer.from(source,'utf8'),packed=zlib.deflateRawSync(data,{level:6}),path=Buffer.from(name);
  const hash=crc32(data),local=Buffer.alloc(30),directory=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt16LE(8,8);local.writeUInt32LE(hash,14);
  local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);
  local.writeUInt16LE(path.length,26);
  const chunk=Buffer.concat([local,path,packed]);locals.push(chunk);
  directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);
  directory.writeUInt16LE(20,6);directory.writeUInt16LE(8,10);
  directory.writeUInt32LE(hash,16);directory.writeUInt32LE(packed.length,20);
  directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(path.length,28);
  directory.writeUInt32LE(offset,42);
  central.push(Buffer.concat([directory,path]));
  offset+=chunk.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(parts.length,8);end.writeUInt16LE(parts.length,10);
 end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,...central,end]);
}
const BOOK='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
 ['الملخص','المحاضرات','تفاصيل الحضور'].map((name,i)=>'<sheet name="'+name+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+
 '</sheets></workbook>';
const STYLES='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts>'+
 '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF087E79"/><bgColor indexed="64"/></patternFill></fill></fills>'+
 '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
 '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
 '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
 '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>'+
 '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'+
 '</styleSheet>';
function excelForReport(report){
 const summary=[
  ['حاضر | تقرير الحضور والغياب'],
  ['المقرر',report.courseName],
  ['المحاضرات المغلقة',report.totalLectures],
  ['الطالبات المقيدات',report.totalStudents],
  ['رقم الجلوس','اسم الطالبة','محاضرات مستحقة','حضور','غياب','نسبة الحضور']
 ];
 for(const s of report.students)summary.push([s.rollNumber,s.fullName,s.eligible,s.attended,s.absent,
  s.percentage===null?'لا توجد محاضرات مستحقة':s.percentage/100]);
 const lectures=[['اسم المحاضرة','تاريخ الإغلاق','الطالبات المستحقات','حضور','غياب']];
 for(const l of report.lectures)lectures.push([l.title,l.closedAt,l.eligible,l.present,l.absent]);
 const matrix=[['رقم الجلوس','اسم الطالبة',...report.lectures.map(l=>l.title+' ('+l.closedAt.slice(0,10)+')')]];
 const translation={present:'حاضر',absent:'غائب','not-enrolled':'غير مقيّدة وقتها'};
 for(const s of report.students)matrix.push([s.rollNumber,s.fullName,...s.lectureStatuses.map(v=>translation[v]||'غير معروف')]);
 const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
 '<Default Extension="xml" ContentType="application/xml"/>'+
 '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
 '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
 [1,2,3].map(i=>'<Override PartName="/xl/worksheets/sheet'+i+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+
 '</Types>';
 const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const bookRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
 [1,2,3].map(i=>'<Relationship Id="rId'+i+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+i+'.xml"/>').join('')+
 '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
 '</Relationships>';
 return zip([
  ['[Content_Types].xml',contentTypes],
  ['_rels/.rels',rootRels],
  ['xl/workbook.xml',BOOK],
  ['xl/_rels/workbook.xml.rels',bookRels],
  ['xl/styles.xml',STYLES],
  ['xl/worksheets/sheet1.xml',sheet(summary,{headerAt:5,percentColumns:[5]})],
  ['xl/worksheets/sheet2.xml',sheet(lectures)],
  ['xl/worksheets/sheet3.xml',sheet(matrix)]
 ]);
}
module.exports={excelForReport};
