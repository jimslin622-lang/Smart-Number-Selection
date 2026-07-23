@echo off
setlocal
node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(console.log).catch(e=>{console.error(e);process.exit(1)})"
