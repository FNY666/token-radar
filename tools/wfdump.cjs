// Prints the final assistant text of each agent in a workflow run directory.
const fs=require('node:fs'),path=require('node:path');
const dir=process.argv[2];
const j=path.join(dir,'journal.jsonl');
if(fs.existsSync(j)) for(const l of fs.readFileSync(j,'utf8').split('\n').filter(Boolean)){
  let o; try{o=JSON.parse(l)}catch{continue}
  if(o.type==='agent_result'||o.result||o.output){
    const s=typeof o.result==='string'?o.result:JSON.stringify(o.result||o.output||'',null,1);
    if(s&&s.length>40) console.log('--- '+(o.label||o.agentId||'?')+'\n'+s);
  }
}
