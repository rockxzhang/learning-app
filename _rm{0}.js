const { Client } = require('ssh2');
const conn = new Client();
const CMD = `/opt/node/bin/node -e "const fs=require('fs');const d='/opt/zhangjiang-server/data';let u=JSON.parse(fs.readFileSync(d+'/users.json','utf8'));let g=JSON.parse(fs.readFileSync(d+'/usage.json','utf8'));const before=u.length;const u2=u.filter(x=>!String(x.username||'').includes('陈九霖'));const g2=g.filter(x=>!String(x.username||'').includes('陈九霖'));fs.writeFileSync(d+'/users.json',JSON.stringify(u2,null,2));fs.writeFileSync(d+'/usage.json',JSON.stringify(g2,null,2));console.log('users',before,'->',u2.length,'| usage',g.length,'->',g2.length);console.log('陈九霖 in users:', u.some(x=>String(x.username||'').includes('陈九霖')));"`
conn.on('ready', () => {
  conn.exec(CMD, (err, stream) => {
    if (err) { console.log('EXEC ERR', err.message); conn.end(); return; }
    let o=''; stream.on('data', d => o += d); stream.stderr.on('data', d => o += d);
    stream.on('close', () => { console.log(o); conn.end(); });
  });
}).on('error', (e) => { console.log('CONN ERR', e.message); process.exit(1); });
conn.connect({ host: '47.115.202.192', port: 22, username: 'root', password: 'XZ_jackyso5', readyTimeout: 25000 });
