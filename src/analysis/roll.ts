import type { RollAnalysis, GeometryOutputs, VehicleParams, ARBSpec } from '../model/types';

const G = 9810; // mm/s² (gravity in mm units)

export function computeRollAnalysis(
  frontOutputs: GeometryOutputs[],
  rearOutputs: GeometryOutputs[],
  vehicle: VehicleParams,
  arbFront: ARBSpec,
  arbRear: ARBSpec,
): RollAnalysis {
  // Find static (travel=0) outputs
  const frontStatic = frontOutputs.find(o => Math.abs(o.travel) < 0.5) ?? frontOutputs[Math.floor(frontOutputs.length / 2)];
  const rearStatic = rearOutputs.find(o => Math.abs(o.travel) < 0.5) ?? rearOutputs[Math.floor(rearOutputs.length / 2)];

  const rcFront = frontStatic.rollCentreHeight;
  const rcRear = rearStatic.rollCentreHeight;

  // Wheel rates at static position
  const wheelRateFront = frontStatic.wheelRate;
  const wheelRateRear = rearStatic.wheelRate;

  // Roll rate per axle: 0.5 * track^2 * wheelRate (N·mm/rad)
  const tf = vehicle.trackFront;
  const tr = vehicle.trackRear;

  const rollRateSpringFront = 0.5 * tf * tf * wheelRateFront;
  const rollRateSpringRear = 0.5 * tr * tr * wheelRateRear;

  const rollRateARBFront = 0.5 * tf * tf * arbFront.rate;
  const rollRateARBRear = 0.5 * tr * tr * arbRear.rate;

  const rollRateFront = rollRateSpringFront + rollRateARBFront;
  const rollRateRear = rollRateSpringRear + rollRateARBRear;
  const rollRateTotal = rollRateFront + rollRateRear;

  // Roll axis height at CG longitudinal position
  const cgFromRear = vehicle.wheelbase - vehicle.cgToFrontAxle;
  const rollAxisHeightAtCG = rcRear + (rcFront - rcRear) * (cgFromRear / vehicle.wheelbase);

  const cgAboveRollAxis = vehicle.cgHeight - rollAxisHeightAtCG;

  // Roll gradient: deg per g of lateral acceleration
  // rollAngle = (m * g * h_above_roll_axis) / rollRate
  // At 1g lateral: Fy = m * g
  const rollMomentPerG = vehicle.mass * G * cgAboveRollAxis; // N·mm per g
  const rollGradient = rollRateTotal > 0
    ? (rollMomentPerG / rollRateTotal) * (180 / Math.PI)
    : 0;

  // LLTD: fraction of total lateral load transfer on front axle
  // Elastic transfer is proportional to roll stiffness
  // Geometric transfer depends on roll centre heights
  const totalLTFront = rollRateTotal > 0
    ? (rollRateFront / rollRateTotal)
    : 0.5;

  return {
    rollRateFront,
    rollRateRear,
    rollRateTotal,
    rollGradient,
    lltd: totalLTFront,
    rollCentreHeightFront: rcFront,
    rollCentreHeightRear: rcRear,
  };
}
