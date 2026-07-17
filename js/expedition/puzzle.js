// RUN10 P16 — compact, discoverable expedition puzzle state machine.
import { el, clear, backControl, REDUCED, confetti } from '../ui.js';
import { getState, mutate } from '../state.js';
import { NODES, BUDGETS, GUESTS } from '../../data/expedition.js';
import { BY_ID } from '../../data/catalogue.js';
import { genRule, genExclusiveRules, informativeNext, featuresOf } from '../attrengine.js';

const BUDGET_KEY = { bridges:'sneezes', picnic:'huffs', raft:'failedSails', hotel:'wrongRooms' };
function party() { const s=getState(), ids=(s.expedition||{}).party||[]; return ids.map(id=>BY_ID[id]||GUESTS.find(g=>g.id===id)).filter(Boolean); }
export function mount(container, params, ctx) {
  const root=el('div',{class:'screen exp-puzzle'}); container.appendChild(root); const node=(params&&params.node)||'bridges'; const spec=NODES.find(n=>n.key===node)||NODES[0]; const ex=getState().expedition||{}, tier=(ex.tiers||{})[node]||1, people=party();
  let wrong=0, solved=[], hintUsed=false; const budget=BUDGETS[node][BUDGET_KEY[node]][tier-1];
  const rule = node==='bridges'||node==='hotel' ? (genExclusiveRules(people, node==='hotel'?3:2,{tier})||[]) : [genRule(people,{tier})].filter(Boolean);
  const title=el('h2',{text:spec.name}), status=el('p',{class:'exp-puzzle-status',text:'Try a Boo and watch what happens.'}), counter=el('p',{class:'exp-budget',text:`${BUDGET_KEY[node]}: ${wrong} / ${budget}`}), board=el('div',{class:'exp-puzzle-board'});
  const finish=()=>{ const stars=wrong<=budget&&!hintUsed?3:wrong<=Math.ceil(budget*1.6)?2:1; mutate(s=>{s.expedition=s.expedition||{party:[],tiers:{},progress:{}};s.expedition.progress=s.expedition.progress||{};s.expedition.tiers=s.expedition.tiers||{};s.expedition.progress[node]=Math.max(s.expedition.progress[node]||0,stars);if(stars===3)s.expedition.tiers[node]=Math.min(4,(s.expedition.tiers[node]||1)+1);}); status.textContent=`Everyone made it! ${'★'.repeat(stars)}`;if(!REDUCED)confetti({count:32,power:.55});setTimeout(()=>ctx.go('expedition',{trail:true}),850);};
  const test=(boo,i)=>{ const accepted=rule.length?rule.some(r=>r.pred(boo)):true; if(accepted){solved.push(boo.id); status.textContent=`${boo.name} found the way!`; }else{wrong++;status.textContent=`${boo.name} comes giggling back.`;} counter.textContent=`${BUDGET_KEY[node]}: ${wrong} / ${budget}`; board.querySelector(`[data-id="${boo.id}"]`).disabled=true; if(solved.length>=people.length||[...board.querySelectorAll('button:not(:disabled)')].length===0)finish();};
  people.forEach((boo,i)=>board.appendChild(el('button',{class:'exp-puzzle-boo',dataset:{id:boo.id},text:`${boo.name} · ${featuresOf(boo).species}`,onclick:()=>test(boo,i)})));
  const hint=el('button',{class:'btn soft',text:'? Hint',onclick:()=>{hintUsed=true;const b=informativeNext(people,solved.map(id=>({id})));const n=b&&board.querySelector(`[data-id="${b.id}"]`);if(n){n.classList.add('exp-hint');setTimeout(()=>n.classList.remove('exp-hint'),4000);}status.textContent='Hmm… try THAT one!';}});
  root.append(title,status,counter,board,hint,backControl(()=>ctx.go('expedition',{trail:true}),{floating:true}));
  if(typeof window!=='undefined')window.__expeditionPuzzle={state:()=>({node,tier,wrong,budget,solved:[...solved],hintUsed}),rules:()=>rule,try:i=>test(people[i],i),hint:()=>hint.click()}; return {unmount(){}};
}
