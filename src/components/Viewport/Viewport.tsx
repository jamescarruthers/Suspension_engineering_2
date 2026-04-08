import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import type { Hardpoints } from '../../model/types';
import type { Vec3 } from '../../math/Vec3';

interface Props {
  frontHP: Hardpoints;
  rearHP: Hardpoints;
  frontSolvedQ: number[] | null;
  rearSolvedQ: number[] | null;
  travel: number;
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

const UPRIGHT_HALF_WIDTH = 30;

function UprightRect({ ubj, lbj, tro }: { ubj: Vec3; lbj: Vec3; tro: Vec3 }) {
  const kpX = ubj[0] - lbj[0];
  const kpY = ubj[1] - lbj[1];
  const kpZ = ubj[2] - lbj[2];
  const kpLen = Math.sqrt(kpX * kpX + kpY * kpY + kpZ * kpZ);
  const kx = kpX / kpLen, ky = kpY / kpLen, kz = kpZ / kpLen;

  const tx = tro[0] - lbj[0], ty = tro[1] - lbj[1], tz = tro[2] - lbj[2];
  const projDot = tx * kx + ty * ky + tz * kz;
  const perpX = tx - projDot * kx;
  const perpY = ty - projDot * ky;
  const perpZ = tz - projDot * kz;
  const perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
  const wx = perpX / perpLen, wy = perpY / perpLen, wz = perpZ / perpLen;

  const hw = UPRIGHT_HALF_WIDTH;
  const corners: Vec3[] = [
    [ubj[0] + wx * hw, ubj[1] + wy * hw, ubj[2] + wz * hw],
    [ubj[0] - wx * hw, ubj[1] - wy * hw, ubj[2] - wz * hw],
    [lbj[0] - wx * hw, lbj[1] - wy * hw, lbj[2] - wz * hw],
    [lbj[0] + wx * hw, lbj[1] + wy * hw, lbj[2] + wz * hw],
  ];

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
      <Line points={[[ubjP.x, ubjP.y, ubjP.z], [lbjP.x, lbjP.y, lbjP.z]]} color="#ffcc00" lineWidth={1} />
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

/** One complete suspension corner: wishbones, upright, tie rod, spring, damper */
function SuspensionCorner({ hp, solvedQ }: { hp: Hardpoints; solvedQ: number[] | null }) {
  const UBJ: Vec3 = solvedQ ? [solvedQ[0], solvedQ[1], solvedQ[2]] : hp.UBJ;
  const LBJ: Vec3 = solvedQ ? [solvedQ[3], solvedQ[4], solvedQ[5]] : hp.LBJ;
  const TRO: Vec3 = solvedQ ? [solvedQ[6], solvedQ[7], solvedQ[8]] : hp.TRO;

  // SL/DL move with LBJ displacement
  const lbjDisp: Vec3 = [
    LBJ[0] - hp.LBJ[0],
    LBJ[1] - hp.LBJ[1],
    LBJ[2] - hp.LBJ[2],
  ];
  const SL: Vec3 = [hp.SL[0] + lbjDisp[0], hp.SL[1] + lbjDisp[1], hp.SL[2] + lbjDisp[2]];
  const DL: Vec3 = [hp.DL[0] + lbjDisp[0], hp.DL[1] + lbjDisp[1], hp.DL[2] + lbjDisp[2]];

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
      <Sphere pos={UBJ} color="#ffcc00" size={6} />
      <Sphere pos={LBJ} color="#ffcc00" size={6} />
      <Sphere pos={TRO} color="#ffcc00" size={5} />

      {/* Upper wishbone */}
      <LinkLine from={hp.UBIF} to={UBJ} color="#6699ff" width={2.5} />
      <LinkLine from={hp.UBIR} to={UBJ} color="#6699ff" width={2.5} />
      <LinkLine from={hp.UBIF} to={hp.UBIR} color="#4477cc" width={1.5} />

      {/* Lower wishbone */}
      <LinkLine from={hp.LBIF} to={LBJ} color="#66ccff" width={2.5} />
      <LinkLine from={hp.LBIR} to={LBJ} color="#66ccff" width={2.5} />
      <LinkLine from={hp.LBIF} to={hp.LBIR} color="#4499aa" width={1.5} />

      {/* Upright */}
      <UprightRect ubj={UBJ} lbj={LBJ} tro={TRO} />

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

export const Viewport: React.FC<Props> = ({ frontHP, rearHP, frontSolvedQ, rearSolvedQ, travel }) => {
  // Mirror hardpoints for LHS
  const frontLHS_HP = useMemo(() => mirrorHardpoints(frontHP), [frontHP]);
  const rearLHS_HP = useMemo(() => mirrorHardpoints(rearHP), [rearHP]);

  // Mirror solved states for LHS
  const frontLHS_Q = useMemo(() => frontSolvedQ ? mirrorQ(frontSolvedQ) : null, [frontSolvedQ]);
  const rearLHS_Q = useMemo(() => rearSolvedQ ? mirrorQ(rearSolvedQ) : null, [rearSolvedQ]);

  // Get ball joint positions for axle lines
  const frUBJ: Vec3 = frontSolvedQ ? [frontSolvedQ[0], frontSolvedQ[1], frontSolvedQ[2]] : frontHP.UBJ;
  const frLBJ: Vec3 = frontSolvedQ ? [frontSolvedQ[3], frontSolvedQ[4], frontSolvedQ[5]] : frontHP.LBJ;
  const flUBJ = mirrorY(frUBJ);
  const flLBJ = mirrorY(frLBJ);
  const rrUBJ: Vec3 = rearSolvedQ ? [rearSolvedQ[0], rearSolvedQ[1], rearSolvedQ[2]] : rearHP.UBJ;
  const rrLBJ: Vec3 = rearSolvedQ ? [rearSolvedQ[3], rearSolvedQ[4], rearSolvedQ[5]] : rearHP.LBJ;
  const rlUBJ = mirrorY(rrUBJ);
  const rlLBJ = mirrorY(rrLBJ);

  return (
    <div style={{ flex: 1, background: '#111' }}>
      <Canvas
        camera={{ position: [1500, 800, 1200], fov: 45, near: 1, far: 20000 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[500, 800, 300]} intensity={0.8} />
        <OrbitControls target={[0, 250, 0]} />

        <GroundGrid />

        {/* Front RHS */}
        <SuspensionCorner hp={frontHP} solvedQ={frontSolvedQ} />
        {/* Front LHS (mirrored) */}
        <SuspensionCorner hp={frontLHS_HP} solvedQ={frontLHS_Q} />
        {/* Rear RHS */}
        <SuspensionCorner hp={rearHP} solvedQ={rearSolvedQ} />
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
