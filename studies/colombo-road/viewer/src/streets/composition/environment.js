export const PHASES={
  Day:{background:0xcbd8db,fog:0xcbd8db,hemisphere:1.35,sun:3.15,exposure:1.08,lights:false},
  Dusk:{background:0x7d8793,fog:0x7d8793,hemisphere:.72,sun:1.15,exposure:.92,lights:true},
  Night:{background:0x101a2b,fog:0x101a2b,hemisphere:.28,sun:.08,exposure:.78,lights:true},
};

export function phaseState(name){return {...(PHASES[name]||PHASES.Day),name:PHASES[name]?name:'Day'};}
export function automaticPhase(elapsedSeconds){const cycle=((elapsedSeconds%90)+90)%90;return cycle<42?'Day':cycle<57?'Dusk':cycle<78?'Night':'Dusk';}
export function shouldAnimate({visible=true,motion=true,reducedMotion=false}={}){return visible&&motion&&!reducedMotion;}
