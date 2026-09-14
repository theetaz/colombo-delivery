// Matches the authored Walk cycle in build_movement.py (left + right step).
export const WALK_STRIDE_METRES=1.32;
export const WALK_SPEED_METRES_PER_SECOND=1.35;
export const walkPhase=distance=>((distance/WALK_STRIDE_METRES)%1+1)%1;
