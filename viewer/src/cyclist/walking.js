// Matches the authored Walk cycle in build_movement.py (left + right step).
export const WALK_STRIDE_METRES=1.32;
export const WALK_SPEED_METRES_PER_SECOND=1.35;
const wrap=cycle=>((cycle%1)+1)%1;

// Carry momentum through both step handoffs. This changes time, not the poses:
// the same closed curve is sampled faster around contact and slower mid-step.
// The periodic derivative stays positive, including at every loop boundary.
export function walkTiming(cycle){
  const phase=wrap(cycle),shift=.02*Math.sin(4*Math.PI*phase);
  return {phase:wrap(phase+shift),offset:shift*WALK_STRIDE_METRES};
}
export const walkPhase=distance=>walkTiming(distance/WALK_STRIDE_METRES).phase;

// Inspection controls name source poses. Invert the timing curve when seeking
// so every phase button and the comparison view still show that exact pose.
export function walkClockPhase(pose){
  if(pose<=0)return 0;if(pose>=1)return 1;
  let low=0,high=1;
  for(let i=0;i<32;i++){
    const mid=(low+high)/2,value=mid+.02*Math.sin(4*Math.PI*mid);
    if(value<pose)low=mid;else high=mid;
  }
  return (low+high)/2;
}
