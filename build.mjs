import {build} from './compiler.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('dist/assets',{recursive:true});
await build({entryPoints:['src/main.tsx'],bundle:true,minify:true,format:'esm',target:'es2022',outdir:'dist/assets',entryNames:'game',define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
await writeFile('dist/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Mind Ladder: a guessing party game for 2–8 players"><title>Mind Ladder — Think together</title><link rel="stylesheet" href="/assets/game.css"></head><body><div id="root"></div><script type="module" src="/assets/game.js"></script></body></html>');
await mkdir('artifacts/staging',{recursive:true});
await build({entryPoints:['netlify/functions/game.ts'],bundle:true,minify:false,format:'esm',platform:'node',target:'node22',outfile:'artifacts/staging/game.mjs',banner:{js:"import {createRequire as __nodeCreateRequire} from 'node:module'; const require = __nodeCreateRequire(import.meta.url);"},logLevel:'warning'});
console.log('Production frontend and function built successfully.');

