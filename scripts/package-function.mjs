import {zipFunctions} from '@netlify/zip-it-and-ship-it';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts/functions',{recursive:true});
const result=await zipFunctions('artifacts/staging','artifacts/functions',{config:{'*':{nodeBundler:'none'}},archiveFormat:'zip'});
await writeFile('artifacts/function-manifest.json',JSON.stringify(result,null,2));
if(result.length!==1||result[0].name!=='game')throw Error('Expected exactly the game function');
console.log('Netlify packaged game function:',result[0].path);
