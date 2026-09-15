export const SLICE={xMin:-95,xMax:95,road:{zMin:-4,zMax:4},southWalk:{zMin:4.3,zMax:6.7},northWalk:{zMin:-6.7,zMax:-4.3},lake:{xMin:24,zMax:-10.6},promenade:{xMin:24,zMin:-10.1,zMax:-6.7}};
export const drivewayCenters=[-78,-55,-32];

// This is one authored 190 m demonstration corridor, not a city-wide road model.
export const districts=[{id:'district:colombo-demo',name:'Colombo living-street study',bounds:{xMin:-95,xMax:95,zMin:-72,zMax:25}}];
export const roads=[{id:'road:lake-garden-190m',name:'Lake Garden Road study',districtId:'district:colombo-demo',lengthMeters:190,bounds:{xMin:-95,xMax:95,zMin:-4,zMax:4},trafficSide:'left',kind:'local-straight-corridor'}];
export const blocks=[
  {id:'block:south-gardens',name:'South garden block',districtId:'district:colombo-demo',bounds:{xMin:-95,xMax:95,zMin:6.7,zMax:22},adjacentRoadIds:['road:lake-garden-190m']},
  {id:'block:north-shops',name:'North shop block',districtId:'district:colombo-demo',bounds:{xMin:-95,xMax:24,zMin:-22,zMax:-6.7},adjacentRoadIds:['road:lake-garden-190m']},
  {id:'block:north-lakeside',name:'North lakeside promenade',districtId:'district:colombo-demo',bounds:{xMin:24,xMax:95,zMin:-10.1,zMax:-6.7},adjacentRoadIds:['road:lake-garden-190m']},
];

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
  {id:'shop-city-basket',prefab:'ARCH_CityBasketMarket',position:[-21.5,0,-11.4],yaw:0,zone:'shops'},
  {id:'shop-corner-care',prefab:'ARCH_CornerCareParcel',position:[-10.5,0,-11.2],yaw:0,zone:'shops'},
  {id:'home-courtyard',prefab:'ARCH_ModernCourtyardApartments',position:[5.5,0,12],yaw:Math.PI,zone:'garden'},
  {id:'home-louvered',prefab:'ARCH_LouveredLaneHouse',position:[18,0,11.5],yaw:Math.PI,zone:'garden'},
];

export const landscapePlacements=[
  {id:'tree-a1',prefab:'Tree_Broadleaf_A',position:[-87,0,7.9],scale:.9,zone:'garden'},
  {id:'tree-b1',prefab:'Tree_Broadleaf_B',position:[-64,0,9.1],scale:.82,zone:'garden'},
  {id:'tree-c1',prefab:'Tree_Broadleaf_C',position:[-39,0,8.4],scale:.92,zone:'garden'},
  {id:'tree-a2',prefab:'Tree_Broadleaf_A',position:[-12,0,7.9],scale:.78,zone:'garden'},
  {id:'palm-garden',prefab:'Palm_Modest_A',position:[-2,0,19],scale:.92,zone:'garden'},
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
  ...[['flowerbed-west-end',-91,8.2],['flowerbed-verandah',-74,8.1],['flowerbed-balcony',-48,7.8],['flowerbed-heritage',-25,8.1],['flowerbed-courtyard-west',-3,7.8],['flowerbed-lane',12,8.2],['flowerbed-lake-west',42,8.1],['flowerbed-lake-mid',70,8.2],['flowerbed-lake-east',88,8]].map(([id,x,z],i)=>({id,prefab:i%2?'Flowerbed_Cool_A':'Flowerbed_Warm_A',position:[x,0,z],yaw:i*.63,scale:.8,zone:'garden'})),
  ...[['living-tree-west-end',-91,13],['living-tree-verandah-east',-72,15],['living-tree-balcony-east',-45,15],['living-tree-heritage-east',-17,14],['living-tree-lake-west',43,15],['living-tree-lake-mid',69,16],['living-tree-east-end',91,14]].map(([id,x,z],i)=>({id,prefab:['Tree_Rain_A','Tree_Flowering_A','Tree_Mango_A','Tree_Frangipani_A'][i%4],position:[x,0,z],yaw:i*.71,scale:.68+(i%3)*.08,zone:'garden'})),
  ...[['grass-west-end',-84,7.2],['grass-verandah-east',-60,7.25],['grass-heritage-west',-37,7.2],['grass-courtyard-west',-14,7.25],['grass-courtyard-east',8,7.2],['grass-lake-west',36,7.25],['grass-lake-mid',61,7.2],['grass-lake-east',83,7.25]].map(([id,x,z],i)=>({id,prefab:i%2?'Grass_VergeClump_A':'Grass_VergeTuft_A',position:[x,0,z],yaw:i,scale:.9,zone:'garden'})),
  ...[['lakeside-shrub-west',27,-8.5],['lakeside-shrub-bench-west',51,-8.45],['lakeside-shrub-bench-east',73,-8.5],['lakeside-shrub-east',93,-8.45]].map(([id,x,z],i)=>({id,prefab:i%2?'Fern_Tropical_A':'Shrub_Ornamental_A',position:[x,.155,z],yaw:i*.8,scale:.72,zone:'lakeside'})),
  {id:'palm-coconut-lakeside',prefab:'Palm_Coconut_A',position:[57,.155,-8.9],yaw:.4,scale:.8,zone:'lakeside'},
  {id:'groundcover-garden-east',prefab:'Groundcover_Low_A',position:[38,0,7.35],yaw:.7,scale:.9,zone:'garden'},
  {id:'groundcover-garden-west',prefab:'Groundcover_Low_A',position:[-83,0,7.4],yaw:1.4,scale:.86,zone:'garden'},
];

export const deliveryStops=[
  {id:'stop:pickup:produce',name:'Green Basket Produce',role:'pickup',buildingId:'shop-produce',entrance:{id:'entrance:shop-produce:front',sourceAnchorId:'produce-counter',position:[-63.5,.16,-7.72]},approach:{id:'approach:shop-produce:north-sidewalk',position:[-63,.16,-5.55],sidewalk:'north'}},
  {id:'stop:pickup:cafe',name:'Lake Road Café',role:'pickup',buildingId:'shop-cafe',entrance:{id:'entrance:shop-cafe:front',sourceAnchorId:'cafe-door',position:[-54.3,.16,-7.58]},approach:{id:'approach:shop-cafe:north-sidewalk',position:[-54.3,.16,-5.55],sidewalk:'north'}},
  {id:'stop:pickup:city-basket',name:'City Basket Market',role:'pickup',buildingId:'shop-city-basket',entrance:{id:'entrance:shop-city-basket:front',sourceAnchorId:'main-entry',position:[-24.4,.16,-7.68]},approach:{id:'approach:shop-city-basket:north-sidewalk',position:[-24.4,.16,-5.55],sidewalk:'north'}},
  {id:'stop:dropoff:verandah',name:'Verandah House',role:'dropoff',buildingId:'home-verandah',entrance:{id:'entrance:home-verandah:front',sourceAnchorId:'front-door',position:[-78,.16,8.65]},approach:{id:'approach:home-verandah:south-sidewalk',position:[-78,.16,5.55],sidewalk:'south'}},
  {id:'stop:dropoff:courtyard',name:'Courtyard Apartments',role:'dropoff',buildingId:'home-courtyard',entrance:{id:'entrance:home-courtyard:front',sourceAnchorId:'resident-lobby',position:[5.5,.16,8.28]},approach:{id:'approach:home-courtyard:south-sidewalk',position:[5.5,.16,5.55],sidewalk:'south'}},
];

export const pathLightPlacements=[
  {id:'path-light-west-garden',position:[-88,.2,6.15],zone:'garden'},
  {id:'path-light-verandah-garden',position:[-66,.2,6.15],zone:'garden'},
  {id:'path-light-heritage-garden',position:[-43,.2,6.15],zone:'garden'},
  {id:'path-light-city-basket-garden',position:[-20,.2,6.15],zone:'garden'},
  {id:'path-light-courtyard-garden',position:[3,.2,6.15],zone:'garden'},
  {id:'path-light-lakeside-west',position:[30,.2,-8.82],zone:'lakeside'},
  {id:'path-light-lakeside-midwest',position:[53,.2,-8.82],zone:'lakeside'},
  {id:'path-light-lakeside-mideast',position:[76,.2,-8.82],zone:'lakeside'},
  {id:'path-light-lakeside-east',position:[91,.2,-8.82],zone:'lakeside'},
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
