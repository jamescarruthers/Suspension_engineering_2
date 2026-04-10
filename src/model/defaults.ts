import type { CornerSetup, SuspensionModel, VehicleParams } from './types';
import type { Vec3 } from '../math/Vec3';

const frontHardpoints: Record<string, Vec3> = {
  UBIF: [100, -350, 350],
  UBIR: [-100, -350, 350],
  UBJ:  [0, -700, 340],
  LBIF: [150, -200, 150],
  LBIR: [-150, -200, 150],
  LBJ:  [0, -750, 130],
  TRI:  [80, -150, 200],
  TRO:  [80, -700, 200],
  SU:   [-30, -400, 550],
  SL:   [-30, -650, 200],
  DU:   [-30, -380, 560],
  DL:   [-30, -640, 190],
};

// Rear suspension — longer arms, no steering (TRI/TRO are a fixed-length toe link)
const rearHardpoints: Record<string, Vec3> = {
  UBIF: [100, -350, 340],
  UBIR: [-100, -350, 340],
  UBJ:  [0, -700, 330],
  LBIF: [150, -200, 140],
  LBIR: [-150, -200, 140],
  LBJ:  [0, -750, 120],
  TRI:  [-80, -200, 180],
  TRO:  [-80, -700, 180],
  SU:   [-30, -400, 540],
  SL:   [-30, -650, 190],
  DU:   [-30, -380, 550],
  DL:   [-30, -640, 180],
};

const defaultVehicle: VehicleParams = {
  mass: 1400,
  cgHeight: 450,
  wheelbase: 2600,
  cgToFrontAxle: 1300,
  trackFront: 1550,
  trackRear: 1550,
  tyreRadius: 310,
};

function makeCorner(hp: Record<string, Vec3>): CornerSetup {
  return {
    hardpoints: hp as CornerSetup['hardpoints'],
    upright: {
      stubAxleRatio: 0.85,
      stubAxleLength: 50,
      wheelOffset: 35,
      stubAxleCamber: -1.5,  // deg, slight negative camber
      stubAxleCaster: 6,     // deg, positive tilts stub axle forward (+X)
    },
    spring: {
      rate: 30,        // N/mm
      freeLength: 300,
      preload: 200,
    },
    damper: {
      bump: [
        { velocity: 0, force: 0 },
        { velocity: 50, force: 500 },
        { velocity: 100, force: 900 },
        { velocity: 200, force: 1500 },
      ],
      rebound: [
        { velocity: 0, force: 0 },
        { velocity: 50, force: 800 },
        { velocity: 100, force: 1400 },
        { velocity: 200, force: 2200 },
      ],
    },
  };
}

export function createDefaultModel(): SuspensionModel {
  return {
    front: makeCorner(frontHardpoints),
    rear: makeCorner(rearHardpoints),
    vehicle: defaultVehicle,
    arbFront: { rate: 15 },
    arbRear: { rate: 8 },
  };
}
