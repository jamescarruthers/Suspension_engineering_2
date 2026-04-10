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

export function computeStubAxleLocalDir(UBJ0: Vec3, LBJ0: Vec3, TRO0: Vec3, camberDeg: number, casterDeg: number): Vec3 {
  const frame = computeUprightFrame(UBJ0, LBJ0, TRO0);

  // Start from horizontal outboard for RHS: [0, -1, 0]. Apply static camber
  // (about global X) then caster (about global Z). Store the resulting direction
  // in the upright's local frame so it rotates rigidly with the upright. Keep
  // the component along the kingpin axis (e1) — projecting it away would
  // incorrectly force static camber to equal -KPI.
  const camRad = camberDeg * Math.PI / 180;
  const casRad = casterDeg * Math.PI / 180;  // positive caster tilts the stub axle forward (+X)

  // After camber rotation about X: Y' = Y*cos - Z*sin, Z' = Y*sin + Z*cos
  const y1 = -Math.cos(camRad);
  const z1 = -Math.sin(camRad);

  // After caster rotation about Z: X' = -Y'*sin, Y' = Y'*cos
  const x2 = -y1 * Math.sin(casRad);
  const y2 = y1 * Math.cos(casRad);
  const z2 = z1;

  const stubDir: Vec3 = [x2, y2, z2];

  return [
    dot(stubDir, frame.e1),
    dot(stubDir, frame.e2),
    dot(stubDir, frame.e3),
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
