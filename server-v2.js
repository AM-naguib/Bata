'use strict';
// Multi-account portal preview ONLY. Legacy student/attendance APIs are unavailable here.
const http=require('node:http');
const {Pool}=require('pg');
const {createHandler}=require('./lib/http-app');
const url=process.env.DATABASE_URL;
if(!url||!/^postgres(?:ql)?:\/\//.test(url))throw Error('DATABASE_URL required; private Neon URL must never be checked into Git');
if(process.env.NODE_ENV==='production'&&!process.env.PUBLIC_ORIGIN)throw Error('PUBLIC_ORIGIN=https://your-site.example required');
const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:10000, idleTimeoutMillis:30000});
const port=Number(process.env.PORT||3000);
const server=http.createServer(createHandler(pool));
server.requestTimeout=15000;
server.headersTimeout=10000;
server.listen(port,'0.0.0.0',()=>console.log('Attendify portal listening on port '+port));
const stop=()=>server.close(()=>pool.end().then(()=>process.exit(0)));
process.on('SIGTERM',stop);process.on('SIGINT',stop);
