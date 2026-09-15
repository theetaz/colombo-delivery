export const TRAFFIC_MIN_X=-92;
export const TRAFFIC_MAX_X=92;
export const TRAFFIC_SPAN=TRAFFIC_MAX_X-TRAFFIC_MIN_X;
export const LANE_Z={eastbound:-1.9,westbound:1.9};

export function seededUnit(seed){let value=seed>>>0;return()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296);}

export function createTrafficState(definitions,seed=2407){
  const random=seededUnit(seed);
  return definitions.map(item=>({...item,x:item.startX,z:LANE_Z[item.lane],speed:item.speed*(.94+random()*.12),wheelAngle:0}));
}

function forwardDistance(a,b,direction){return direction>0?(b-a+TRAFFIC_SPAN)%TRAFFIC_SPAN:(a-b+TRAFFIC_SPAN)%TRAFFIC_SPAN;}

export function stepTraffic(items,delta,{paused=false,minGap=7}={}){
  if(paused||delta<=0||!Number.isFinite(delta))return items.map(item=>({...item}));
  const source=items.map(item=>({...item}));
  return source.map(item=>{
    const direction=item.lane==='eastbound'?1:-1;
    let allowed=item.speed*delta;
    for(const other of source){if(other.id===item.id||other.lane!==item.lane)continue;const distance=forwardDistance(item.x,other.x,direction);if(distance>0&&distance<allowed+minGap+(item.length+other.length)/2)allowed=Math.max(0,distance-minGap-(item.length+other.length)/2);}
    let x=item.x+direction*allowed;if(x>TRAFFIC_MAX_X)x=TRAFFIC_MIN_X+(x-TRAFFIC_MAX_X);if(x<TRAFFIC_MIN_X)x=TRAFFIC_MAX_X-(TRAFFIC_MIN_X-x);
    return {...item,x,wheelAngle:item.wheelAngle+allowed/(item.wheelRadius||.34)};
  });
}

export function trafficSnapshot(items){return items.map(({id,lane,x,z,speed})=>({id,lane,x:+x.toFixed(3),z,speed:+speed.toFixed(3)}));}
