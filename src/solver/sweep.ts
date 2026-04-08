import type { Hardpoints, UprightSpec, GeometryOutputs } from '../model/types';
import { createConstraintContext } from './constraints';
import { solve } from './newton';
import { extractGeometryOutputs } from '../analysis/geometry';
import { dist } from '../math/Vec3';

export interface SweepConfig {
  minTravel: number;  // mm, negative = droop
  maxTravel: number;  // mm, positive = bump
  step: number;       // mm
  rackTravel: number; // mm
}

export interface SweepOutput {
  outputs: GeometryOutputs[];
  solvedStates: number[][];
}

export function runSweep(
  hardpoints: Hardpoints,
  uprightSpec: UprightSpec,
  tyreRadius: number,
  springRate: number,
  config: SweepConfig,
): SweepOutput {
  const ctx = createConstraintContext(hardpoints, uprightSpec, tyreRadius);

  // Initial state: static hardpoint positions
  const q0 = [
    ...hardpoints.UBJ,
    ...hardpoints.LBJ,
    ...hardpoints.TRO,
  ];

  // Static spring/damper lengths
  const springLength0 = dist(hardpoints.SU, hardpoints.SL);
  const damperLength0 = dist(hardpoints.DU, hardpoints.DL);

  const outputs: GeometryOutputs[] = [];
  const solvedStates: number[][] = [];

  // Sweep from 0 to +maxTravel (bump)
  const bumpSteps: number[] = [];
  for (let t = 0; t <= config.maxTravel; t += config.step) {
    bumpSteps.push(t);
  }

  // Sweep from 0 to minTravel (droop)
  const droopSteps: number[] = [];
  for (let t = -config.step; t >= config.minTravel; t -= config.step) {
    droopSteps.push(t);
  }

  const allResults: { travel: number; q: number[] }[] = [];

  // Forward sweep (bump)
  let qPrev = q0;
  for (const t of bumpSteps) {
    try {
      const q = solve(qPrev, t, config.rackTravel, ctx);
      allResults.push({ travel: t, q });
      qPrev = q;
    } catch {
      break; // mechanism limit reached
    }
  }

  // Backward sweep (droop) — restart from static
  qPrev = q0;
  for (const t of droopSteps) {
    try {
      const q = solve(qPrev, t, config.rackTravel, ctx);
      allResults.push({ travel: t, q });
      qPrev = q;
    } catch {
      break;
    }
  }

  // Sort by travel
  allResults.sort((a, b) => a.travel - b.travel);

  // Extract geometry outputs
  for (let i = 0; i < allResults.length; i++) {
    const { travel, q } = allResults[i];

    // Compute spring/damper lengths from solved upright
    // SL and DL move with the lower wishbone. Approximate by rigid-body displacement.
    // For more accuracy, we'd need to track which arm SL/DL attach to.
    // Simple approach: SL moves with LBJ's displacement from static
    const lbjDisp = [
      q[3] - hardpoints.LBJ[0],
      q[4] - hardpoints.LBJ[1],
      q[5] - hardpoints.LBJ[2],
    ];
    const SL_moved: [number, number, number] = [
      hardpoints.SL[0] + lbjDisp[0],
      hardpoints.SL[1] + lbjDisp[1],
      hardpoints.SL[2] + lbjDisp[2],
    ];
    const DL_moved: [number, number, number] = [
      hardpoints.DL[0] + lbjDisp[0],
      hardpoints.DL[1] + lbjDisp[1],
      hardpoints.DL[2] + lbjDisp[2],
    ];

    const springLen = dist(hardpoints.SU, SL_moved);
    const damperLen = dist(hardpoints.DU, DL_moved);

    // Motion ratios via finite difference
    let mrSpring = 0;
    let mrDamper = 0;
    if (i > 0 && i < allResults.length - 1) {
      const prev = allResults[i - 1];
      const next = allResults[i + 1];

      const prevLbjDisp = [
        prev.q[3] - hardpoints.LBJ[0],
        prev.q[4] - hardpoints.LBJ[1],
        prev.q[5] - hardpoints.LBJ[2],
      ];
      const nextLbjDisp = [
        next.q[3] - hardpoints.LBJ[0],
        next.q[4] - hardpoints.LBJ[1],
        next.q[5] - hardpoints.LBJ[2],
      ];

      const prevSL: [number, number, number] = [
        hardpoints.SL[0] + prevLbjDisp[0],
        hardpoints.SL[1] + prevLbjDisp[1],
        hardpoints.SL[2] + prevLbjDisp[2],
      ];
      const nextSL: [number, number, number] = [
        hardpoints.SL[0] + nextLbjDisp[0],
        hardpoints.SL[1] + nextLbjDisp[1],
        hardpoints.SL[2] + nextLbjDisp[2],
      ];
      const prevDL: [number, number, number] = [
        hardpoints.DL[0] + prevLbjDisp[0],
        hardpoints.DL[1] + prevLbjDisp[1],
        hardpoints.DL[2] + prevLbjDisp[2],
      ];
      const nextDL: [number, number, number] = [
        hardpoints.DL[0] + nextLbjDisp[0],
        hardpoints.DL[1] + nextLbjDisp[1],
        hardpoints.DL[2] + nextLbjDisp[2],
      ];

      const prevSpringLen = dist(hardpoints.SU, prevSL);
      const nextSpringLen = dist(hardpoints.SU, nextSL);
      const prevDamperLen = dist(hardpoints.DU, prevDL);
      const nextDamperLen = dist(hardpoints.DU, nextDL);

      const dt = next.travel - prev.travel;
      mrSpring = (nextSpringLen - prevSpringLen) / dt;
      mrDamper = (nextDamperLen - prevDamperLen) / dt;
    }

    const geo = extractGeometryOutputs(
      q, travel, hardpoints, uprightSpec, ctx.stubAxleDir0_local, tyreRadius,
    );

    outputs.push({
      ...geo,
      springLength: springLen,
      damperLength: damperLen,
      motionRatioSpring: Math.abs(mrSpring),
      motionRatioDamper: Math.abs(mrDamper),
      wheelRate: springRate * mrSpring * mrSpring,
    });
    solvedStates.push(q);
  }

  // Fix motion ratio at endpoints (copy from neighbors)
  if (outputs.length > 1) {
    outputs[0].motionRatioSpring = outputs[1].motionRatioSpring;
    outputs[0].motionRatioDamper = outputs[1].motionRatioDamper;
    outputs[0].wheelRate = outputs[1].wheelRate;
    const last = outputs.length - 1;
    outputs[last].motionRatioSpring = outputs[last - 1].motionRatioSpring;
    outputs[last].motionRatioDamper = outputs[last - 1].motionRatioDamper;
    outputs[last].wheelRate = outputs[last - 1].wheelRate;
  }

  return { outputs, solvedStates };
}
