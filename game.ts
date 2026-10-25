
import {puzzles as defaultPuzzles} from './puzzles';
import type {Store} from '@netlify/blobs';
export type RoomStore = Pick<Store,'getWithMetadata'|'setJSON'>;
export function createGameHandler(store:RoomStore, puzzles=defaultPuzzles){
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const json=(s:any,status=200)=>Response.json(s,{status,headers:{'Cache-Control':'no-store'}});
function revealed(s:any){return s.phase==='play'&&(Date.now()>=s.deadline||s.players.every((p:any)=>s.answers[p.id]));}
function view(s:any,id:string){const reveal=revealed(s),p=puzzles[s.round];return {code:s.code,host:s.host===id?id:'other-host',phase:reveal?'reveal':s.phase,round:s.round,deadline:s.deadline,serverTime:Date.now(),players:s.players.map((x:any)=>({...x,id:x.id===id?id:'player-'+s.players.indexOf(x),score:x.score+(reveal?(s.answers[x.id]?.correct?(Math.floor(s.round/3)+1)*100/(s.hints[x.id]?2:1):0):0),submitted:!!s.answers[x.id],...(reveal?{answer:s.answers[x.id]?.text||'No answer',correct:!!s.answers[x.id]?.correct}: {})})),puzzle:s.phase==='play'?{type:p.type,q:p.q,...(s.hints[id]?{hint:p.hint}:{}),...(reveal?{solution:p.a[0],why:p.why}:{})}:null,usedHint:!!s.hints[id],submitted:!!s.answers[id]};}
async function GET(req:Request){try{const u=new URL(req.url),code=u.searchParams.get('code')||'',id=u.searchParams.get('id')||'';const row:any=await store.getWithMetadata(code,{type:'json'});if(!row)return json({error:'Room not found. Check the code.'},404);const s=structuredClone(row.data);if(!s.players.some((p:any)=>p.id===id))return json({error:'Join this room first.'},403);return json(view(s,id));}catch{return json({error:'Connection interrupted. Retrying…'},503);}}
async function POST(req:Request){try{const b=await req.json() as any; const id=b.id;if(!/^[a-f0-9-]{36}$/.test(id||''))return json({error:'Invalid player session.'},400);const name=String(b.name||'').trim().slice(0,20);if(b.action==='create'){if(!name)return json({error:'Enter your name.'},400);for(let i=0;i<5;i++){const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');const s={code,host:id,players:[{id,name,score:0}],phase:'lobby',round:0,deadline:0,answers:{},hints:{}};const r=await store.setJSON(code,s,{onlyIfNew:true});if(r.modified)return json(view(s,id));}throw Error();}
for(let attempt=0;attempt<8;attempt++){const row:any=await store.getWithMetadata(String(b.code).toUpperCase(),{type:'json'});if(!row)return json({error:'Room not found. Check the code.'},404);const s=structuredClone(row.data),player=s.players.find((p:any)=>p.id===id),host=s.host===id;
if(b.action==='join'){if(!player){if(!name)return json({error:'Enter your name.'},400);if(s.phase!=='lobby')return json({error:'This game has started. Join the next one.'},400);if(s.players.length>=8)return json({error:'This room already has 8 players.'},400);s.players.push({id,name,score:0});}}
else {if(!player)return json({error:'Join the room first.'},403);
if(b.action==='start'){if(!host||s.phase!=='lobby'||s.players.length<2)return json({error:'The host can start once 2 players have joined.'},400);s.phase='play';s.deadline=Date.now()+45000;}
else if(b.action==='hint'){if(s.phase!=='play'||revealed(s)||s.answers[id])return json({error:'Hints are only available before answering.'},400);s.hints[id]=true;}
else if(b.action==='answer'){if(s.phase!=='play'||revealed(s)||s.answers[id])return json({error:'This round is closed or your answer is already locked.'},400);const text=String(b.answer||'').trim().slice(0,120);if(!text)return json({error:'Type an answer first.'},400);s.answers[id]={text,correct:puzzles[s.round].a.some(a=>norm(a)===norm(text))};}
else if(b.action==='next'){if(!host||!revealed(s)||b.round!==s.round)return json({error:'Wait for the current round to finish.'},400);s.players.forEach((p:any)=>{if(s.answers[p.id]?.correct)p.score+=(Math.floor(s.round/3)+1)*100/(s.hints[p.id]?2:1);});if(s.round===puzzles.length-1)s.phase='finished';else{s.round++;s.deadline=Date.now()+45000;}s.answers={};s.hints={};}
else if(b.action==='restart'){if(!host||s.phase!=='finished')return json({error:'Only the host can start a rematch after the game.'},400);s.phase='lobby';s.round=0;s.players.forEach((p:any)=>p.score=0);s.answers={};s.hints={};}
else return json({error:'Unknown action.'},400);}
if(!row.etag)throw Error('Missing room ETag');const result=await store.setJSON(s.code,s,{onlyIfMatch:row.etag});if(result.modified)return json(view(s,id));}return json({error:'Room is busy. Try again.'},409);
}catch{return json({error:'Could not connect. Please try again.'},503);}}


return async function handler(req:Request):Promise<Response>{if(req.method==='GET')return GET(req);if(req.method==='POST')return POST(req);return new Response(null,{status:405,headers:{Allow:'GET, POST'}});};
}


