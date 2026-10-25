// Run esbuild's WebAssembly API in-process for portable builds (no native binary).
import esbuild from 'esbuild-wasm/lib/browser.js';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire,builtinModules} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.self ??= globalThis;
await esbuild.initialize({wasmModule:await WebAssembly.compile(readFileSync(require.resolve('esbuild-wasm/esbuild.wasm'))),worker:false});
const filesystem={name:'portable-filesystem',setup(build){
 build.onResolve({filter:/.*/},args=>{
  if(args.path.startsWith('http:')||args.path.startsWith('https:')||args.path.startsWith('node:')||builtinModules.includes(args.path))return {path:args.path,external:true};
  const base=args.importer?path.dirname(args.importer):process.cwd();let file;
  if(args.kind==='entry-point'||args.path.startsWith('.')||path.isAbsolute(args.path)){
   const target=path.resolve(base,args.path);file=[target,target+'.ts',target+'.tsx',target+'.js',target+'.mjs',path.join(target,'index.js')].find(p=>existsSync(p));
  }else file=createRequire(path.join(base,'package.json')).resolve(args.path);
  if(!file)throw Error('Cannot resolve '+args.path);return {path:file,namespace:'local-file'};
 });
 build.onLoad({filter:/.*/,namespace:'local-file'},args=>({contents:readFileSync(args.path,'utf8'),loader:({'.ts':'ts','.tsx':'tsx','.css':'css','.json':'json'})[path.extname(args.path)]||'js',resolveDir:path.dirname(args.path)}));
}};
export async function build(options){const destination=options.outfile?path.dirname(path.resolve(options.outfile)):path.resolve(options.outdir);const output=await esbuild.build({...options,...(options.outfile?{outfile:'/output/'+path.basename(options.outfile)}:{outdir:'/output'}),write:false,plugins:[filesystem]});const {mkdir,writeFile}=await import('node:fs/promises');for(const file of output.outputFiles){const target=path.join(destination,path.posix.basename(file.path));await mkdir(path.dirname(target),{recursive:true});await writeFile(target,file.contents);}return output;}

