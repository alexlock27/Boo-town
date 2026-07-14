// tests/sim-blocks.mjs — Boo Blocks (RUN9 C2) self-play simulation to justify the star
// score bands. Pure Node (no browser): it replicates the game's board, piece bag, scoring
// (cells + line-clears with simultaneous² multiply + cascade streak + all-clear bonus) and
// the Boo Boost specials, then plays N greedy rounds and reports the score distribution.
// A 9-year-old plays a little below a greedy bot, so bands are set from these percentiles
// with a gentle margin (1★ always for playing). Run: `node tests/sim-blocks.mjs [rounds]`.

const N = 8, PIECE_BUDGET = 60, TRAY = 3, BOOST_USES = 3;
const CELL_POINTS = 1, LINE_POINTS = 10, ALL_CLEAR_BONUS = 100, SPECIAL_CELL_POINTS = 2;
const BOOST_CORRECT = 0.7;   // assumed Smart-Mix correct rate for a 9-year-old

const SHAPES = {
  single: [[0,0]], domino: [[0,0],[0,1]], tromI: [[0,0],[0,1],[0,2]], tromL: [[0,0],[1,0],[1,1]],
  corner: [[0,0],[0,1],[1,0]], tetI: [[0,0],[0,1],[0,2],[0,3]], tetL: [[0,0],[1,0],[2,0],[2,1]],
  tetS: [[0,1],[0,2],[1,0],[1,1]], tetT: [[0,0],[0,1],[0,2],[1,1]], tetO: [[0,0],[0,1],[1,0],[1,1]],
  block23: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]]
};
const BAG_KEYS = Object.keys(SHAPES);
const SPICY = ['tetS','tetL','tetT','block23'];
const rand = (n) => (Math.random() * n) | 0;
function norm(cells) { const mr = Math.min(...cells.map(c=>c[0])), mc = Math.min(...cells.map(c=>c[1])); return cells.map(([r,c])=>[r-mr,c-mc]); }
function rot(cells) { const mr = Math.max(...cells.map(c=>c[0]))+1; return norm(cells.map(([r,c])=>[c,mr-1-r])); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; }
function orientations(cells){ const seen=new Set(),out=[]; let c=cells; for(let i=0;i<4;i++){const k=JSON.stringify(c);if(!seen.has(k)){seen.add(k);out.push(c);}c=rot(c);} return out; }

// skill 1 = greedy (best move always); lower skill mixes in random legal moves and fewer
// boosts, approximating casual 9-year-old play (leaves holes, gets stuck earlier).
function playRound(skill = 1) {
  const board = Array.from({length:N},()=>Array(N).fill(0));
  let score=0, placed=0, cascade=0, boostsLeft=BOOST_USES;
  const bag=[];
  const draw=()=>{ if(!bag.length){bag.push(...BAG_KEYS);for(const k of SPICY)bag.push(k);shuffle(bag);} return norm(SHAPES[bag.pop()]); };
  let tray=[null,null,null];
  const fill=()=>{ if(tray.every(t=>!t)) for(let i=0;i<TRAY;i++) tray[i]=draw(); };
  fill();

  const fits=(cells,r,c)=>cells.every(([dr,dc])=>{const rr=r+dr,cc=c+dc;return rr>=0&&rr<N&&cc>=0&&cc<N&&!board[rr][cc];});
  const clearLines=()=>{
    const fr=[],fc=[];
    for(let r=0;r<N;r++) if(board[r].every(v=>v)) fr.push(r);
    for(let c=0;c<N;c++){let f=true;for(let r=0;r<N;r++)if(!board[r][c]){f=false;break;}if(f)fc.push(c);}
    const total=fr.length+fc.length;
    if(!total){cascade=0;return;}
    cascade++;
    score += Math.round(LINE_POINTS*total*total*(1+0.5*(cascade-1)));
    fr.forEach(r=>{for(let c=0;c<N;c++)board[r][c]=0;});
    fc.forEach(c=>{for(let r=0;r<N;r++)board[r][c]=0;});
    let empty=true; for(let r=0;r<N&&empty;r++)for(let c=0;c<N;c++)if(board[r][c]){empty=false;break;}
    if(empty) score+=ALL_CLEAR_BONUS;
  };
  // greedy: score a placement by (lines cleared)²*10 + cells, pick the best over all pieces/orients/spots
  const bestMove=()=>{
    let best=null,bestVal=-1;
    for(let i=0;i<TRAY;i++){ if(!tray[i]) continue;
      for(const o of orientations(tray[i])){
        const mr=Math.max(...o.map(x=>x[0]))+1,mc=Math.max(...o.map(x=>x[1]))+1;
        for(let r=0;r<=N-mr;r++)for(let c=0;c<=N-mc;c++){
          if(!fits(o,r,c))continue;
          // simulate
          o.forEach(([dr,dc])=>board[r+dr][c+dc]=1);
          let l=0; for(let rr=0;rr<N;rr++)if(board[rr].every(v=>v))l++; for(let cc=0;cc<N;cc++){let f=true;for(let rr=0;rr<N;rr++)if(!board[rr][cc]){f=false;break;}if(f)l++;}
          // holes penalty: count empty cells with filled neighbours (rough compactness)
          let filled=0; for(let rr=0;rr<N;rr++)for(let cc=0;cc<N;cc++)if(board[rr][cc])filled++;
          o.forEach(([dr,dc])=>board[r+dr][c+dc]=0);
          const val=l*l*100 + o.length - filled*0.05;
          if(val>bestVal){bestVal=val;best={i,o,r,c};}
        }
      }
    }
    return best;
  };
  const useBoostIfHelpful=()=>{
    if(boostsLeft<=0) return false;
    // count densest row/col (a Line Blaster clears it); use boost if it would clear >=4 cells
    let bestLine=0;
    for(let r=0;r<N;r++){let cnt=0;for(let c=0;c<N;c++)if(board[r][c])cnt++;bestLine=Math.max(bestLine,cnt);}
    for(let c=0;c<N;c++){let cnt=0;for(let r=0;r<N;r++)if(board[r][c])cnt++;bestLine=Math.max(bestLine,cnt);}
    if(bestLine<4) return false;
    boostsLeft--;
    if(Math.random()>BOOST_CORRECT) return false;  // wrong answer: no special (not consumed in game; here we just skip)
    // award + immediately use a Line Blaster on the densest line
    let br=-1,bc=-1,bn=0;
    for(let r=0;r<N;r++){let cnt=0;for(let c=0;c<N;c++)if(board[r][c])cnt++;if(cnt>bn){bn=cnt;br=r;bc=-1;}}
    for(let c=0;c<N;c++){let cnt=0;for(let r=0;r<N;r++)if(board[r][c])cnt++;if(cnt>bn){bn=cnt;bc=c;br=-1;}}
    let cleared=0;
    if(br>=0){for(let c=0;c<N;c++)if(board[br][c]){board[br][c]=0;cleared++;}}
    else if(bc>=0){for(let r=0;r<N;r++)if(board[r][bc]){board[r][bc]=0;cleared++;}}
    score+=cleared*SPECIAL_CELL_POINTS;
    return true;
  };

  const anyMove=()=>{ // a random legal placement (casual play)
    const opts=[];
    for(let i=0;i<TRAY;i++){ if(!tray[i])continue; for(const o of orientations(tray[i])){ const mr=Math.max(...o.map(x=>x[0]))+1,mc=Math.max(...o.map(x=>x[1]))+1; for(let r=0;r<=N-mr;r++)for(let c=0;c<=N-mc;c++) if(fits(o,r,c)) opts.push({i,o,r,c}); } }
    return opts.length? opts[rand(opts.length)] : null;
  };
  while(placed<PIECE_BUDGET){
    const mv = (Math.random()<skill) ? bestMove() : (anyMove() || bestMove());
    if(!mv){ if(useBoostIfHelpful()) continue; break; }  // stuck → try a boost, else end
    mv.o.forEach(([dr,dc])=>board[mv.r+dr][mv.c+dc]=1);
    score+=mv.o.length*CELL_POINTS;
    tray[mv.i]=null; placed++;
    clearLines();
    fill();
    if(placed%7===0 && Math.random()<skill+0.2) useBoostIfHelpful();
  }
  return score;
}

const rounds = parseInt(process.argv[2]||'400',10);
function dist(skill){
  const s=[]; for(let i=0;i<rounds;i++) s.push(playRound(skill)); s.sort((a,b)=>a-b);
  const pct=(p)=>s[Math.min(s.length-1,Math.floor(p/100*s.length))];
  const mean=Math.round(s.reduce((a,b)=>a+b,0)/s.length);
  return { min:s[0], p25:pct(25), p50:pct(50), mean, p75:pct(75), p90:pct(90), max:s[s.length-1] };
}
for(const [label,skill] of [['greedy (skilled ceiling)',1.0],['casual 9yo (~55% best move)',0.55],['learning (~35% best move)',0.35]]){
  const d=dist(skill);
  console.log(`${label}: min ${d.min}  p25 ${d.p25}  p50 ${d.p50}  mean ${d.mean}  p75 ${d.p75}  p90 ${d.p90}  max ${d.max}`);
}
