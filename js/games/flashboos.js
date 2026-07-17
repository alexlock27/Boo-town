import { el } from '../ui.js';
const colours=['teal','lilac','gold','bubblegum'];
export function makeScene(tier=1){const n=2+tier,boos=Array.from({length:n},(_,i)=>({name:['Pip','Nova','Munch','Bloop','Twirl'][i],colour:colours[i]}));const answer=n;return{boos,question:'How many Boos did you see?',answer,options:[Math.max(1,answer-1),answer,answer+1]};}
export function mount(container,params,ctx){
  const root=el('div',{class:'screen flashboos'});container.appendChild(root);let tier=1,scene;
  const curtain=el('div',{class:'flash-scene'}),question=el('p',{class:'flash-question'}),options=el('div',{class:'flash-options'});
  const begin=()=>{scene=makeScene(tier);curtain.innerHTML=scene.boos.map(b=>`<span style="--boo:${b.colour}">👻</span>`).join('');question.textContent='Look closely…';options.innerHTML='';setTimeout(()=>{
    curtain.classList.add('hidden');question.textContent=scene.question;
    scene.options.forEach(o=>{ const button=el('button',{class:'btn',text:String(o),onclick:()=>{ if(o===scene.answer){curtain.classList.remove('hidden');question.textContent='That is right!';tier=Math.min(3,tier+1);setTimeout(begin,700);} else question.textContent='Look again — the curtain will rise.'; }}); options.appendChild(button); });
  },tier===1?3000:tier===2?4000:5000);};
  root.append(el('h2',{text:'Flash Boos'}),curtain,question,options,el('button',{class:'btn soft',text:'?',onclick:()=>question.textContent='Look, remember, then choose.'}),el('button',{class:'btn soft',text:'Back',onclick:()=>ctx.go('hub')}));begin();return{unmount(){}};
}
