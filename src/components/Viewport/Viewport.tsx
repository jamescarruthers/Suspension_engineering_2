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

/** Upright rendered as a filled triangle (UBJ–LBJ–TRO) with outline edges */
function UprightTriangle({ ubj, lbj, tro }: { ubj: Vec3; lbj: Vec3; tro: Vec3 }) {
  // Convert to Three.js coords (X, Z, -Y)
  const a = new THREE.Vector3(ubj[0], ubj[2], -ubj[1]);
  const b = new THREE.Vector3(lbj[0], lbj[2], -lbj[1]);
  const c = new THREE.Vector3(tro[0], tro[2], -tro[1]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // Two-sided triangle: vertices for both winding orders
    const verts = new Float32Array([
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z,
      // reverse winding for back face
      a.x, a.y, a.z,
      c.x, c.y, c.z,
      b.x, b.y, b.z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z]);

  const edgePoints: [number, number, number][] = [
    [a.x, a.y, a.z],
    [b.x, b.y, b.z],
    [c.x, c.y, c.z],
    [a.x, a.y, a.z],
  ];

  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#ffcc00" opacity={0.25} transparent side={THREE.DoubleSide} />
      </mesh>
      <Line points={edgePoints} color="#ffcc00" lineWidth={2.5} />
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

        {/* Upright — triangular frame with visible area */}
        <UprightTriangle ubj={UBJ} lbj={LBJ} tro={TRO} />

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
