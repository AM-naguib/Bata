const test=require('node:test');
const assert=require('node:assert/strict');
const {hashPassword,verifyPassword,validPassword}=require('../lib/passwords');
test('passwords use fresh salts, never plaintext, and verify correctly',async()=>{
 const pass='a-secret-password-for-testing';
 const one=await hashPassword(pass),two=await hashPassword(pass);
 assert.notEqual(one,two);
 assert.ok(!one.includes(pass));
 assert.equal(await verifyPassword(pass,one),true);
 assert.equal(await verifyPassword('wrong-password',one),false);
 assert.equal(await verifyPassword(pass,one.replace(/.$/,'x')),false);
 assert.equal(await verifyPassword(pass,'invalid:hash'),false);
});
test('reject weak passwords and oversized values',async()=>{
 assert.equal(validPassword('1234'),false);
 assert.equal(validPassword('a'.repeat(257)),false);
 await assert.rejects(hashPassword('1234'));
 await assert.rejects(hashPassword('a'.repeat(257)));
});
