import { type Vec3, add, sub, scale, dot, cross, normalize, lerp } from '../math/Vec3';
import type { UprightSpec } from '../model/types';

export interface UprightFrame {
  e1: Vec3;
  e2: Vec3;
  e3: Vec3;
}

export function computeUprightFrame(UBJ: Vec3, LBJ: Vec3, TRO: Vec3): UprightFrame {
  const e1 = normalize(sub(UBJ, LBJ)); // kingpin axis
  const v = sub(TRO, UBJ);
  const e2 = normalize(sub(v, scale(e1, dot(v, e1)))); // Gram-Schmidt
  const e3 = cross(e1, e2);
  return { e1, e2, e3 };
}

export function computeStubAxleLocalDir(UBJ0: Vec3, LBJ0: Vec3, TRO0: Vec3): Vec3 {
  const frame = computeUprightFrame(UBJ0, LBJ0, TRO0);
  // The stub axle direction in the global frame at static is [0, -1, 0]
  // (outboard for RHS). We store this in the upright's local frame so it
  // rotates correctly with the mechanism during travel.
  //
  // The local representation SHOULD include the component along e1 (the
  // kingpin axis). This component encodes the angle between the stub axle
  // and the kingpin — which is how a real upright sets static camber
  // independently of KPI. Removing it (projecting perpendicular to the
  // kingpin) would force static camber to equal -KPI, which is wrong.
  const outboard: Vec3 = [0, -1, 0];
  return [
    dot(outboard, frame.e1),
    dot(outboard, frame.e2),
    dot(outboard, frame.e3),
  ];
}

export function deriveWheelCentre(
  UBJ: Vec3, LBJ: Vec3, TRO: Vec3,
  spec: UprightSpec,
  stubAxleDir0_local: Vec3,
): Vec3 {
  const frame = computeUprightFrame(UBJ, LBJ, TRO);

  // Stub axle origin: interpolate along kingpin
  const stubOrigin = lerp(LBJ, UBJ, spec.stubAxleRatio);

  // Stub axle direction in global frame
  const stubDir = normalize(add(
    scale(frame.e1, stubAxleDir0_local[0]),
    add(
      scale(frame.e2, stubAxleDir0_local[1]),
      scale(frame.e3, stubAxleDir0_local[2]),
    ),
  ));

  // Hub face = end of stub axle
  const hubFace = add(stubOrigin, scale(stubDir, spec.stubAxleLength));

  // Wheel centre = hub face minus ET along stub axle direction
  return sub(hubFace, scale(stubDir, spec.wheelOffset));
}
