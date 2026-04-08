import { type Vec3, sub, normalize, dot, cross, scale, add } from '../math/Vec3';
import type { Hardpoints, UprightSpec } from '../model/types';
import { deriveWheelCentre } from '../solver/upright';

const RAD2DEG = 180 / Math.PI;

export interface GeometryResult {
  travel: number;
  camber: number;
  toe: number;
  caster: number;
  kpi: number;
  scrubRadius: number;
  mechanicalTrail: number;
  rollCentreHeight: number;
  instantCentreY: number;
  instantCentreZ: number;
  antiDivePct: number;
  antiSquatPct: number;
  wcX: number;
  wcY: number;
  wcZ: number;
}

function lineIntersect2D(
  p1y: number, p1z: number, p2y: number, p2z: number,
  p3y: number, p3z: number, p4y: number, p4z: number,
): [number, number] | null {
  const denom = (p1y - p2y) * (p3z - p4z) - (p1z - p2z) * (p3y - p4y);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p1y - p3y) * (p3z - p4z) - (p1z - p3z) * (p3y - p4y)) / denom;
  return [
    p1y + t * (p2y - p1y),
    p1z + t * (p2z - p1z),
  ];
}

function kingpinGroundIntercept(
  LBJ: Vec3, UBJ: Vec3,
): { frontViewY: number; sideViewX: number } {
  // Project kingpin axis to ground (Z=0)
  const dir = sub(UBJ, LBJ);

  // Front view (YZ plane): parameterise z = LBJ_z + t*dir_z = 0
  let frontY = LBJ[1];
  if (Math.abs(dir[2]) > 1e-10) {
    const t = -LBJ[2] / dir[2];
    frontY = LBJ[1] + t * dir[1];
  }

  // Side view (XZ plane)
  let sideX = LBJ[0];
  if (Math.abs(dir[2]) > 1e-10) {
    const t = -LBJ[2] / dir[2];
    sideX = LBJ[0] + t * dir[0];
  }

  return { frontViewY: frontY, sideViewX: sideX };
}

export function extractGeometryOutputs(
  q: number[],
  travel: number,
  hardpoints: Hardpoints,
  uprightSpec: UprightSpec,
  stubAxleDir0_local: Vec3,
  tyreRadius: number,
): GeometryResult {
  const UBJ: Vec3 = [q[0], q[1], q[2]];
  const LBJ: Vec3 = [q[3], q[4], q[5]];
  const TRO: Vec3 = [q[6], q[7], q[8]];

  const WC = deriveWheelCentre(UBJ, LBJ, TRO, uprightSpec, stubAxleDir0_local);
  const CP: Vec3 = [WC[0], WC[1], WC[2] - tyreRadius];

  // Kingpin axis
  const kingpin = normalize(sub(UBJ, LBJ));

  // Rebuild upright frame to get wheel plane normal (stub axle direction)
  const e1 = kingpin;
  const v = sub(TRO, UBJ);
  const e2 = normalize(sub(v, scale(e1, dot(v, e1))));
  const e3 = cross(e1, e2);
  const wheelPlaneNormal = normalize(add(
    scale(e1, stubAxleDir0_local[0]),
    add(scale(e2, stubAxleDir0_local[1]), scale(e3, stubAxleDir0_local[2])),
  ));

  // Camber: angle of wheel plane normal in YZ plane vs horizontal
  // SAE convention: positive camber = top of wheel tilted outboard
  // For RHS corner: outboard is -Y, so positive camber tilts normal toward -Z
  const camber = Math.atan2(-wheelPlaneNormal[2], -wheelPlaneNormal[1]) * RAD2DEG;

  // Toe: angle of wheel plane normal in XY plane
  // SAE convention: positive toe = toe-in (front of wheel toward centreline)
  // For RHS corner: toe-in rotates normal toward +X
  const toe = Math.atan2(wheelPlaneNormal[0], -wheelPlaneNormal[1]) * RAD2DEG;

  // Caster: kingpin axis in side view (XZ), angle to vertical
  // Positive caster = top of kingpin tilts rearward (-X)
  const caster = Math.atan2(-kingpin[0], kingpin[2]) * RAD2DEG;

  // KPI: kingpin axis in front view (YZ), angle to vertical
  // SAE convention: positive KPI = top of kingpin tilts inboard (+Y for RHS)
  const kpi = Math.atan2(kingpin[1], kingpin[2]) * RAD2DEG;

  // Kingpin ground intercept
  const kpGround = kingpinGroundIntercept(LBJ, UBJ);

  // Scrub radius: lateral offset from kingpin ground intercept to contact patch
  // SAE convention: positive when kingpin intercept is inboard of contact patch
  const scrubRadius = kpGround.frontViewY - CP[1];

  // Mechanical trail: longitudinal distance from kingpin ground intercept to CP
  // SAE convention: positive when contact patch is behind (rearward of) kingpin intercept
  const mechanicalTrail = kpGround.sideViewX - CP[0];

  // Instant centre (front view) — intersection of wishbone lines in YZ plane
  // Upper arm line: midpoint of UBIF/UBIR inner pivots → UBJ
  const upperInnerMid: Vec3 = [
    (hardpoints.UBIF[0] + hardpoints.UBIR[0]) / 2,
    (hardpoints.UBIF[1] + hardpoints.UBIR[1]) / 2,
    (hardpoints.UBIF[2] + hardpoints.UBIR[2]) / 2,
  ];
  const lowerInnerMid: Vec3 = [
    (hardpoints.LBIF[0] + hardpoints.LBIR[0]) / 2,
    (hardpoints.LBIF[1] + hardpoints.LBIR[1]) / 2,
    (hardpoints.LBIF[2] + hardpoints.LBIR[2]) / 2,
  ];

  const ic = lineIntersect2D(
    upperInnerMid[1], upperInnerMid[2], UBJ[1], UBJ[2],
    lowerInnerMid[1], lowerInnerMid[2], LBJ[1], LBJ[2],
  );

  let instantCentreY = 0;
  let instantCentreZ = 0;
  let rollCentreHeight = 0;

  if (ic) {
    instantCentreY = ic[0];
    instantCentreZ = ic[1];

    // Roll centre: line from CP to IC, intersect with vehicle centreline (Y=0)
    const rcResult = lineIntersect2D(
      CP[1], CP[2] - tyreRadius + tyreRadius, // CP_y, CP_z (CP is already at ground)
      instantCentreY, instantCentreZ,
      0, -10000, 0, 10000, // vertical line at Y=0
    );
    if (rcResult) {
      rollCentreHeight = rcResult[1];
    }
  }

  // Anti-dive/squat (simplified)
  // Side-view instant centre: intersection of upper/lower arm lines in XZ plane
  const sideIC = lineIntersect2D(
    upperInnerMid[0], upperInnerMid[2], UBJ[0], UBJ[2],
    lowerInnerMid[0], lowerInnerMid[2], LBJ[0], LBJ[2],
  );

  let antiDivePct = 0;
  let antiSquatPct = 0;
  if (sideIC) {
    // Anti-dive: tan(angle from contact patch to side-view IC) / tan(angle to CG)
    const sideICx = sideIC[0];
    const sideICz = sideIC[1];
    const cpX = CP[0];
    if (Math.abs(sideICx - cpX) > 1e-6) {
      const tanAngle = sideICz / Math.abs(sideICx - cpX);
      // Using a default CG height / wheelbase ratio as reference
      antiDivePct = tanAngle * 100;
      antiSquatPct = tanAngle * 100;
    }
  }

  return {
    travel,
    camber,
    toe,
    caster,
    kpi,
    scrubRadius,
    mechanicalTrail,
    rollCentreHeight,
    instantCentreY,
    instantCentreZ,
    antiDivePct,
    antiSquatPct,
    wcX: WC[0],
    wcY: WC[1],
    wcZ: WC[2],
  };
}
