const { app } = require("electron");
const fs=require("fs"); const path=require("path"); const os=require("os"); const AdmZip=require("adm-zip");
const { execFile }=require("child_process");
app.whenReady().then(async()=>{
  const inst=path.join(os.tmpdir(),"testinst"); fs.rmSync(inst,{recursive:true,force:true}); fs.mkdirSync(inst+"/resources",{recursive:true});
  fs.writeFileSync(inst+"/resources/app.asar","OLD",'ascii');
  const x=path.join(os.tmpdir(),"textx"); fs.rmSync(x,{recursive:true,force:true}); fs.mkdirSync(x+"/resources",{recursive:true});
  const zip=new AdmZip("release/V1.0.1044/update-patch.zip");
  for(const en of zip.getEntries()){ const rel=en.entryName.replace(/\\/g,"/"); if(rel.includes("..")||path.isAbsolute(rel))continue; const isAsar=rel==="resources/app.asar"; const dst= isAsar?path.join(x,"resources","app.asar.pending"):path.join(x,rel.split("/").join(path.sep)); fs.mkdirSync(path.dirname(dst),{recursive:true}); fs.writeFileSync(dst,en.getData()); }
  const childScript="const fs=require('fs'),path=require('path');const src=process.argv[1],dst=process.argv[2];let n=0;(function mv(from,to){for(const e of fs.readdirSync(from,{withFileTypes:true})){const s=path.join(from,e.name),d=path.join(to,e.name);if(e.isDirectory()){fs.mkdirSync(d,{recursive:true});mv(s,d);}else{fs.mkdirSync(path.dirname(d),{recursive:true});if(e.name==='app.asar.pending'){fs.renameSync(s,path.join(to,'app.asar'));}else{fs.copyFileSync(s,d);}n++;}}})(src,dst);console.log('APPLIED='+n);";
  const t0=Date.now();
  const applied=await new Promise((res,rej)=>{ execFile(process.execPath,["-e",childScript,x,inst],{env:Object.assign({},process.env,{ELECTRON_RUN_AS_NODE:"1"}),timeout:60000},(err,stdout)=>{ if(err)rej(err); else { const m=String(stdout).match(/APPLIED=(\d+)/); res(m?Number(m[1]):0); } }); });
  const asar=inst+"/resources/app.asar"; const now=fs.readFileSync(asar);
  console.log("部署耗时ms:",Date.now()-t0,"applied:",applied,"asar已替换(非OLD):",!now.includes("OLD"),"asar大小:",now.length);
  fs.rmSync(inst,{recursive:true,force:true}); fs.rmSync(x,{recursive:true,force:true}); app.quit();
});
