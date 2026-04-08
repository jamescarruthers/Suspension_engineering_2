import { useMemo } from 'react';
import type { SuspensionModel, GeometryOutputs, RollAnalysis } from '../model/types';
import { runSweep, type SweepOutput } from '../solver/sweep';
import { computeRollAnalysis } from '../analysis/roll';

export interface SolverResult {
  frontSweep: SweepOutput;
  rearSweep: SweepOutput;
  rollAnalysis: RollAnalysis;
}

export function useSolver(model: SuspensionModel, rackTravel: number): SolverResult | null {
  return useMemo(() => {
    try {
      const frontSweep = runSweep(
        model.front.hardpoints,
        model.front.upright,
        model.vehicle.tyreRadius,
        model.front.spring.rate,
        { minTravel: -80, maxTravel: 80, step: 2, rackTravel },
      );

      const rearSweep = runSweep(
        model.rear.hardpoints,
        model.rear.upright,
        model.vehicle.tyreRadius,
        model.rear.spring.rate,
        { minTravel: -80, maxTravel: 80, step: 2, rackTravel: 0 }, // rear doesn't steer
      );

      const rollAnalysis = computeRollAnalysis(
        frontSweep.outputs,
        rearSweep.outputs,
        model.vehicle,
        model.arbFront,
        model.arbRear,
      );

      return { frontSweep, rearSweep, rollAnalysis };
    } catch (e) {
      console.error('Solver error:', e);
      return null;
    }
  }, [model, rackTravel]);
}
