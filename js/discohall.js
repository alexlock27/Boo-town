import { el, REDUCED } from './ui.js';
import { getState } from './state.js';
import { BY_ID } from '../data/catalogue.js';
import { personalityOf } from '../data/personalities.js';
const MOVE={bouncy:'bounce',sleepy:'sway',cheeky:'spin',shy:'sway-small',musical:'shimmy',sporty:'star-jump'};
export function mount(container,params,ctx){const root=el('div',{class:'screen discohall'}),floor=el('div',{class:'disco-floor'}),dancers=el('div',{class:'disco-dancers'});container.appendChild(root);for(let i=0;i<24;i++)floor.appendChild(el('i'));const boos=Object.keys(getState().inventory).filter(id=>getState().inventory[id]>0&&BY_ID[id]?.kind==='boo').slice(0,12);boos.forEach(id=>dancers.appendChild(el('span',{class:'disco-boo move-'+MOVE[personalityOf(id)],text:'👻',title:BY_ID[id].name})));let n=0,timer=setInterval(()=>{floor.children[n%24].classList.remove('on');n++;floor.children[n%24].classList.add('on');},REDUCED?900:500);root.append(el('h2',{text:'✨ Disco Hall'}),el('div',{class:'disco-ball',text:'🪩'}),floor,dancers,el('button',{class:'btn soft',text:'Back',onclick:()=>ctx.go('hub')}));return{unmount(){clearInterval(timer)}};}
