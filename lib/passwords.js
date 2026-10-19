'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const N=32768, KEYLEN=64;
function validPassword(password) {
  return typeof password==='string' && Buffer.byteLength(password,'utf8')>=12 &&
    Buffer.byteLength(password,'utf8')<=256 && !password.includes('\0');
}
async function hashPassword(password) {
  if(!validPassword(password))throw new Error('Password must be 12-256 UTF-8 bytes');
  const salt=crypto.randomBytes(24);
  const key=await scrypt(password,salt,KEYLEN,{N,r:8,p:1,maxmem:64*1024*1024});
  return ['scrypt','v1',String(N),salt.toString('hex'),key.toString('hex')].join(':');
}
async function verifyPassword(password,stored) {
  if(typeof password!=='string'||Buffer.byteLength(password,'utf8')>256||typeof stored!=='string')return false;
  const chunks=stored.split(':');
  if(chunks.length!==5||chunks[0]!=='scrypt'||chunks[1]!=='v1'||chunks[2]!==String(N))return false;
  const saltHex=chunks[3],hashHex=chunks[4];
  if(!/^[a-f0-9]{48}$/.test(saltHex)||!/^[a-f0-9]{128}$/.test(hashHex))return false;
  const key=await scrypt(password,Buffer.from(saltHex,'hex'),KEYLEN,{N,r:8,p:1,maxmem:64*1024*1024});
  return crypto.timingSafeEqual(key,Buffer.from(hashHex,'hex'));
}
module.exports={hashPassword,verifyPassword,validPassword};
