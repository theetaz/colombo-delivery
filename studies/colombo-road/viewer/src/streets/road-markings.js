const EPSILON=1e-6;

export const DEFAULT_MARKING_OPTIONS={junctionGap:9,dashLength:3,gapLength:5,arrowSpacing:72,arrowEndGap:24};

const conditional=road=>Object.keys(road.tags||{}).some(key=>key.includes(':conditional'));
const roundabout=(road,ids)=>ids.has(String(road.id))||road.tags?.junction==='roundabout';

export function roadLines(road){
  const geometry=road.geometry_local_xy;
  return geometry.type==='LineString'?[geometry.coordinates]:geometry.coordinates;
}

function polyline(line){
  const points=line.map(([x,north])=>({x,z:-north})),distances=[0];
  for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
  return {points,distances,length:distances.at(-1)};
}

export function sampleLine(line,distance){
  const curve=Array.isArray(line.points)?line:polyline(line);
  const d=Math.max(0,Math.min(curve.length,distance));
  let i=1;while(i<curve.distances.length-1&&curve.distances[i]<d)i++;
  const a=curve.points[i-1],b=curve.points[i],span=curve.distances[i]-curve.distances[i-1]||1,t=(d-curve.distances[i-1])/span;
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
  return {x:a.x+dx*t,z:a.z+dz*t,tx:dx/length,tz:dz/length};
}

function segment(curve,from,to,offset,type,road){
  const a=sampleLine(curve,from),b=sampleLine(curve,to);
  return {type,roadId:String(road.id),from,to,offset,
    a:{x:a.x-a.tz*offset,z:a.z+a.tx*offset},b:{x:b.x-b.tz*offset,z:b.z+b.tx*offset}};
}

function dashed(curve,start,end,offset,type,road,{dashLength,gapLength}){
  const result=[];
  for(let at=start;at<end-EPSILON;at+=dashLength+gapLength)result.push(segment(curve,at,Math.min(at+dashLength,end),offset,type,road));
  return result;
}

export function markingsForRoad(road,roundaboutIds=new Set(),options={}){
  const opts={...DEFAULT_MARKING_OPTIONS,...options};
  if(road.tunnel||conditional(road)||roundabout(road,roundaboutIds)||road.tags?.area==='yes')return [];
  const laneCount=Number(road.lanes)||null;
  const direction=road.direction||'both';
  const markedClass=['motorway','trunk','primary','secondary','tertiary'].includes(road.highway);
  if(!laneCount||(!markedClass&&road.direction_source==='Default assumption; no direction tag'))return [];
  const result=[];
  for(const line of roadLines(road)){
    const curve=polyline(line),start=opts.junctionGap,end=curve.length-opts.junctionGap;
    if(end-start<6)continue;
    if(direction==='both'&&laneCount>=2){
      result.push(...dashed(curve,start,end,0,'centre',road,opts));
      if(laneCount&&laneCount>=4){
        const laneWidth=(road.width_m||laneCount*3.2)/laneCount;
        result.push(...dashed(curve,start,end,-laneWidth,'lane',road,opts),...dashed(curve,start,end,laneWidth,'lane',road,opts));
      }
    }else if(laneCount&&laneCount>1){
      const laneWidth=(road.width_m||laneCount*3.2)/laneCount;
      for(let lane=1;lane<laneCount;lane++)result.push(...dashed(curve,start,end,-(road.width_m||laneCount*3.2)/2+lane*laneWidth,'lane',road,opts));
    }
    const arrowStart=Math.max(start+opts.arrowEndGap,opts.arrowSpacing*.55);
    for(let at=arrowStart;at<end-opts.arrowEndGap;at+=opts.arrowSpacing){
      const laneWidth=(road.width_m||Math.max(1,laneCount||2)*3.2)/Math.max(1,laneCount||2);
      if(direction==='both'){
        const forward=sampleLine(curve,at),reverse=sampleLine(curve,Math.min(end,at+opts.arrowSpacing*.36));
        result.push({type:'arrow',roadId:String(road.id),direction:'forward',x:forward.x+forward.tz*laneWidth*.5,z:forward.z-forward.tx*laneWidth*.5,tx:forward.tx,tz:forward.tz});
        result.push({type:'arrow',roadId:String(road.id),direction:'reverse',x:reverse.x-reverse.tz*laneWidth*.5,z:reverse.z+reverse.tx*laneWidth*.5,tx:-reverse.tx,tz:-reverse.tz});
      }else{
        const reversed=direction==='reverse',point=sampleLine(curve,reversed?curve.length-at:at);
        result.push({type:'arrow',roadId:String(road.id),direction,reversed,x:point.x,z:point.z,tx:reversed?-point.tx:point.tx,tz:reversed?-point.tz:point.tz});
      }
    }
  }
  return result.map(mark=>({...mark,basis:'procedural art inference from mapped lanes and travel direction'}));
}

export function deriveRoadMarkings(network,options={}){
  const ids=new Set((network.roundabout_way_ids||[]).map(String));
  const neighbors=new Map();for(const edge of network.edges||[]){const from=String(edge.from),to=String(edge.to);if(!neighbors.has(from))neighbors.set(from,new Set());if(!neighbors.has(to))neighbors.set(to,new Set());neighbors.get(from).add(to);neighbors.get(to).add(from);}
  const junctions=(network.nodes||[]).filter(node=>(neighbors.get(String(node.id))?.size||0)>2).map(node=>({x:node.position[0],z:node.position[2]}));
  const gap=options.junctionGap??DEFAULT_MARKING_OPTIONS.junctionGap,clear=mark=>junctions.every(point=>{
    const samples=mark.a?[mark.a,mark.b,{x:(mark.a.x+mark.b.x)/2,z:(mark.a.z+mark.b.z)/2}]:[mark];
    return samples.every(sample=>Math.hypot(sample.x-point.x,sample.z-point.z)>=gap);
  });
  return network.roads.flatMap(road=>markingsForRoad(road,ids,options)).filter(clear);
}
