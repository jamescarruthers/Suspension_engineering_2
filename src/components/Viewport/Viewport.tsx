import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import type { Hardpoints } from '../../model/types';
import type { Vec3 } from '../../math/Vec3';

interface Props {
  hardpoints: Hardpoints;
  solvedQ: number[] | null;
  travel: number;
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
    () => [[from[0], from[2], -from[1]] as [number, number, number], [to[0], to[2], -to[1]] as [number, number, number]],
    [from, to],
  );
  return <Line points={points} color={color} lineWidth={width} />;
}

const UPRIGHT_HALF_WIDTH = 30; // mm, half-width of the upright rectangle

/**
 * Upright rendered as a rectangle with width at UBJ and LBJ.
 * The rectangle is centred on the kingpin axis and extends perpendicular
 * to it in the upright plane (the plane defined by UBJ, LBJ, TRO).
 * TRO connects to the rectangle via a separate steering arm line.
 */
function UprightRect({ ubj, lbj, tro }: { ubj: Vec3; lbj: Vec3; tro: Vec3 }) {
  // Kingpin axis direction (in suspension coords)
  const kpX = ubj[0] - lbj[0];
  const kpY = ubj[1] - lbj[1];
  const kpZ = ubj[2] - lbj[2];
  const kpLen = Math.sqrt(kpX * kpX + kpY * kpY + kpZ * kpZ);
  const kx = kpX / kpLen, ky = kpY / kpLen, kz = kpZ / kpLen;

  // Vector from LBJ to TRO — use to define the upright plane
  const tx = tro[0] - lbj[0], ty = tro[1] - lbj[1], tz = tro[2] - lbj[2];

  // Component of (LBJ→TRO) perpendicular to kingpin = width direction
  const projDot = tx * kx + ty * ky + tz * kz;
  const perpX = tx - projDot * kx;
  const perpY = ty - projDot * ky;
  const perpZ = tz - projDot * kz;
  const perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
  const wx = perpX / perpLen, wy = perpY / perpLen, wz = perpZ / perpLen;

  // Four corners of the rectangle (in suspension coords)
  const hw = UPRIGHT_HALF_WIDTH;
  const corners: Vec3[] = [
    [ubj[0] + wx * hw, ubj[1] + wy * hw, ubj[2] + wz * hw], // UBJ + width
    [ubj[0] - wx * hw, ubj[1] - wy * hw, ubj[2] - wz * hw], // UBJ - width
    [lbj[0] - wx * hw, lbj[1] - wy * hw, lbj[2] - wz * hw], // LBJ - width
    [lbj[0] + wx * hw, lbj[1] + wy * hw, lbj[2] + wz * hw], // LBJ + width
  ];

  // Convert to Three.js coords (X, Z, -Y)
  const to3 = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p[0], p[2], -p[1]);
  const c0 = to3(corners[0]), c1 = to3(corners[1]), c2 = to3(corners[2]), c3 = to3(corners[3]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      // Two triangles for the quad
      c0.x, c0.y, c0.z, c1.x, c1.y, c1.z, c2.x, c2.y, c2.z,
      c0.x, c0.y, c0.z, c2.x, c2.y, c2.z, c3.x, c3.y, c3.z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, [c0.x, c0.y, c0.z, c1.x, c1.y, c1.z, c2.x, c2.y, c2.z, c3.x, c3.y, c3.z]);

  const edgePoints: [number, number, number][] = [
    [c0.x, c0.y, c0.z],
    [c1.x, c1.y, c1.z],
    [c2.x, c2.y, c2.z],
    [c3.x, c3.y, c3.z],
    [c0.x, c0.y, c0.z],
  ];

  // Steering arm: line from the midpoint of the nearest rectangle edge to TRO
  const troP = to3(tro);
  const ubjP = to3(ubj);
  const lbjP = to3(lbj);

  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#ffcc00" opacity={0.3} transparent side={THREE.DoubleSide} />
      </mesh>
      <Line points={edgePoints} color="#ffcc00" lineWidth={2.5} />
      {/* Kingpin axis centre line */}
      <Line
        points={[[ubjP.x, ubjP.y, ubjP.z], [lbjP.x, lbjP.y, lbjP.z]]}
        color="#ffcc00"
        lineWidth={1}
      />
      {/* Steering arm from upright to TRO */}
      <Line
        points={[
          [(ubjP.x + lbjP.x) / 2, (ubjP.y + lbjP.y) / 2, (ubjP.z + lbjP.z) / 2],
          [troP.x, troP.y, troP.z],
        ]}
        color="#ffaa00"
        lineWidth={2}
      />
    </>
  );
}

function GroundGrid() {
  const lines = useMemo(() => {
    const result: [number, number, number][][] = [];
    for (let i = -1000; i <= 1000; i += 100) {
      result.push([[i, 0, -1500], [i, 0, 500]]);
      result.push([[-1000, 0, i], [1000, 0, i]]);
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

export const Viewport: React.FC<Props> = ({ hardpoints, solvedQ, travel }) => {
  // Use solved positions if available, otherwise static
  const UBJ: Vec3 = solvedQ ? [solvedQ[0], solvedQ[1], solvedQ[2]] : hardpoints.UBJ;
  const LBJ: Vec3 = solvedQ ? [solvedQ[3], solvedQ[4], solvedQ[5]] : hardpoints.LBJ;
  const TRO: Vec3 = solvedQ ? [solvedQ[6], solvedQ[7], solvedQ[8]] : hardpoints.TRO;

  return (
    <div style={{ flex: 1, background: '#111' }}>
      <Canvas
        camera={{ position: [400, 600, 500], fov: 50, near: 1, far: 10000 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[500, 800, 300]} intensity={0.8} />
        <OrbitControls target={[0, 250, -500]} />

        <GroundGrid />

        {/* Fixed points (chassis) — blue */}
        <Sphere pos={hardpoints.UBIF} color="#4488ff" size={5} />
        <Sphere pos={hardpoints.UBIR} color="#4488ff" size={5} />
        <Sphere pos={hardpoints.LBIF} color="#4488ff" size={5} />
        <Sphere pos={hardpoints.LBIR} color="#4488ff" size={5} />
        <Sphere pos={hardpoints.TRI} color="#4488ff" size={4} />
        <Sphere pos={hardpoints.SU} color="#44aa44" size={4} />
        <Sphere pos={hardpoints.DU} color="#cc8844" size={4} />

        {/* Moving points (upright) — yellow */}
        <Sphere pos={UBJ} color="#ffcc00" size={6} />
        <Sphere pos={LBJ} color="#ffcc00" size={6} />
        <Sphere pos={TRO} color="#ffcc00" size={5} />

        {/* Upper wishbone */}
        <LinkLine from={hardpoints.UBIF} to={UBJ} color="#6699ff" width={2.5} />
        <LinkLine from={hardpoints.UBIR} to={UBJ} color="#6699ff" width={2.5} />
        <LinkLine from={hardpoints.UBIF} to={hardpoints.UBIR} color="#4477cc" width={1.5} />

        {/* Lower wishbone */}
        <LinkLine from={hardpoints.LBIF} to={LBJ} color="#66ccff" width={2.5} />
        <LinkLine from={hardpoints.LBIR} to={LBJ} color="#66ccff" width={1.5} />
        <LinkLine from={hardpoints.LBIF} to={hardpoints.LBIR} color="#4499aa" width={1.5} />

        {/* Upright — rectangle with width at UBJ and LBJ */}
        <UprightRect ubj={UBJ} lbj={LBJ} tro={TRO} />

        {/* Tie rod */}
        <LinkLine from={hardpoints.TRI} to={TRO} color="#ff6666" width={2} />

        {/* Spring */}
        <LinkLine from={hardpoints.SU} to={hardpoints.SL} color="#44cc44" width={2} />

        {/* Damper */}
        <LinkLine from={hardpoints.DU} to={hardpoints.DL} color="#cc8844" width={2} />

        {/* Travel indicator */}
        <Html position={[0, 20, -900]} style={{ fontSize: 12, color: '#6cf', whiteSpace: 'nowrap' }}>
          Travel: {travel.toFixed(1)} mm
        </Html>
      </Canvas>
    </div>
  );
};
