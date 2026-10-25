import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {readFile,writeFile} from 'node:fs/promises';
const zip=await JSZip.loadAsync(await readFile('artifacts/functions/game.zip'));
for(const entry of ['game.mjs','___netlify-entry-point.mjs','___netlify-bootstrap.mjs','___netlify-metadata.json'])assert(zip.file(entry),'Missing packaged function file: '+entry);
const manifest=JSON.parse(await readFile('artifacts/function-manifest.json','utf8'))[0];assert.equal(manifest.runtimeAPIVersion,2);assert.deepEqual(manifest.routes,[]);
await writeFile('artifacts/tests/deployed-game.mjs',await zip.file('game.mjs').async('string'));
const context={siteID:'local-contract-test',token:'test-only-not-a-real-credential',edgeURL:'https://eventual.blobs.invalid',uncachedEdgeURL:'https://strong.blobs.invalid',primaryRegion:'us-east-2'};
globalThis.netlifyBlobsContext=Buffer.from(JSON.stringify(context)).toString('base64');
const originalFetch=globalThis.fetch,records=new Map(),calls=[];let version=0,conflicts=0;
globalThis.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url??input.toString());assert.equal(url.hostname,'strong.blobs.invalid','All SDK operations must use strong consistency');const method=(init.method||'GET').toUpperCase(),headers=new Headers(init.headers),key=url.pathname;calls.push({method,key,ifMatch:headers.get('if-match'),ifNew:headers.get('if-none-match')});const row=records.get(key);
 if(method==='GET'){await Promise.resolve();return row?new Response(row.body,{headers:{etag:row.etag,'content-type':'application/json'}}):new Response(null,{status:404});}
 if(method==='PUT'){
  assert(headers.has('if-match')||headers.get('if-none-match')==='*','Every mutation must be conditional');
  if((headers.get('if-none-match')==='*'&&row)||(headers.has('if-match')&&headers.get('if-match')!==row?.etag)){conflicts++;return new Response(null,{status:412});}
  const etag='"sdk-'+(++version)+'"';records.set(key,{body:init.body,etag});return new Response(null,{status:200,headers:{etag}});
 }
 throw Error('Unexpected Blobs request '+method);
};
try{
const {default:handler}=await import('../artifacts/tests/deployed-game.mjs');const {puzzles}=await import('../artifacts/tests/puzzles.mjs');const ids=[crypto.randomUUID(),crypto.randomUUID()];let code;
async function post(action,i=0,extra={}){const res=await handler(new Request('https://example.netlify.app/.netlify/functions/game',{method:'POST',body:JSON.stringify({action,id:ids[i],name:i?'Bob':'Alice',code,...extra})}));const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data;}
code=(await post('create')).code;await post('join',1);await post('start');let final;
for(let round=0;round<9;round++){if(round===1)await post('hint',0);await Promise.all([post('answer',0,{answer:puzzles[round].a[0]}),post('answer',1,{answer:round===2?'wrong':puzzles[round].a[0]})]);final=await post('next',0,{round});}
assert.equal(final.phase,'finished');assert.equal(final.players[0].score,1750);assert.equal(final.players[1].score,1700);assert(conflicts>0);const winner=[...final.players].sort((a,b)=>b.score-a.score)[0].name;assert.equal(winner,'Alice');
const result={passed:true,packager:'@netlify/zip-it-and-ship-it',runtimeAPIVersion:manifest.runtimeAPIVersion,packagedHandlerExecuted:true,storage:'Real @netlify/blobs SDK against an in-memory HTTP contract emulator (not a live Netlify deployment)',rounds:9,players:2,scores:{Alice:1750,Bob:1700},winner,strongConsistencyRequests:calls.length,conditionalConflictsRetried:conflicts};await writeFile('artifacts/packaged-function-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{globalThis.fetch=originalFetch;delete globalThis.netlifyBlobsContext;}
