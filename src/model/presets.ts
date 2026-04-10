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
//
// Coordinate mapping:
//   Original: X rearward, Y rightward, Z up.
//   Mapped:   X_tool = -(X_race - 1350), Y_tool = Y_race, Z_tool = Z_race - 800
//   This centres X on the wheel and puts the contact patch at Z ≈ 0.
//
// FROM BENCHMARK (published values):
//   Hardpoints P1-P7, P3-P6, P9, P12, P14, P55, P56, P59 — see inline
//   Tyre loaded radius:  300 mm
//   Spring rate:         30 N/mm
//   Spring preload:      5000 N
//   Wheelbase:           2200 mm
//   Track at CP:         1500.4 mm  →  half-track ≈ 750 mm
//   Wheel centre P9:     [1350, -750, 1100] in original coords
//
// DERIVED (not in benchmark — reverse-engineered to place wheel centre):
//   stubAxleRatio 0.303  — from (WC_z - LBJ_z) / (UBJ_z - LBJ_z) = 100/330
//   stubAxleLength 80 mm — chosen so stubAxleLength − wheelOffset = 65.15
//   wheelOffset 14.85 mm — from WC_y − stubOrigin_y along the stub axle
//   This gives WC ≈ [−9, −750, 300], placing CP at Z ≈ 0.
//   The 9 mm X-offset from ideal causes ~10 mm error in mechanical trail.
//
// ESTIMATED (not in benchmark):
//   SU (spring upper) — RACE data only gives spring lower (P59).
//   Vehicle mass, CG height — not published; set to plausible road-car values.
//   Damper F-V curves — generic; RACE data is compliance-based, not F-V.
//
// Published KPIs (±50 mm travel):
//   KPI 8.4°, Caster 5.1°, Scrub 21.1 mm, Trail 17.2 mm,
//   RC height 54 mm, Bump camber −20.4 deg/m, Wheel rate 26.4 N/mm.

function createRaceSoftwareModel(): SuspensionModel {
  const frontHP: Record<string, Vec3> = {
    UBIF: [150, -400, 503],   // P1 UCA front inner  [1200, -400, 1303]
    UBIR: [-150, -400, 497],  // P2 UCA rear inner   [1500, -400, 1297]
    UBJ:  [-30, -650, 530],   // P7 UCA outer (UBJ)  [1380, -650, 1330]
    LBIF: [150, -400, 200],   // P3 LCA front inner  [1200, -400, 1000]
    LBIR: [-150, -400, 200],  // P4 LCA rear inner   [1500, -400, 1000]
    LBJ:  [0, -700, 200],     // P6 LCA outer (LBJ)  [1350, -700, 1000]
    TRI:  [150, -430, 250],   // P14 Tie rod inner   [1200, -430, 1050]
    TRO:  [150, -720, 253],   // P12 Tie rod outer   [1200, -720, 1053]
    DU:   [0, -450, 700],     // P55 Damper upper    [1350, -450, 1500]
    DL:   [0, -640, 200],     // P56 Damper lower    [1350, -640, 1000]
    SU:   [0, -430, 700],     // ESTIMATED — not in RACE data
    SL:   [0, -565, 400],     // P59 Spring lower    [1350, -565, 1200]
  };

  // Rear: same geometry as front but with fixed toe link (no steering).
  // RACE demo only publishes one corner; rear is mirrored with toe link reversed.
  const rearHP: Record<string, Vec3> = {
    UBIF: [150, -400, 503],
    UBIR: [-150, -400, 497],
    UBJ:  [-30, -650, 530],
    LBIF: [150, -400, 200],
    LBIR: [-150, -400, 200],
    LBJ:  [0, -700, 200],
    TRI:  [-150, -430, 250],  // Reversed X for rear toe link
    TRO:  [-150, -720, 253],
    DU:   [0, -450, 700],
    DL:   [0, -640, 200],
    SU:   [0, -430, 700],
    SL:   [0, -565, 400],
  };

  // DERIVED — see header comment for derivation
  const upright = { stubAxleRatio: 0.303, stubAxleLength: 80, wheelOffset: 14.85, stubAxleCamber: 0, stubAxleCaster: 0 };
  const upright = { stubAxleRatio: 0.303, stubAxleLength: 80, wheelOffset: 14.85 };

  return {
    front: makeCorner(frontHP, upright,
      { rate: 30, freeLength: 350, preload: 5000 }),  // rate + preload from benchmark
    rear: makeCorner(rearHP, upright,
      { rate: 30, freeLength: 350, preload: 5000 }),
    vehicle: {
      mass: 1600,            // ESTIMATED — not published
      cgHeight: 500,         // ESTIMATED — not published
      wheelbase: 2200,       // from benchmark
      cgToFrontAxle: 1100,   // ESTIMATED — assumed 50/50
      trackFront: 1500,      // from benchmark (1500.4 mm at CP)
      trackRear: 1500,       // assumed same as front
      tyreRadius: 300,       // from benchmark
    },
    arbFront: { rate: 15 },  // ESTIMATED
    arbRear: { rate: 10 },   // ESTIMATED
  };
}

// ─── OptimumG Generic Formula Student Car ─────────────────────────────
//
// Source: OptimumG case study (May 2015, 238 pp).
//
// Coordinate mapping:
//   Original: X forward, Y outboard (positive, left-side data), Z up.
//   Mapped:   Y negated to match RHS convention. X and Z unchanged.
//
// FROM BENCHMARK (published values):
//   All 8 front hardpoints (CHAS_*, UPRI_*) and 8 rear hardpoints
//   Wheelbase:            1550 mm
//   Track width:          1050 mm (F & R)  →  half-track = 525 mm
//   Sprung mass:          212 kg
//   Front mass dist:      48.4%  →  CG-to-front ≈ 750 mm
//   CG position:          (−796, 0, 173.6) mm in original coords
//   Front spring rate:    26 N/mm (from published wheel rate / MR²)
//
// DERIVED (not in benchmark — reverse-engineered to place wheel centre):
//   Front upright:
//     stubAxleRatio 0.453  — from (WC_z − LBJ_z)/(UBJ_z − LBJ_z) = 77/170
//     stubAxleLength 70 mm — chosen so stub − offset = 54.4 (WC_y = −525)
//     wheelOffset 15.6 mm
//   Rear upright:
//     stubAxleRatio 0.453  — same derivation as front
//     stubAxleLength 75 mm — chosen so stub − offset = 61 (WC_y = −525)
//     wheelOffset 14 mm
//   Tyre loaded radius 230 mm — typical 10″ FSAE wheel, not published.
//
// ESTIMATED (not in benchmark):
//   SU, SL, DU, DL — OptimumG car uses pullrod + rocker actuation.
//   This tool only models direct-acting springs, so the spring/damper
//   attachment points are approximate. The kinematic outputs (camber,
//   KPI, caster, scrub, RC height) are unaffected; wheel rate will differ.
//   Damper F-V curves — generic placeholder.
//   ARB rates — not published.
//
// Published front KPIs:
//   Camber −2.0°, KPI 4.0°, Caster 6.0°, Scrub 38.2 mm,
//   RC height 28.3 mm, FVSA 921.3 mm, Mech trail 24.7 mm.
// Published rear KPIs:
//   Camber −1.0°, KPI 0°, Caster 11.6°, Scrub 61.0 mm,
//   RC height 37.2 mm, FVSA 972.5 mm, Mech trail 63.0 mm.

function createOptimumGFSAEModel(): SuspensionModel {
  const frontHP: Record<string, Vec3> = {
    UBIF: [119.5, -245, 255],   // CHAS_UppFor  [119.5, 245, 255]
    UBIR: [-130.5, -245, 250],  // CHAS_UppAft  [−130.5, 245, 250]
    UBJ:  [-9.5, -464, 323],    // UPRI_UppPnt  [−9.5, 464, 323]
    LBIF: [114.5, -210, 120],   // CHAS_LowFor  [114.5, 210, 120]
    LBIR: [-125.5, -210, 125],  // CHAS_LowAft  [−125.5, 210, 125]
    LBJ:  [8.5, -476, 153],     // UPRI_LowPnt  [8.5, 476, 153]
    TRI:  [65, -131, 150],      // CHAS_TiePnt  [65, 131, 150]
    TRO:  [72.5, -476.6, 200.8],// UPRI_TiePnt  [72.5, 476.6, 200.8]
    SU:   [0, -250, 400],       // ESTIMATED — pullrod not modelled
    SL:   [0, -450, 160],       // ESTIMATED
    DU:   [0, -260, 410],       // ESTIMATED
    DL:   [0, -440, 155],       // ESTIMATED
  };

  const rearHP: Record<string, Vec3> = {
    UBIF: [176.5, -215, 250],   // CHAS_UppFor  [176.5, 215, 250]
    UBIR: [-93.5, -215, 255],   // CHAS_UppAft  [−93.5, 215, 255]
    UBJ:  [-3.5, -464, 323],    // UPRI_UppPnt  [−3.5, 464, 323]
    LBIF: [156.5, -185, 130],   // CHAS_LowFor  [156.5, 185, 130]
    LBIR: [-103.5, -185, 125],  // CHAS_LowAft  [−103.5, 185, 125]
    LBJ:  [31.5, -464, 153],    // UPRI_LowPnt  [31.5, 464, 153]
    TRI:  [-128.5, -185, 125],  // CHAS_TiePnt  [−128.5, 185, 125]
    TRO:  [-68.5, -464, 153],   // UPRI_TiePnt  [−68.5, 464, 153]
    SU:   [0, -220, 400],       // ESTIMATED — pullrod not modelled
    SL:   [0, -430, 150],       // ESTIMATED
    DU:   [0, -230, 410],       // ESTIMATED
    DL:   [0, -420, 145],       // ESTIMATED
  };

  // DERIVED — see header comment for derivation from half-track 525 mm
  const frontUpright = { stubAxleRatio: 0.453, stubAxleLength: 70, wheelOffset: 15.6, stubAxleCamber: 0, stubAxleCaster: 0 };
  const rearUpright = { stubAxleRatio: 0.453, stubAxleLength: 75, wheelOffset: 14, stubAxleCamber: 0, stubAxleCaster: 0 };
  
  return {
    front: makeCorner(frontHP, frontUpright,
      { rate: 26, freeLength: 200, preload: 100 }),   // rate from benchmark
    rear: makeCorner(rearHP, rearUpright,
      { rate: 30, freeLength: 200, preload: 100 }),    // ESTIMATED
    vehicle: {
      mass: 212,             // from benchmark (sprung mass)
      cgHeight: 174,         // from benchmark (CG Z = 173.6 mm)
      wheelbase: 1550,       // from benchmark
      cgToFrontAxle: 750,    // from benchmark (48.4% front)
      trackFront: 1050,      // from benchmark
      trackRear: 1050,       // from benchmark
      tyreRadius: 230,       // ESTIMATED — typical FSAE 10″ wheel
    },
    arbFront: { rate: 8 },   // ESTIMATED
    arbRear: { rate: 5 },    // ESTIMATED
  };
}

export const PRESETS: Preset[] = [
  {
    id: 'race-software',
    label: 'RACE Software Demo',
    description: 'Road car double-wishbone. Hardpoints, tyre radius, spring rate from benchmark. Upright spec and spring upper point derived/estimated.',
    factory: createRaceSoftwareModel,
  },
  {
    id: 'optimumg-fsae',
    label: 'OptimumG FSAE',
    description: 'Formula Student car (front + rear). Hardpoints and vehicle params from benchmark. Upright spec derived; spring/damper points estimated (pullrod not modelled).',
    factory: createOptimumGFSAEModel,
  },
];
