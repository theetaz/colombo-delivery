export const REQUIRED_LOAD_INDEXES=[0,1,3];

export function requiredLoadsReady(results){
  return REQUIRED_LOAD_INDEXES.every(index=>results[index]?.status==='fulfilled');
}

export function shouldScheduleFrame({animate,touring,traffic,wind,automatic}){
  return !!animate&&!!(touring||traffic||wind||automatic);
}
