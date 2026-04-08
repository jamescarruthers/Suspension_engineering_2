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
  // Static stub axle direction: horizontal outboard [0, -1, 0] for RHS.
  // Encode in the upright's local frame so it rotates rigidly with the upright.
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
