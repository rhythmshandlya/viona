#!/usr/bin/env bash
# debug-sandbox.sh — Real-time debugging for sandbox agent sessions
# Usage: ./scripts/debug-sandbox.sh <project-id>
# Example: ./scripts/debug-sandbox.sh 2b6a9e02-8681-409b-8228-1309d7f1b0c3

set -euo pipefail

PROJECT_ID="${1:?Usage: debug-sandbox.sh <project-id>}"
CONTAINER="sandbox-${PROJECT_ID}"

# Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: Container ${CONTAINER} not found"
  echo "Running containers:"
  docker ps --format '{{.Names}}' | grep sandbox || echo "  (none)"
  exit 1
fi

# Get sandbox secret for API calls
SANDBOX_SECRET=$(docker exec "$CONTAINER" sh -c 'echo $SANDBOX_SECRET')
AGENT_PORT=$(docker port "$CONTAINER" 8081 | head -1 | cut -d: -f2)
FILE_PORT=$(docker port "$CONTAINER" 8080 | head -1 | cut -d: -f2)

echo "=== Sandbox Debug: ${PROJECT_ID} ==="
echo "Container: ${CONTAINER}"
echo "Agent port: ${AGENT_PORT}"
echo "File port: ${FILE_PORT}"
echo ""

case "${2:-status}" in
  # Show current status
  status)
    echo "--- Status ---"
    curl -s -H "Authorization: Bearer ${SANDBOX_SECRET}" "http://localhost:${AGENT_PORT}/status" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        const s=JSON.parse(d);
        console.log('Busy:', s.busy);
        console.log('Bundle version:', s.bundleVersion);
        console.log('Started at:', s.startedAt ? new Date(s.startedAt).toISOString() : 'n/a');
        console.log('Cost:', s.result?.cost ? '\$'+s.result.cost.toFixed(4) : 'n/a');
        console.log('Turns:', s.result?.numTurns ?? 'n/a');
        console.log('Session:', s.result?.sessionId ?? 'n/a');
        console.log('Error:', s.error ?? 'none');
        if(s.activeTasks?.length){console.log('Active tasks:');s.activeTasks.forEach(t=>console.log('  -',t.agent+':',t.action));}
        if(s.plan){console.log('Plan:',JSON.stringify(s.plan,null,2));}
      });"
    echo ""
    echo "--- Manifest Summary ---"
    curl -s -H "Authorization: Bearer ${SANDBOX_SECRET}" "http://localhost:${AGENT_PORT}/manifest" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        const m=JSON.parse(d);
        console.log('Duration:', (m.durationMs/1000).toFixed(1)+'s');
        console.log('Canvas:', m.canvas?.width+'x'+m.canvas?.height);
        console.log('Tracks:', m.tracks?.length);
        console.log('Items:', m.items?.length);
        const types={};(m.items||[]).forEach(i=>{types[i.type]=(types[i.type]||0)+1});
        console.log('Item types:', JSON.stringify(types));
      });"
    echo ""
    echo "--- Workspace Files ---"
    docker exec "$CONTAINER" sh -c 'find /workspace/src -type f -name "*.tsx" -o -name "*.ts" 2>/dev/null | sort'
    echo ""
    echo "--- Generation Progress ---"
    docker exec "$CONTAINER" sh -c 'cat /workspace/generation-progress.json 2>/dev/null' | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        try{const p=JSON.parse(d);console.log(JSON.stringify(p,null,2));}catch{console.log('No progress file');}
      });"
    ;;

  # Tail container logs with formatting
  logs)
    echo "--- Live Logs (Ctrl+C to stop) ---"
    docker logs -f "$CONTAINER" 2>&1 | node -e "
      const rl=require('readline').createInterface({input:process.stdin});
      rl.on('line',line=>{
        try{
          const o=JSON.parse(line);
          const t=new Date(o.time).toLocaleTimeString();
          const name=o.name||'?';
          const msg=o.msg||'';
          // Color coding
          let prefix='';
          if(o.level>=50) prefix='\x1b[31m[ERROR]\x1b[0m';
          else if(o.level>=40) prefix='\x1b[33m[WARN]\x1b[0m';
          else prefix='\x1b[36m[INFO]\x1b[0m';
          // Highlight key events
          if(msg.includes('Tool use')){
            console.log(t,prefix,'\x1b[35m'+name+'\x1b[0m',msg,o.tool?'-> '+o.tool:'');
          }else if(msg.includes('Tool result')){
            console.log(t,prefix,'\x1b[35m'+name+'\x1b[0m',msg);
          }else if(msg.includes('SDK result')){
            console.log(t,prefix,'\x1b[32m'+name+'\x1b[0m',msg,'cost=\$'+(o.totalCostUsd||0).toFixed(4),'turns='+o.numTurns);
          }else if(msg.includes('Session established')){
            console.log(t,prefix,'\x1b[32m'+name+'\x1b[0m',msg,'session='+o.sessionId);
          }else if(msg.includes('Bundle built')){
            console.log(t,prefix,'\x1b[32m'+name+'\x1b[0m',msg,'v'+o.version,'('+o.elapsed+'ms)');
          }else{
            console.log(t,prefix,name,msg);
          }
        }catch{
          // Non-JSON line
          console.log(line);
        }
      });"
    ;;

  # Watch transcript in real-time (polls session file)
  transcript)
    SESSION_ID="${3:-}"
    if [ -z "$SESSION_ID" ]; then
      # Get latest session from status
      SESSION_ID=$(curl -s -H "Authorization: Bearer ${SANDBOX_SECRET}" "http://localhost:${AGENT_PORT}/status" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const s=JSON.parse(d);console.log(s.result?.sessionId||'')})")
    fi
    if [ -z "$SESSION_ID" ]; then
      echo "No session ID found. Provide one: debug-sandbox.sh <project-id> transcript <session-id>"
      exit 1
    fi
    echo "--- Transcript: ${SESSION_ID} ---"
    docker exec "$CONTAINER" sh -c "cat /home/sandbox/.claude/projects/-workspace/${SESSION_ID}.jsonl" | node -e "
      const rl=require('readline').createInterface({input:process.stdin});
      let turn=0;
      rl.on('line',line=>{
        try{
          const o=JSON.parse(line);
          if(o.type==='user'){
            const content=o.message?.content||[];
            for(const c of content){
              if(c.type==='text'){turn++;console.log('\n\x1b[33m[Turn '+turn+'] USER:\x1b[0m',c.text.substring(0,500));}
              if(c.type==='tool_result'){console.log('\x1b[90m  TOOL_RESULT:\x1b[0m',JSON.stringify(c.content).substring(0,200));}
            }
          }else if(o.type==='assistant'){
            const content=o.message?.content||[];
            for(const c of content){
              if(c.type==='text'&&c.text)console.log('\x1b[36m  ASSISTANT:\x1b[0m',c.text.substring(0,500));
              if(c.type==='tool_use')console.log('\x1b[35m  TOOL:\x1b[0m',c.name,'->',JSON.stringify(c.input).substring(0,300));
              if(c.type==='thinking'&&c.thinking)console.log('\x1b[90m  THINKING:\x1b[0m',c.thinking.substring(0,300));
            }
          }
        }catch{}
      });"
    ;;

  # Watch workspace file changes
  watch)
    echo "--- Watching /workspace/src for changes (Ctrl+C to stop) ---"
    docker exec "$CONTAINER" sh -c '
      # Snapshot current state
      find /workspace/src -type f | sort > /tmp/watch-baseline.txt
      while true; do
        sleep 2
        find /workspace/src -type f | sort > /tmp/watch-current.txt
        diff /tmp/watch-baseline.txt /tmp/watch-current.txt | while read line; do
          case "$line" in
            ">"*) echo "[NEW] ${line:2}" ;;
            "<"*) echo "[DEL] ${line:2}" ;;
          esac
        done
        # Check for recently modified files
        find /workspace/src -type f -newer /tmp/watch-baseline.txt 2>/dev/null | while read f; do
          echo "[MOD] $f ($(stat -c%Y "$f" 2>/dev/null || echo ?))"
        done
        cp /tmp/watch-current.txt /tmp/watch-baseline.txt
      done
    '
    ;;

  # Show scene code that was generated
  scenes)
    echo "--- Generated Scene Files ---"
    docker exec "$CONTAINER" sh -c '
      for f in /workspace/src/scenes/*.tsx; do
        [ -f "$f" ] || continue
        echo "=== $(basename $f) ==="
        cat "$f"
        echo ""
      done
    ' || echo "No scene files yet"
    echo ""
    echo "--- Scene Registry ---"
    docker exec "$CONTAINER" sh -c 'cat /workspace/src/scene-registry.ts'
    ;;

  # Show constants and shared components
  shared)
    echo "--- constants.ts ---"
    docker exec "$CONTAINER" sh -c 'cat /workspace/src/constants.ts 2>/dev/null || echo "Not created yet"'
    echo ""
    echo "--- Components ---"
    docker exec "$CONTAINER" sh -c 'for f in /workspace/src/components/*.tsx; do [ -f "$f" ] || continue; echo "=== $(basename $f) ==="; cat "$f"; echo; done'
    ;;

  # Show full cost breakdown
  cost)
    echo "--- Session Cost History ---"
    docker exec "$CONTAINER" sh -c 'ls -lt /home/sandbox/.claude/projects/-workspace/*.jsonl 2>/dev/null | head -10' | while read line; do
      echo "$line"
    done
    echo ""
    echo "--- Current Session ---"
    curl -s -H "Authorization: Bearer ${SANDBOX_SECRET}" "http://localhost:${AGENT_PORT}/status" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        const s=JSON.parse(d);
        if(s.result){
          console.log('Session:', s.result.sessionId);
          console.log('Cost: \$'+(s.result.cost||0).toFixed(4));
          console.log('Turns:', s.result.numTurns);
        }else{console.log('No completed session');}
      });"
    ;;

  *)
    echo "Commands:"
    echo "  status     - Show sandbox status, manifest summary, workspace files"
    echo "  logs       - Tail container logs with color formatting"
    echo "  transcript [session-id] - Show parsed transcript for a session"
    echo "  watch      - Watch workspace/src for file changes in real-time"
    echo "  scenes     - Show generated scene code"
    echo "  shared     - Show constants and shared components"
    echo "  cost       - Show cost breakdown"
    ;;
esac
