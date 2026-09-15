export const SLICE={xMin:-95,xMax:95,road:{zMin:-4,zMax:4},southWalk:{zMin:4.3,zMax:6.7},northWalk:{zMin:-6.7,zMax:-4.3},lake:{xMin:24,zMax:-10.6},promenade:{xMin:24,zMin:-10.1,zMax:-6.7}};
export const drivewayCenters=[-78,-55,-32];

export const architecturePlacements=[
  {id:'home-verandah',prefab:'ARCH_VerandahHouse',position:[-78,0,12.1],yaw:Math.PI,zone:'garden'},
  {id:'home-balcony',prefab:'ARCH_NarrowBalconyHome',position:[-55,0,11.3],yaw:Math.PI,zone:'garden'},
  {id:'home-heritage',prefab:'ARCH_HeritageFacade',position:[-32,0,11.8],yaw:Math.PI,zone:'garden'},
  {id:'garden-gate',prefab:'ARCH_GardenWallGate',position:[-66,0,7.9],yaw:Math.PI,zone:'garden'},
  {id:'shop-produce',prefab:'ARCH_ProduceShop',position:[-63,0,-11.2],yaw:0,zone:'shops'},
  {id:'shop-cafe',prefab:'ARCH_CafeShopHouse',position:[-54.7,0,-11],yaw:0,zone:'shops'},
  {id:'shop-heritage',prefab:'ARCH_HeritageFacade',position:[-45.1,0,-10.9],yaw:0,zone:'shops'},
  {id:'shop-mixed',prefab:'ARCH_MixedUseApartments',position:[-34.2,0,-11.5],yaw:0,zone:'shops'},
  {id:'lake-home-narrow',prefab:'ARCH_NarrowBalconyHome',position:[31,0,11.4],yaw:Math.PI,zone:'garden'},
  {id:'lake-home-verandah',prefab:'ARCH_VerandahHouse',position:[53,0,12.5],yaw:Math.PI,zone:'garden'},
  {id:'lake-home-heritage',prefab:'ARCH_HeritageFacade',position:[79,0,11.7],yaw:Math.PI,zone:'garden'},
];

export const landscapePlacements=[
  {id:'tree-a1',prefab:'Tree_Broadleaf_A',position:[-87,0,7.9],scale:.9,zone:'garden'},
  {id:'tree-b1',prefab:'Tree_Broadleaf_B',position:[-64,0,9.1],scale:.82,zone:'garden'},
  {id:'tree-c1',prefab:'Tree_Broadleaf_C',position:[-39,0,8.4],scale:.92,zone:'garden'},
  {id:'tree-a2',prefab:'Tree_Broadleaf_A',position:[-12,0,7.9],scale:.78,zone:'garden'},
  {id:'palm-garden',prefab:'Palm_Modest_A',position:[17,0,10.2],scale:.92,zone:'garden'},
  {id:'tree-shop',prefab:'Tree_Broadleaf_C',position:[-31,.155,-6.35],scale:.68,zone:'shops',treePit:true},
  {id:'tree-lake-a',prefab:'Tree_Broadleaf_B',position:[34,.155,-8.25],scale:.72,zone:'lakeside'},
  {id:'tree-lake-b',prefab:'Tree_Broadleaf_A',position:[66,.155,-8.35],scale:.78,zone:'lakeside'},
  {id:'tree-lake-c',prefab:'Tree_Broadleaf_C',position:[90,.155,-8.2],scale:.72,zone:'lakeside'},
  ...[-88,-70,-18,15].map((x,i)=>({id:`garden-planter-${i}`,prefab:'Planter_Shrub',position:[x,0,7.45],yaw:i%2?Math.PI/2:0,zone:'garden'})),
  ...[39,59,84].map((x,i)=>({id:`lake-planter-${i}`,prefab:'Planter_Shrub',position:[x,.155,-9.32],yaw:i%2?Math.PI/2:0,zone:'lakeside'})),
  ...[-80,-52,-24,4,31,53,75,93].map((x,i)=>({id:`lamp-${i}`,prefab:'StreetLamp_Civic',position:[x,.155,i<4?6.35:-8.65],yaw:i<4?Math.PI:0,scale:.92,zone:i<4?'garden':'lakeside'})),
  ...[26,28,30,32,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94].map((x,i)=>({id:`rail-${i}`,prefab:'Railing_Promenade_2m',position:[x,.155,-10],yaw:0,zone:'lakeside'})),
  ...[44,78].map((x,i)=>({id:`bench-${i}`,prefab:'Bench_TimberConcrete',position:[x,.155,-8.25],yaw:Math.PI,zone:'lakeside'})),
  ...[-72,-48,-22,2,30,58,86].map((x,i)=>({id:`drain-${i}`,prefab:'DrainGrate',position:[x,.151,-4.15],zone:x>=24?'lakeside':'shops'})),
];

export const cameraPresets={
  Garden:{position:[-82,3.4,1.8],target:[-55,2.5,1]},
  Shops:{position:[-63,3.2,1.3],target:[-35,2.4,-3.2]},
  Lakeside:{position:[35,4.2,4],target:[65,2.8,-5.8]},
};

export function within(value,min,max){return value>=min&&value<=max;}
export function placementZoneAt([x,,z]){
  if(x>=SLICE.lake.xMin&&z<=SLICE.lake.zMax)return 'water';
  if(x>=SLICE.promenade.xMin&&within(z,SLICE.promenade.zMin,SLICE.promenade.zMax))return 'lakeside';
  if(within(z,SLICE.road.zMin,SLICE.road.zMax))return 'road';
  if(within(z,SLICE.southWalk.zMin,SLICE.southWalk.zMax)||within(z,SLICE.northWalk.zMin,SLICE.northWalk.zMax))return 'pavement';
  return z>0?'garden':'shops';
}
