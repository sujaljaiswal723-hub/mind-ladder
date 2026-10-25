import {build} from './compiler.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('artifacts/tests',{recursive:true});
await build({entryPoints:['server/game.ts'],bundle:true,platform:'node',format:'esm',outfile:'artifacts/tests/core.mjs'});
const {createGameHandler}=await import('../artifacts/tests/core.mjs');
await build({entryPoints:['server/puzzles.ts'],bundle:true,platform:'node',format:'esm',outfile:'artifacts/tests/puzzles.mjs'});
const {puzzles}=await import('../artifacts/tests/puzzles.mjs');
class ConditionalStore {
  rows=new Map();version=0;conflicts=0;
  async getWithMetadata(key){const row=this.rows.get(key);await Promise.resolve();return row?structuredClone(row):null;}
  async setJSON(key,data,options){const row=this.rows.get(key);if((options.onlyIfNew&&row)||(options.onlyIfMatch&&row?.etag!==options.onlyIfMatch)){this.conflicts++;return {modified:false};}this.rows.set(key,{data:structuredClone(data),etag:'"'+(++this.version)+'"'});return {modified:true};}
}
const reports=[];
async function completeGame(count){const store=new ConditionalStore(),handler=createGameHandler(store,puzzles.slice(0,count)),ids=[crypto.randomUUID(),crypto.randomUUID()];let code;
async function send(action,i=0,extra={}){const res=await handler(new Request('https://example.netlify.app/.netlify/functions/game',{method:'POST',body:JSON.stringify({action,id:ids[i],name:i?'Bob':'Alice',code,...extra})}));return {status:res.status,data:await res.json()};}
let result=await send('create');assert.equal(result.status,200);code=result.data.code;assert.equal((await send('start')).status,400);assert.equal((await send('join',1)).data.players.length,2);assert.equal((await send('start',1)).status,400);await send('start');
for(let round=0;round<count;round++){
 const hidden=await handler(new Request('https://example.netlify.app/.netlify/functions/game?code='+code+'&id='+ids[1]));const state=await hidden.json();assert.equal(state.puzzle.solution,undefined);assert(!JSON.stringify(state).includes(ids[0]));
 if(round===1)await send('hint',0);
 const answers=await Promise.all([send('answer',0,{answer:puzzles[round].a[0].toUpperCase()}),send('answer',1,{answer:round===2?'wrong':puzzles[round].a[0]})]);answers.forEach(a=>assert.equal(a.status,200));
 assert.equal((await send('answer',0,{answer:'change'})).status,400);
 const view=await handler(new Request('https://example.netlify.app/.netlify/functions/game?code='+code+'&id='+ids[0]));const reveal=await view.json();assert.equal(reveal.phase,'reveal');assert.equal(reveal.puzzle.solution,puzzles[round].a[0]);
 result=await send('next',0,{round});assert.equal(result.status,200);
}
assert.equal(result.data.phase,'finished');const alice=result.data.players[0],bob=result.data.players[1];assert.equal(alice.score,count===3?250:1750);assert.equal(bob.score,count===3?200:1700);const winner=[...result.data.players].sort((a,b)=>b.score-a.score)[0];assert.equal(winner.name,'Alice');assert(store.conflicts>0,'Concurrent answers must exercise conditional-write retries');
reports.push({test:`Complete ${count}-round two-player game`,passed:true,scores:{Alice:alice.score,Bob:bob.score},winner:winner.name,conditionalConflictsRetried:store.conflicts});
assert.equal((await send('restart')).data.phase,'lobby');await send('start');const row=store.rows.get(code);row.data.deadline=Date.now()-1;assert.equal((await send('answer',0,{answer:'keyboard'})).status,400);assert.equal((await handler(new Request('https://example.netlify.app/.netlify/functions/game',{method:'DELETE'}))).status,405);
}
await completeGame(3);await completeGame(9);
const frontend=await readFile('dist/assets/game.js','utf8');assert(frontend.includes('/.netlify/functions/game'));assert(!frontend.includes('/api/game'));assert(!frontend.includes('getStore'));const fn=await readFile('netlify/functions/game.ts','utf8');assert(fn.includes("consistency: 'strong'"));assert(!fn.includes('config.path'));reports.push({test:'Direct function URL, strong consistency, no routing overrides or server secrets in frontend',passed:true});
await writeFile('artifacts/test-results.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));

