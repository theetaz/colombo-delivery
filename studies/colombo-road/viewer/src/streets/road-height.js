import {Vector3} from 'three';

const CELL_SIZE=32;
const AREA_EPSILON=1e-10;
const EDGE_EPSILON=1e-8;

function roadLayer(object){
  for(let current=object;current;current=current.parent){
    if(current.userData?.asset_layer==='01 Roads')return true;
  }
  return false;
}

function cellKey(x,z){return `${x},${z}`;}

export function createRoadHeightSampler(sourceRoot){
  const cells=new Map(),a=new Vector3(),b=new Vector3(),c=new Vector3();
  sourceRoot.updateMatrixWorld(true);

  function addTriangle(ax,ay,az,bx,by,bz,cx,cy,cz){
    if(![ax,ay,az,bx,by,bz,cx,cy,cz].every(Number.isFinite))return;
    const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    if(Math.abs(denominator)<=AREA_EPSILON)return;
    const triangle={ax,ay,az,bx,by,bz,cx,cy,cz,denominator};
    const minX=Math.min(ax,bx,cx),maxX=Math.max(ax,bx,cx),minZ=Math.min(az,bz,cz),maxZ=Math.max(az,bz,cz);
    for(let gx=Math.floor(minX/CELL_SIZE);gx<=Math.floor(maxX/CELL_SIZE);gx++)
      for(let gz=Math.floor(minZ/CELL_SIZE);gz<=Math.floor(maxZ/CELL_SIZE);gz++){
        const key=cellKey(gx,gz),bucket=cells.get(key);
        if(bucket)bucket.push(triangle);else cells.set(key,[triangle]);
      }
  }

  sourceRoot.traverse(object=>{
    if(!object.isMesh||!roadLayer(object))return;
    const position=object.geometry?.attributes?.position;
    if(!position)return;
    const index=object.geometry.index;
    const vertex=(target,i)=>target.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld);
    if(index){
      for(let i=0;i+2<index.count;i+=3){
        vertex(a,index.getX(i));vertex(b,index.getX(i+1));vertex(c,index.getX(i+2));
        addTriangle(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
      }
    }else{
      for(let i=0;i+2<position.count;i+=3){
        vertex(a,i);vertex(b,i+1);vertex(c,i+2);
        addTriangle(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
      }
    }
  });

  return (x,z)=>{
    if(!Number.isFinite(x)||!Number.isFinite(z))return null;
    const bucket=cells.get(cellKey(Math.floor(x/CELL_SIZE),Math.floor(z/CELL_SIZE)));
    if(!bucket)return null;
    let highest=null;
    for(const t of bucket){
      const u=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))/t.denominator;
      const v=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))/t.denominator;
      const w=1-u-v;
      if(u<-EDGE_EPSILON||v<-EDGE_EPSILON||w<-EDGE_EPSILON)continue;
      const y=u*t.ay+v*t.by+w*t.cy;
      if(Number.isFinite(y)&&(highest===null||y>highest))highest=y;
    }
    return highest;
  };
}
