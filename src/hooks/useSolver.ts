import { useMemo } from 'react';
import type { SuspensionModel, RollAnalysis } from '../model/types';
import { runSweep, type SweepOutput } from '../solver/sweep';
import { computeRollAnalysis } from '../analysis/roll';

export interface SolverResult {
  frontSweep: SweepOutput;      // Front RHS
  frontSweepLHS: SweepOutput;   // Front LHS (solved with negated rack travel)
  rearSweep: SweepOutput;
  rollAnalysis: RollAnalysis;
}

export function useSolver(model: SuspensionModel, rackTravel: number): SolverResult | null {
  return useMemo(() => {
    try {
      // Front RHS: rack shifts TRI in +Y (inboard for RHS)
      const frontSweep = runSweep(
        model.front.hardpoints,
        model.front.upright,
        model.vehicle.tyreRadius,
        model.front.spring.rate,
        { minTravel: -80, maxTravel: 80, step: 2, rackTravel },
      );

      // Front LHS: same geometry but rack pushes TRI the opposite local direction.
      // Since both sides share the same RHS hardpoint definition and we mirror
      // for display, we solve with negated rack travel so the LHS wheel turns
      // in the correct (same global) direction as RHS.
      const frontSweepLHS = runSweep(
        model.front.hardpoints,
        model.front.upright,
        model.vehicle.tyreRadius,
        model.front.spring.rate,
        { minTravel: -80, maxTravel: 80, step: 2, rackTravel: -rackTravel },
      );

      const rearSweep = runSweep(
        model.rear.hardpoints,
        model.rear.upright,
        model.vehicle.tyreRadius,
        model.rear.spring.rate,
        { minTravel: -80, maxTravel: 80, step: 2, rackTravel: 0 },
      );

      const rollAnalysis = computeRollAnalysis(
        frontSweep.outputs,
        rearSweep.outputs,
        model.vehicle,
        model.arbFront,
        model.arbRear,
      );

      return { frontSweep, frontSweepLHS, rearSweep, rollAnalysis };
    } catch (e) {
      console.error('Solver error:', e);
      return null;
    }
  }, [model, rackTravel]);
}
