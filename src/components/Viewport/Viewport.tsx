import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import type { Hardpoints } from '../../model/types';
import type { Vec3 } from '../../math/Vec3';
import { rotatePointWithWishbone } from '../../solver/wishboneRotation';

interface Props {
  frontHP: Hardpoints;
  rearHP: Hardpoints;
  frontSolvedQ: number[] | null;       // Front RHS
  frontSolvedQ_LHS: number[] | null;   // Front LHS (solved with negated rack)
  rearSolvedQ: number[] | null;
  travel: number;
  wheelbase: number; // mm, used to separate front/rear axles along X
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

/** One complete suspension corner: wishbones connect to upright edges, not central ball joints */
function SuspensionCorner({ hp, solvedQ }: { hp: Hardpoints; solvedQ: number[] | null }) {
  const UBJ: Vec3 = solvedQ ? [solvedQ[0], solvedQ[1], solvedQ[2]] : hp.UBJ;
  const LBJ: Vec3 = solvedQ ? [solvedQ[3], solvedQ[4], solvedQ[5]] : hp.LBJ;
  const TRO: Vec3 = solvedQ ? [solvedQ[6], solvedQ[7], solvedQ[8]] : hp.TRO;

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

export const Viewport: React.FC<Props> = ({ frontHP, rearHP, frontSolvedQ, frontSolvedQ_LHS, rearSolvedQ, travel, wheelbase }) => {
  // Offset: front at +wheelbase/2, rear at -wheelbase/2 so the car is centred at X=0
  const fDx = wheelbase / 2;
  const rDx = -wheelbase / 2;

  // Front RHS/LHS hardpoints (offset along X)
  const frontRHS_HP = useMemo(() => offsetHardpointsX(frontHP, fDx), [frontHP, fDx]);
  const frontLHS_HP = useMemo(() => mirrorHardpoints(offsetHardpointsX(frontHP, fDx)), [frontHP, fDx]);

  // Rear RHS/LHS hardpoints (offset along X)
  const rearRHS_HP = useMemo(() => offsetHardpointsX(rearHP, rDx), [rearHP, rDx]);
  const rearLHS_HP = useMemo(() => mirrorHardpoints(offsetHardpointsX(rearHP, rDx)), [rearHP, rDx]);

  // Front RHS solved state: just offset X
  const frontRHS_Q = useMemo(() => frontSolvedQ ? offsetQX(frontSolvedQ, fDx) : null, [frontSolvedQ, fDx]);
  // Front LHS solved state: use the separately-solved LHS result (negated rack travel),
  // then offset X and mirror Y so it displays on the left side
  const frontLHS_Q = useMemo(() => frontSolvedQ_LHS ? mirrorQ(offsetQX(frontSolvedQ_LHS, fDx)) : null, [frontSolvedQ_LHS, fDx]);
  // Rear: symmetric (no steering), mirror is fine
  const rearRHS_Q = useMemo(() => rearSolvedQ ? offsetQX(rearSolvedQ, rDx) : null, [rearSolvedQ, rDx]);
  const rearLHS_Q = useMemo(() => rearSolvedQ ? mirrorQ(offsetQX(rearSolvedQ, rDx)) : null, [rearSolvedQ, rDx]);

  // Ball joint positions for axle lines
  const frLBJ: Vec3 = frontRHS_Q ? [frontRHS_Q[3], frontRHS_Q[4], frontRHS_Q[5]] : frontRHS_HP.LBJ;
  const flLBJ = mirrorY(frLBJ);
  const rrLBJ: Vec3 = rearRHS_Q ? [rearRHS_Q[3], rearRHS_Q[4], rearRHS_Q[5]] : rearRHS_HP.LBJ;
  const rlLBJ = mirrorY(rrLBJ);

  // Dummy values for unused axle line props
  const frUBJ: Vec3 = frontRHS_Q ? [frontRHS_Q[0], frontRHS_Q[1], frontRHS_Q[2]] : frontRHS_HP.UBJ;
  const flUBJ = mirrorY(frUBJ);
  const rrUBJ: Vec3 = rearRHS_Q ? [rearRHS_Q[0], rearRHS_Q[1], rearRHS_Q[2]] : rearRHS_HP.UBJ;
  const rlUBJ = mirrorY(rrUBJ);

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

        {/* Front RHS */}
        <SuspensionCorner hp={frontRHS_HP} solvedQ={frontRHS_Q} />
        {/* Front LHS (mirrored) */}
        <SuspensionCorner hp={frontLHS_HP} solvedQ={frontLHS_Q} />
        {/* Rear RHS */}
        <SuspensionCorner hp={rearRHS_HP} solvedQ={rearRHS_Q} />
        {/* Rear LHS (mirrored) */}
        <SuspensionCorner hp={rearLHS_HP} solvedQ={rearLHS_Q} />

        {/* Axle reference lines */}
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
