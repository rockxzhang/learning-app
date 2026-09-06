const { execFile }=require("child_process"); const fs=require("fs");
const src="D:\\Hydro\\learning-app\\release\\V1.0.1043\\update-patch.zip";
const dest="C:\\Users\\rockxzhang\\Hydro\\tts_test\\我的 测试 路径\\_x";
fs.rmSync(dest,{recursive:true,force:true}); fs.mkdirSync(dest,{recursive:true});
const cmd='Expand-Archive -Force -Path "'+src+'" -DestinationPath "'+dest+'"';
execFile("powershell",["-NoProfile","-ExecutionPolicy","Bypass","-Command",cmd],(err)=>{
  if(err){ console.log("解压失败(含中文/空格路径):", err.code, err.message); }
  else { console.log("解压成功, 含asar=", fs.existsSync(dest+"\\resources\\app.asar")); }
  fs.rmSync(dest,{recursive:true,force:true});
});
