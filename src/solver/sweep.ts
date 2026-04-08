import type { Hardpoints, UprightSpec, GeometryOutputs } from '../model/types';
import type { Vec3 } from '../math/Vec3';
import { createConstraintContext } from './constraints';
import { solve } from './newton';
import { extractGeometryOutputs } from '../analysis/geometry';
import { dist } from '../math/Vec3';
import { rotatePointWithWishbone } from './wishboneRotation';

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

    // SL and DL are on the lower wishbone — rotate with it about the LBIF–LBIR axis
    const LBJ_solved: Vec3 = [q[3], q[4], q[5]];
    const SL_moved = rotatePointWithWishbone(
      hardpoints.SL, hardpoints.LBJ, LBJ_solved, hardpoints.LBIF, hardpoints.LBIR,
    );
    const DL_moved = rotatePointWithWishbone(
      hardpoints.DL, hardpoints.LBJ, LBJ_solved, hardpoints.LBIF, hardpoints.LBIR,
    );

    const springLen = dist(hardpoints.SU, SL_moved);
    const damperLen = dist(hardpoints.DU, DL_moved);

    // Motion ratios via finite difference
    let mrSpring = 0;
    let mrDamper = 0;
    if (i > 0 && i < allResults.length - 1) {
      const prev = allResults[i - 1];
      const next = allResults[i + 1];

      const prevLBJ: Vec3 = [prev.q[3], prev.q[4], prev.q[5]];
      const nextLBJ: Vec3 = [next.q[3], next.q[4], next.q[5]];

      const prevSL = rotatePointWithWishbone(hardpoints.SL, hardpoints.LBJ, prevLBJ, hardpoints.LBIF, hardpoints.LBIR);
      const nextSL = rotatePointWithWishbone(hardpoints.SL, hardpoints.LBJ, nextLBJ, hardpoints.LBIF, hardpoints.LBIR);
      const prevDL = rotatePointWithWishbone(hardpoints.DL, hardpoints.LBJ, prevLBJ, hardpoints.LBIF, hardpoints.LBIR);
      const nextDL = rotatePointWithWishbone(hardpoints.DL, hardpoints.LBJ, nextLBJ, hardpoints.LBIF, hardpoints.LBIR);

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
