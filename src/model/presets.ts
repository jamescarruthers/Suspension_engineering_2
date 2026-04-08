import type { SuspensionModel, CornerSetup } from './types';
import type { Vec3 } from '../math/Vec3';

export interface Preset {
  id: string;
  label: string;
  description: string;
  factory: () => SuspensionModel;
}

function makeCorner(
  hp: Record<string, Vec3>,
  upright: CornerSetup['upright'],
  spring: CornerSetup['spring'],
): CornerSetup {
  return {
    hardpoints: hp as CornerSetup['hardpoints'],
    upright,
    spring,
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

// ─── RACE Software Demo Model ─────────────────────────────────────────
//
// Source: RACE Software double-wishbone demo simulation report.
// Original coords: X rearward, Y rightward, Z up.
// Mapped here to: X forward, Y negative outboard (RHS), Z up,
// with Z shifted so the contact patch sits at Z ≈ 0.
//
// Published KPIs (±50 mm travel):
//   KPI 8.4°, Caster 5.1°, Scrub 21.1 mm, Trail 17.2 mm,
//   RC height 54 mm, Bump camber −20.4 deg/m, Wheel rate 26.4 N/mm.

function createRaceSoftwareModel(): SuspensionModel {
  const frontHP: Record<string, Vec3> = {
    // P1 UCA front inner  [1200, -400, 1303]
    UBIF: [150, -400, 503],
    // P2 UCA rear inner   [1500, -400, 1297]
    UBIR: [-150, -400, 497],
    // P7 UCA outer (UBJ)  [1380, -650, 1330]
    UBJ:  [-30, -650, 530],
    // P3 LCA front inner  [1200, -400, 1000]
    LBIF: [150, -400, 200],
    // P4 LCA rear inner   [1500, -400, 1000]
    LBIR: [-150, -400, 200],
    // P6 LCA outer (LBJ)  [1350, -700, 1000]
    LBJ:  [0, -700, 200],
    // P14 Tie rod inner    [1200, -430, 1050]
    TRI:  [150, -430, 250],
    // P12 Tie rod outer    [1200, -720, 1053]
    TRO:  [150, -720, 253],
    // P55 Damper upper     [1350, -450, 1500]
    DU:   [0, -450, 700],
    // P56 Damper lower     [1350, -640, 1000]
    DL:   [0, -640, 200],
    // Spring upper (estimated, not in original data)
    SU:   [0, -430, 700],
    // P59 Spring lower     [1350, -565, 1200]
    SL:   [0, -565, 400],
  };

  // Rear: same geometry as front but with fixed toe link (no steering)
  const rearHP: Record<string, Vec3> = {
    UBIF: [150, -400, 503],
    UBIR: [-150, -400, 497],
    UBJ:  [-30, -650, 530],
    LBIF: [150, -400, 200],
    LBIR: [-150, -400, 200],
    LBJ:  [0, -700, 200],
    TRI:  [-150, -430, 250],
    TRO:  [-150, -720, 253],
    DU:   [0, -450, 700],
    DL:   [0, -640, 200],
    SU:   [0, -430, 700],
    SL:   [0, -565, 400],
  };

  const upright = { stubAxleRatio: 0.303, stubAxleLength: 80, wheelOffset: 14.85 };

  return {
    front: makeCorner(frontHP, upright, { rate: 30, freeLength: 350, preload: 5000 }),
    rear:  makeCorner(rearHP, upright, { rate: 30, freeLength: 350, preload: 5000 }),
    vehicle: {
      mass: 1600,
      cgHeight: 500,
      wheelbase: 2200,
      cgToFrontAxle: 1100,
      trackFront: 1500,
      trackRear: 1500,
      tyreRadius: 300,
    },
    arbFront: { rate: 15 },
    arbRear: { rate: 10 },
  };
}

// ─── OptimumG Generic Formula Student Car ─────────────────────────────
//
// Source: OptimumG case study (May 2015, 238 pp).
// Original coords: X forward, Y outboard (positive left side), Z up.
// Mapped here: Y negated to match RHS convention.
//
// Published front KPIs:
//   Camber −2.0°, KPI 4.0°, Caster 6.0°, Scrub 38.2 mm,
//   RC height 28.3 mm, FVSA 921.3 mm, Mech trail 24.7 mm.
// Published rear KPIs:
//   Camber −1.0°, KPI 0°, Caster 11.6°, Scrub 61.0 mm,
//   RC height 37.2 mm, FVSA 972.5 mm, Mech trail 63.0 mm.

function createOptimumGFSAEModel(): SuspensionModel {
  const frontHP: Record<string, Vec3> = {
    UBIF: [119.5, -245, 255],
    UBIR: [-130.5, -245, 250],
    UBJ:  [-9.5, -464, 323],
    LBIF: [114.5, -210, 120],
    LBIR: [-125.5, -210, 125],
    LBJ:  [8.5, -476, 153],
    TRI:  [65, -131, 150],
    TRO:  [72.5, -476.6, 200.8],
    SU:   [0, -250, 400],
    SL:   [0, -450, 160],
    DU:   [0, -260, 410],
    DL:   [0, -440, 155],
  };

  const rearHP: Record<string, Vec3> = {
    UBIF: [176.5, -215, 250],
    UBIR: [-93.5, -215, 255],
    UBJ:  [-3.5, -464, 323],
    LBIF: [156.5, -185, 130],
    LBIR: [-103.5, -185, 125],
    LBJ:  [31.5, -464, 153],
    TRI:  [-128.5, -185, 125],
    TRO:  [-68.5, -464, 153],
    SU:   [0, -220, 400],
    SL:   [0, -430, 150],
    DU:   [0, -230, 410],
    DL:   [0, -420, 145],
  };

  const frontUpright = { stubAxleRatio: 0.453, stubAxleLength: 70, wheelOffset: 15.6 };
  const rearUpright = { stubAxleRatio: 0.453, stubAxleLength: 75, wheelOffset: 14 };

  return {
    front: makeCorner(frontHP, frontUpright, { rate: 26, freeLength: 200, preload: 100 }),
    rear:  makeCorner(rearHP, rearUpright, { rate: 30, freeLength: 200, preload: 100 }),
    vehicle: {
      mass: 212,
      cgHeight: 174,
      wheelbase: 1550,
      cgToFrontAxle: 750,
      trackFront: 1050,
      trackRear: 1050,
      tyreRadius: 230,
    },
    arbFront: { rate: 8 },
    arbRear: { rate: 5 },
  };
}

export const PRESETS: Preset[] = [
  {
    id: 'race-software',
    label: 'RACE Software Demo',
    description: 'Road car double-wishbone from the RACE Software demo report. KPI 8.4\u00B0, caster 5.1\u00B0, RC 54 mm.',
    factory: createRaceSoftwareModel,
  },
  {
    id: 'optimumg-fsae',
    label: 'OptimumG FSAE',
    description: 'Generic Formula Student car from the OptimumG case study. Front + rear with pullrod geometry.',
    factory: createOptimumGFSAEModel,
  },
];
