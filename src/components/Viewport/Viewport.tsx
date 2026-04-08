import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import type { Hardpoints, UprightSpec } from '../../model/types';
import type { Vec3 } from '../../math/Vec3';
import { add, sub, scale, dot, cross, normalize, lerp } from '../../math/Vec3';
import { rotatePointWithWishbone } from '../../solver/wishboneRotation';
import { computeStubAxleLocalDir, computeUprightFrame, deriveWheelCentre } from '../../solver/upright';

interface CornerSpec {
  hp: Hardpoints;
  upright: UprightSpec;
  tyreRadius: number;
}

interface Props {
  frontCorner: CornerSpec;
  rearCorner: CornerSpec;
  frontSolvedQ: number[] | null;
  frontSolvedQ_LHS: number[] | null;
  rearSolvedQ: number[] | null;
  travel: number;
  wheelbase: number;
}

/** Mirror a Vec3 across the Y=0 plane (RHS→LHS in ISO 8855) */
function mirrorY(p: Vec3): Vec3 {
  return [p[0], -p[1], p[2]];
}

/** Mirror a solved state vector (9 values: UBJ, LBJ, TRO) */
function mirrorQ(q: number[]): number[] {
  return [
    q[0], -q[1], q[2],  // UBJ
    q[3], -q[4], q[5],  // LBJ
    q[6], -q[7], q[8],  // TRO
  ];
}

/** Mirror all hardpoints across Y=0 */
function mirrorHardpoints(hp: Hardpoints): Hardpoints {
  const result = {} as Record<string, Vec3>;
  for (const [key, val] of Object.entries(hp)) {
    result[key] = mirrorY(val);
  }
  return result as Hardpoints;
}

/** Offset a Vec3 along X */
function offsetVec3X(p: Vec3, dx: number): Vec3 {
  return [p[0] + dx, p[1], p[2]];
}

/** Offset all hardpoints along X */
function offsetHardpointsX(hp: Hardpoints, dx: number): Hardpoints {
  const result = {} as Record<string, Vec3>;
  for (const [key, val] of Object.entries(hp)) {
    result[key] = offsetVec3X(val, dx);
  }
  return result as Hardpoints;
}

/** Offset a solved state vector (9 values: UBJ, LBJ, TRO) along X */
function offsetQX(q: number[], dx: number): number[] {
  return [
    q[0] + dx, q[1], q[2],
    q[3] + dx, q[4], q[5],
    q[6] + dx, q[7], q[8],
  ];
}

function Sphere({ pos, color, size = 4 }: { pos: Vec3; color: string; size?: number }) {
  return (
    <mesh position={[pos[0], pos[2], -pos[1]]}>
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function LinkLine({ from, to, color, width = 2 }: { from: Vec3; to: Vec3; color: string; width?: number }) {
  const points = useMemo(
    () => [
      [from[0], from[2], -from[1]] as [number, number, number],
      [to[0], to[2], -to[1]] as [number, number, number],
    ],
    [from, to],
  );
  return <Line points={points} color={color} lineWidth={width} />;
}

const UPRIGHT_UPPER_HW = 25; // mm, half-width at UBJ (fore-aft)
const UPRIGHT_LOWER_HW = 35; // mm, half-width at LBJ (fore-aft, typically wider)

/**
 * Compute upright trapezoid corners. The width direction is the component of the
 * fore-aft axis (X) perpendicular to the kingpin, so the front/rear edges align
 * with the wishbone arm directions. Upper and lower can have different widths.
 * Returns [upperFront, upperRear, lowerRear, lowerFront] in suspension coords.
 */
function uprightCorners(ubj: Vec3, lbj: Vec3): { corners: Vec3[]; widthDir: Vec3 } {
  // Kingpin axis
  const kpX = ubj[0] - lbj[0], kpY = ubj[1] - lbj[1], kpZ = ubj[2] - lbj[2];
  const kpLen = Math.sqrt(kpX * kpX + kpY * kpY + kpZ * kpZ);
  const kx = kpX / kpLen, ky = kpY / kpLen, kz = kpZ / kpLen;

  // Width direction: component of global X-axis perpendicular to kingpin
  // This aligns the upright width with the fore-aft direction (where UBIF/UBIR separate)
  const xAxis: Vec3 = [1, 0, 0];
  const projDot = xAxis[0] * kx + xAxis[1] * ky + xAxis[2] * kz;
  let wx = xAxis[0] - projDot * kx;
  let wy = xAxis[1] - projDot * ky;
  let wz = xAxis[2] - projDot * kz;
  const wLen = Math.sqrt(wx * wx + wy * wy + wz * wz);
  if (wLen < 1e-6) {
    // Kingpin is parallel to X — fall back to Z perpendicular component
    wx = 0; wy = 0; wz = 1;
  } else {
    wx /= wLen; wy /= wLen; wz /= wLen;
  }

  const uhw = UPRIGHT_UPPER_HW;
  const lhw = UPRIGHT_LOWER_HW;

  const corners: Vec3[] = [
    [ubj[0] + wx * uhw, ubj[1] + wy * uhw, ubj[2] + wz * uhw], // upper front
    [ubj[0] - wx * uhw, ubj[1] - wy * uhw, ubj[2] - wz * uhw], // upper rear
    [lbj[0] - wx * lhw, lbj[1] - wy * lhw, lbj[2] - wz * lhw], // lower rear
    [lbj[0] + wx * lhw, lbj[1] + wy * lhw, lbj[2] + wz * lhw], // lower front
  ];

  return { corners, widthDir: [wx, wy, wz] };
}

function UprightShape({ ubj, lbj, tro }: { ubj: Vec3; lbj: Vec3; tro: Vec3 }) {
  const { corners } = uprightCorners(ubj, lbj);

  const to3 = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p[0], p[2], -p[1]);
  const c0 = to3(corners[0]), c1 = to3(corners[1]), c2 = to3(corners[2]), c3 = to3(corners[3]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      c0.x, c0.y, c0.z, c1.x, c1.y, c1.z, c2.x, c2.y, c2.z,
      c0.x, c0.y, c0.z, c2.x, c2.y, c2.z, c3.x, c3.y, c3.z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, [c0.x, c0.y, c0.z, c1.x, c1.y, c1.z, c2.x, c2.y, c2.z, c3.x, c3.y, c3.z]);

  const edgePoints: [number, number, number][] = [
    [c0.x, c0.y, c0.z], [c1.x, c1.y, c1.z], [c2.x, c2.y, c2.z], [c3.x, c3.y, c3.z], [c0.x, c0.y, c0.z],
  ];

  const troP = to3(tro);
  const ubjP = to3(ubj);
  const lbjP = to3(lbj);

  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#ffcc00" opacity={0.3} transparent side={THREE.DoubleSide} />
      </mesh>
      <Line points={edgePoints} color="#ffcc00" lineWidth={2.5} />
      {/* Kingpin centre line */}
      <Line points={[[ubjP.x, ubjP.y, ubjP.z], [lbjP.x, lbjP.y, lbjP.z]]} color="#ffcc00" lineWidth={1} />
      {/* Steering arm to TRO */}
      <Line
        points={[
          [(ubjP.x + lbjP.x) / 2, (ubjP.y + lbjP.y) / 2, (ubjP.z + lbjP.z) / 2],
          [troP.x, troP.y, troP.z],
        ]}
        color="#ffaa00" lineWidth={2}
      />
    </>
  );
}

/**
 * Wheel assembly: stub axle line, rim circle, tyre circle.
 * Derives WC from the upright pose using the stub axle model.
 *
 * stubAxleDir0_local must be precomputed from the STATIC hardpoints —
 * it encodes the outboard direction in the upright's local frame.
 * The current solved UBJ/LBJ/TRO are used only to rebuild the
 * current frame and transform that local direction into global coords.
 */
function WheelAssembly({ ubj, lbj, tro, uprightSpec, tyreRadius, stubAxleDir0_local }: {
  ubj: Vec3; lbj: Vec3; tro: Vec3;
  uprightSpec: UprightSpec;
  tyreRadius: number;
  stubAxleDir0_local: Vec3;
}) {
  // Stub axle origin: point along kingpin axis
  const stubOrigin = lerp(lbj, ubj, uprightSpec.stubAxleRatio);

  // Rebuild upright frame from CURRENT solved positions to get stub axle
  // direction in global coords — the local direction was frozen at init
  const frame = computeUprightFrame(ubj, lbj, tro);
  const stubDir = normalize(add(
    scale(frame.e1, stubAxleDir0_local[0]),
    add(scale(frame.e2, stubAxleDir0_local[1]), scale(frame.e3, stubAxleDir0_local[2])),
  ));

  // Hub face = end of stub axle
  const hubFace = add(stubOrigin, scale(stubDir, uprightSpec.stubAxleLength));

  // Wheel centre = hub face minus ET along stub axle direction
  const WC = sub(hubFace, scale(stubDir, uprightSpec.wheelOffset));

  // Contact patch (directly below WC)
  const CP: Vec3 = [WC[0], WC[1], 0];

  // Convert to Three.js coords (X=X, Y=Z, Z=-Y)
  const to3 = (p: Vec3): [number, number, number] => [p[0], p[2], -p[1]];

  const stubOrigin3 = to3(stubOrigin);
  const hubFace3 = to3(hubFace);
  const wc3 = to3(WC);
  const cp3 = to3(CP);

  // Stub axle direction in Three.js space
  const stubDir3 = new THREE.Vector3(stubDir[0], stubDir[2], -stubDir[1]).normalize();

  // Quaternion to rotate a circle (default normal = Z) to face along stubDir
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), stubDir3);
    return q;
  }, [stubDir3.x, stubDir3.y, stubDir3.z]);

  const rimRadius = tyreRadius * 0.45; // visual approximation of rim size
  const tyreWidth = 205; // mm, visual tyre width

  // Generate circle points for rim and tyre
  const rimPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const localPt = new THREE.Vector3(
        Math.cos(angle) * rimRadius,
        Math.sin(angle) * rimRadius,
        0,
      );
      localPt.applyQuaternion(quaternion);
      pts.push([wc3[0] + localPt.x, wc3[1] + localPt.y, wc3[2] + localPt.z]);
    }
    return pts;
  }, [wc3[0], wc3[1], wc3[2], rimRadius, quaternion]);

  const tyrePoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const localPt = new THREE.Vector3(
        Math.cos(angle) * tyreRadius,
        Math.sin(angle) * tyreRadius,
        0,
      );
      localPt.applyQuaternion(quaternion);
      pts.push([wc3[0] + localPt.x, wc3[1] + localPt.y, wc3[2] + localPt.z]);
    }
    return pts;
  }, [wc3[0], wc3[1], wc3[2], tyreRadius, quaternion]);

  // Tyre sidewall inner edge (offset along stub axle by half tyre width)
  const halfWidth = tyreWidth / 2;
  const tyreInnerPoints = useMemo(() => {
    const offset = stubDir3.clone().multiplyScalar(halfWidth);
    return tyrePoints.map(p => [p[0] + offset.x, p[1] + offset.y, p[2] + offset.z] as [number, number, number]);
  }, [tyrePoints, stubDir3, halfWidth]);

  const tyreOuterPoints = useMemo(() => {
    const offset = stubDir3.clone().multiplyScalar(-halfWidth);
    return tyrePoints.map(p => [p[0] + offset.x, p[1] + offset.y, p[2] + offset.z] as [number, number, number]);
  }, [tyrePoints, stubDir3, halfWidth]);

  // Spoke lines (4 spokes) connecting hub to rim
  const spokePoints = useMemo(() => {
    const spokes: [number, number, number][][] = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const localPt = new THREE.Vector3(
        Math.cos(angle) * rimRadius,
        Math.sin(angle) * rimRadius,
        0,
      );
      localPt.applyQuaternion(quaternion);
      spokes.push([
        wc3,
        [wc3[0] + localPt.x, wc3[1] + localPt.y, wc3[2] + localPt.z],
      ]);
    }
    return spokes;
  }, [wc3, rimRadius, quaternion]);

  return (
    <>
      {/* Stub axle: line from kingpin to hub face */}
      <Line points={[stubOrigin3, hubFace3]} color="#cc8800" lineWidth={3} />

      {/* Hub / wheel centre marker */}
      <mesh position={wc3}>
        <sphereGeometry args={[6, 10, 10]} />
        <meshStandardMaterial color="#cc8800" />
      </mesh>

      {/* Rim circle */}
      <Line points={rimPoints} color="#999999" lineWidth={1.5} />

      {/* Spokes */}
      {spokePoints.map((pts, i) => (
        <Line key={`spoke-${i}`} points={pts} color="#888888" lineWidth={1} />
      ))}

      {/* Tyre outer and inner sidewalls */}
      <Line points={tyreOuterPoints} color="#555555" lineWidth={2} />
      <Line points={tyreInnerPoints} color="#555555" lineWidth={2} />

      {/* Tyre tread (at WC position, same as tyrePoints) — the main tyre circle */}
      <Line points={tyrePoints} color="#444444" lineWidth={2.5} />

      {/* Contact patch marker */}
      <mesh position={cp3}>
        <sphereGeometry args={[5, 8, 8]} />
        <meshStandardMaterial color="#ff4444" />
      </mesh>
    </>
  );
}

/** One complete suspension corner: wishbones, upright, wheel assembly */
function SuspensionCorner({ hp, solvedQ, uprightSpec, tyreRadius }: {
  hp: Hardpoints; solvedQ: number[] | null;
  uprightSpec: UprightSpec; tyreRadius: number;
}) {
  const UBJ: Vec3 = solvedQ ? [solvedQ[0], solvedQ[1], solvedQ[2]] : hp.UBJ;
  const LBJ: Vec3 = solvedQ ? [solvedQ[3], solvedQ[4], solvedQ[5]] : hp.LBJ;
  const TRO: Vec3 = solvedQ ? [solvedQ[6], solvedQ[7], solvedQ[8]] : hp.TRO;

  // Precompute stub axle local direction from STATIC hardpoints (frozen at init).
  // This captures the outboard direction in the upright's reference frame and
  // must NOT be recomputed from solved positions or the rotation cancels out.
  const stubAxleDir0_local = useMemo(
    () => computeStubAxleLocalDir(hp.UBJ, hp.LBJ, hp.TRO),
    [hp.UBJ[0], hp.UBJ[1], hp.UBJ[2], hp.LBJ[0], hp.LBJ[1], hp.LBJ[2], hp.TRO[0], hp.TRO[1], hp.TRO[2]],
  );

  // Compute upright corners: [upperFront, upperRear, lowerRear, lowerFront]
  const { corners } = uprightCorners(UBJ, LBJ);
  const upperFront = corners[0];
  const upperRear = corners[1];
  const lowerRear = corners[2];
  const lowerFront = corners[3];

  // SL/DL rotate with the lower wishbone about the LBIF–LBIR axis
  const SL = rotatePointWithWishbone(hp.SL, hp.LBJ, LBJ, hp.LBIF, hp.LBIR);
  const DL = rotatePointWithWishbone(hp.DL, hp.LBJ, LBJ, hp.LBIF, hp.LBIR);

  return (
    <>
      {/* Fixed points (chassis) */}
      <Sphere pos={hp.UBIF} color="#4488ff" size={5} />
      <Sphere pos={hp.UBIR} color="#4488ff" size={5} />
      <Sphere pos={hp.LBIF} color="#4488ff" size={5} />
      <Sphere pos={hp.LBIR} color="#4488ff" size={5} />
      <Sphere pos={hp.TRI} color="#4488ff" size={4} />
      <Sphere pos={hp.SU} color="#44aa44" size={4} />
      <Sphere pos={hp.DU} color="#cc8844" size={4} />

      {/* Moving points */}
      <Sphere pos={UBJ} color="#ffcc00" size={4} />
      <Sphere pos={LBJ} color="#ffcc00" size={4} />
      <Sphere pos={TRO} color="#ffcc00" size={5} />

      {/* Upper wishbone: front arm → upper front edge, rear arm → upper rear edge */}
      <LinkLine from={hp.UBIF} to={upperFront} color="#6699ff" width={2.5} />
      <LinkLine from={hp.UBIR} to={upperRear} color="#6699ff" width={2.5} />
      <LinkLine from={hp.UBIF} to={hp.UBIR} color="#4477cc" width={1.5} />

      {/* Lower wishbone: front arm → lower front edge, rear arm → lower rear edge */}
      <LinkLine from={hp.LBIF} to={lowerFront} color="#66ccff" width={2.5} />
      <LinkLine from={hp.LBIR} to={lowerRear} color="#66ccff" width={2.5} />
      <LinkLine from={hp.LBIF} to={hp.LBIR} color="#4499aa" width={1.5} />

      {/* Upright trapezoid */}
      <UprightShape ubj={UBJ} lbj={LBJ} tro={TRO} />

      {/* Tie rod */}
      <LinkLine from={hp.TRI} to={TRO} color="#ff6666" width={2} />

      {/* Spring */}
      <LinkLine from={hp.SU} to={SL} color="#44cc44" width={2} />

      {/* Damper */}
      <LinkLine from={hp.DU} to={DL} color="#cc8844" width={2} />

      {/* Stub axle, wheel rim, tyre */}
      <WheelAssembly ubj={UBJ} lbj={LBJ} tro={TRO} uprightSpec={uprightSpec} tyreRadius={tyreRadius} stubAxleDir0_local={stubAxleDir0_local} />
    </>
  );
}

function GroundGrid() {
  const lines = useMemo(() => {
    const result: [number, number, number][][] = [];
    for (let i = -2000; i <= 2000; i += 200) {
      result.push([[i, 0, -2000], [i, 0, 2000]]);
      result.push([[-2000, 0, i], [2000, 0, i]]);
    }
    return result;
  }, []);

  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#333" lineWidth={0.5} />
      ))}
    </>
  );
}

/** Axle lines connecting LHS and RHS ball joints for visual reference */
function AxleLines({
  frontRHS_UBJ, frontLHS_UBJ, frontRHS_LBJ, frontLHS_LBJ,
  rearRHS_UBJ, rearLHS_UBJ, rearRHS_LBJ, rearLHS_LBJ,
}: {
  frontRHS_UBJ: Vec3; frontLHS_UBJ: Vec3; frontRHS_LBJ: Vec3; frontLHS_LBJ: Vec3;
  rearRHS_UBJ: Vec3; rearLHS_UBJ: Vec3; rearRHS_LBJ: Vec3; rearLHS_LBJ: Vec3;
}) {
  return (
    <>
      {/* Front axle reference lines */}
      <LinkLine from={frontRHS_LBJ} to={frontLHS_LBJ} color="#223344" width={1} />
      {/* Rear axle reference lines */}
      <LinkLine from={rearRHS_LBJ} to={rearLHS_LBJ} color="#223344" width={1} />
    </>
  );
}

export const Viewport: React.FC<Props> = ({ frontCorner, rearCorner, frontSolvedQ, frontSolvedQ_LHS, rearSolvedQ, travel, wheelbase }) => {
  const fDx = wheelbase / 2;
  const rDx = -wheelbase / 2;

  const frontHP = frontCorner.hp;
  const rearHP = rearCorner.hp;

  // Front RHS/LHS hardpoints (offset along X)
  const frontRHS_HP = useMemo(() => offsetHardpointsX(frontHP, fDx), [frontHP, fDx]);
  const frontLHS_HP = useMemo(() => mirrorHardpoints(offsetHardpointsX(frontHP, fDx)), [frontHP, fDx]);

  // Rear RHS/LHS hardpoints (offset along X)
  const rearRHS_HP = useMemo(() => offsetHardpointsX(rearHP, rDx), [rearHP, rDx]);
  const rearLHS_HP = useMemo(() => mirrorHardpoints(offsetHardpointsX(rearHP, rDx)), [rearHP, rDx]);

  // Solved states
  const frontRHS_Q = useMemo(() => frontSolvedQ ? offsetQX(frontSolvedQ, fDx) : null, [frontSolvedQ, fDx]);
  const frontLHS_Q = useMemo(() => frontSolvedQ_LHS ? mirrorQ(offsetQX(frontSolvedQ_LHS, fDx)) : null, [frontSolvedQ_LHS, fDx]);
  const rearRHS_Q = useMemo(() => rearSolvedQ ? offsetQX(rearSolvedQ, rDx) : null, [rearSolvedQ, rDx]);
  const rearLHS_Q = useMemo(() => rearSolvedQ ? mirrorQ(offsetQX(rearSolvedQ, rDx)) : null, [rearSolvedQ, rDx]);

  // Ball joint positions for axle lines
  const frLBJ: Vec3 = frontRHS_Q ? [frontRHS_Q[3], frontRHS_Q[4], frontRHS_Q[5]] : frontRHS_HP.LBJ;
  const flLBJ = mirrorY(frLBJ);
  const rrLBJ: Vec3 = rearRHS_Q ? [rearRHS_Q[3], rearRHS_Q[4], rearRHS_Q[5]] : rearRHS_HP.LBJ;
  const rlLBJ = mirrorY(rrLBJ);
  const frUBJ: Vec3 = frontRHS_Q ? [frontRHS_Q[0], frontRHS_Q[1], frontRHS_Q[2]] : frontRHS_HP.UBJ;
  const flUBJ = mirrorY(frUBJ);
  const rrUBJ: Vec3 = rearRHS_Q ? [rearRHS_Q[0], rearRHS_Q[1], rearRHS_Q[2]] : rearRHS_HP.UBJ;
  const rlUBJ = mirrorY(rrUBJ);

  const fUpright = frontCorner.upright;
  const rUpright = rearCorner.upright;
  const fTyreR = frontCorner.tyreRadius;
  const rTyreR = rearCorner.tyreRadius;

  return (
    <div style={{ flex: 1, background: '#111' }}>
      <Canvas
        camera={{ position: [2500, 1000, 1500], fov: 45, near: 1, far: 20000 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[500, 800, 300]} intensity={0.8} />
        <OrbitControls target={[0, 200, 0]} />

        <GroundGrid />

        <SuspensionCorner hp={frontRHS_HP} solvedQ={frontRHS_Q} uprightSpec={fUpright} tyreRadius={fTyreR} />
        <SuspensionCorner hp={frontLHS_HP} solvedQ={frontLHS_Q} uprightSpec={fUpright} tyreRadius={fTyreR} />
        <SuspensionCorner hp={rearRHS_HP} solvedQ={rearRHS_Q} uprightSpec={rUpright} tyreRadius={rTyreR} />
        <SuspensionCorner hp={rearLHS_HP} solvedQ={rearLHS_Q} uprightSpec={rUpright} tyreRadius={rTyreR} />

        <AxleLines
          frontRHS_UBJ={frUBJ} frontLHS_UBJ={flUBJ}
          frontRHS_LBJ={frLBJ} frontLHS_LBJ={flLBJ}
          rearRHS_UBJ={rrUBJ} rearLHS_UBJ={rlUBJ}
          rearRHS_LBJ={rrLBJ} rearLHS_LBJ={rlLBJ}
        />

        <Html position={[0, 20, 0]} style={{ fontSize: 12, color: '#6cf', whiteSpace: 'nowrap' }}>
          Travel: {travel.toFixed(1)} mm
        </Html>
      </Canvas>
    </div>
  );
};
