import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {createReadStream} from 'node:fs';
import {stat, mkdir, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {assetFiles} from './asset-files.js';

const root = fileURLToPath(new URL('../',import.meta.url));
const allowed = new Set(assetFiles.map(a=>a.file));
const mime = {'.json':'application/json','.geojson':'application/geo+json','.glb':'model/gltf-binary',
  '.md':'text/plain; charset=utf-8','.py':'text/plain; charset=utf-8','.blend':'application/octet-stream'};
let output,building=false;

export default defineConfig({
  plugins:[react(),{
    name:'local-colombo-assets',
    configResolved(config){output=path.resolve(config.root,config.build.outDir);building=config.command==='build';},
    configureServer(server){
      server.middlewares.use('/assets',async(req,res,next)=>{
        let file;
        try {file=decodeURIComponent((req.url||'').split('?')[0]).replace(/^\//,'');}
        catch {res.statusCode=400;res.end('Invalid asset path');return;}
        if(!allowed.has(file)){next();return;}
        if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.end();return;}
        try {
          const absolute=path.join(root,file), info=await stat(absolute);
          res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
          res.setHeader('Content-Length',info.size);
          res.setHeader('Cache-Control','no-cache');
          if(req.method==='HEAD'){res.end();return;}
          const stream=createReadStream(absolute);
          stream.on('error',()=>res.destroy());
          res.on('close',()=>stream.destroy());
          stream.pipe(res);
        } catch {res.statusCode=404;res.end('Asset file is missing');}
      });
    },
    async closeBundle(){
      if(!building)return;
      for(const file of allowed){
        const destination=path.join(output,'assets',file);
        await mkdir(path.dirname(destination),{recursive:true});
        await copyFile(path.join(root,file),destination);
      }
    }
  }],
  build:{chunkSizeWarningLimit:1000,rollupOptions:{input:{transitions:fileURLToPath(new URL('./transitions.html',import.meta.url)),main:fileURLToPath(new URL('./index.html',import.meta.url)),streetComposition:fileURLToPath(new URL('./street-composition.html',import.meta.url)),environment:fileURLToPath(new URL('./environment.html',import.meta.url)),vegetationReview:fileURLToPath(new URL('./vegetation-review.html',import.meta.url)),cyclist:fileURLToPath(new URL('./cyclist.html',import.meta.url)),walking:fileURLToPath(new URL('./walking.html',import.meta.url)),movement:fileURLToPath(new URL('./movement.html',import.meta.url))}}}
});
