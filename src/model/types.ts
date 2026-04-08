import type { Vec3 } from '../math/Vec3';

export type HardpointId =
  | 'UBIF' | 'UBIR' | 'UBJ'
  | 'LBIF' | 'LBIR' | 'LBJ'
  | 'TRI' | 'TRO'
  | 'SU' | 'SL'
  | 'DU' | 'DL';

export type Hardpoints = Record<HardpointId, Vec3>;

export interface UprightSpec {
  stubAxleRatio: number;   // 0–1, position along kingpin (0=LBJ, 1=UBJ)
  stubAxleLength: number;  // mm
  wheelOffset: number;     // mm (ET)
}

export interface VehicleParams {
  mass: number;
  cgHeight: number;
  wheelbase: number;
  cgToFrontAxle: number;
  trackFront: number;
  trackRear: number;
  tyreRadius: number;
}

export interface SpringSpec {
  rate: number;        // N/mm
  freeLength: number;  // mm
  preload: number;     // N
}

export interface DamperSpec {
  bump: { velocity: number; force: number }[];
  rebound: { velocity: number; force: number }[];
}

export interface ARBSpec {
  rate: number; // N/mm at wheel
}

export interface CornerSetup {
  hardpoints: Hardpoints;
  upright: UprightSpec;
  spring: SpringSpec;
  damper: DamperSpec;
}

export interface SuspensionModel {
  front: CornerSetup;
  rear: CornerSetup;
  vehicle: VehicleParams;
  arbFront: ARBSpec;
  arbRear: ARBSpec;
}

export interface GeometryOutputs {
  travel: number;
  camber: number;       // deg
  toe: number;          // deg
  caster: number;       // deg
  kpi: number;          // deg
  scrubRadius: number;  // mm
  mechanicalTrail: number; // mm
  rollCentreHeight: number; // mm
  instantCentreY: number;  // mm
  instantCentreZ: number;  // mm
  antiDivePct: number;
  antiSquatPct: number;
  springLength: number;    // mm
  damperLength: number;    // mm
  motionRatioSpring: number;
  motionRatioDamper: number;
  wheelRate: number;       // N/mm
  wcX: number;
  wcY: number;
  wcZ: number;
}

export interface SweepResult {
  outputs: GeometryOutputs[];
  solvedStates: number[][]; // q vectors at each step
}

export interface RollAnalysis {
  rollRateFront: number;     // N·mm/rad
  rollRateRear: number;
  rollRateTotal: number;
  rollGradient: number;      // deg/g
  lltd: number;              // 0–1
  rollCentreHeightFront: number; // mm
  rollCentreHeightRear: number;
}
