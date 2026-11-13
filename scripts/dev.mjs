// Accept both ordinary local development and managed-preview CLI arguments.
import {spawn} from 'node:child_process';
const args=process.argv.slice(2),value=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const child=spawn('python3',['-m','http.server',value('--port','8080'),'--bind',value('--host','127.0.0.1'),'--directory','dist'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
