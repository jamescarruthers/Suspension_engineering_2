import { type Vec3, distSq } from '../math/Vec3';
import type { Hardpoints, UprightSpec } from '../model/types';
import { computeStubAxleLocalDir, deriveWheelCentre } from './upright';

export interface ConstraintContext {
  // Fixed chassis-side points
  UBIF: Vec3;
  UBIR: Vec3;
  LBIF: Vec3;
  LBIR: Vec3;
  TRI: Vec3; // may shift with rack travel

  // Constant link lengths squared (computed from static geometry)
  L2_ubif: number;
  L2_ubir: number;
  L2_lbif: number;
  L2_lbir: number;
  L2_tie: number;
  L2_ul: number;  // UBJ-LBJ
  L2_ut: number;  // UBJ-TRO
  L2_lt: number;  // LBJ-TRO

  // Upright / wheel centre
  uprightSpec: UprightSpec;
  stubAxleDir0_local: Vec3;
  wcZ0: number; // static wheel centre Z
}

export function createConstraintContext(
  hp: Hardpoints,
  uprightSpec: UprightSpec,
  tyreRadius: number,
): ConstraintContext {
  const stubAxleDir0_local = computeStubAxleLocalDir(hp.UBJ, hp.LBJ, hp.TRO);
  const wc0 = deriveWheelCentre(hp.UBJ, hp.LBJ, hp.TRO, uprightSpec, stubAxleDir0_local);

  return {
    UBIF: hp.UBIF,
    UBIR: hp.UBIR,
    LBIF: hp.LBIF,
    LBIR: hp.LBIR,
    TRI: hp.TRI,

    L2_ubif: distSq(hp.UBJ, hp.UBIF),
    L2_ubir: distSq(hp.UBJ, hp.UBIR),
    L2_lbif: distSq(hp.LBJ, hp.LBIF),
    L2_lbir: distSq(hp.LBJ, hp.LBIR),
    L2_tie: distSq(hp.TRO, hp.TRI),
    L2_ul: distSq(hp.UBJ, hp.LBJ),
    L2_ut: distSq(hp.UBJ, hp.TRO),
    L2_lt: distSq(hp.LBJ, hp.TRO),

    uprightSpec,
    stubAxleDir0_local,
    wcZ0: wc0[2],
  };
}

function qToVecs(q: number[]): { UBJ: Vec3; LBJ: Vec3; TRO: Vec3 } {
  return {
    UBJ: [q[0], q[1], q[2]],
    LBJ: [q[3], q[4], q[5]],
    TRO: [q[6], q[7], q[8]],
  };
}

export function evaluateConstraints(
  q: number[],
  travel: number,
  rackTravel: number,
  ctx: ConstraintContext,
): number[] {
  const { UBJ, LBJ, TRO } = qToVecs(q);

  // Effective TRI position (rack shifts laterally, in Y)
  const TRI: Vec3 = [ctx.TRI[0], ctx.TRI[1] + rackTravel, ctx.TRI[2]];

  const C = new Array(9);

  // Link-length constraints (squared distance form)
  C[0] = distSq(UBJ, ctx.UBIF) - ctx.L2_ubif;
  C[1] = distSq(UBJ, ctx.UBIR) - ctx.L2_ubir;
  C[2] = distSq(LBJ, ctx.LBIF) - ctx.L2_lbif;
  C[3] = distSq(LBJ, ctx.LBIR) - ctx.L2_lbir;
  C[4] = distSq(TRO, TRI) - ctx.L2_tie;

  // Upright rigidity constraints
  C[5] = distSq(UBJ, LBJ) - ctx.L2_ul;
  C[6] = distSq(UBJ, TRO) - ctx.L2_ut;
  C[7] = distSq(LBJ, TRO) - ctx.L2_lt;

  // Driving constraint: wheel centre Z = static + travel
  const WC = deriveWheelCentre(UBJ, LBJ, TRO, ctx.uprightSpec, ctx.stubAxleDir0_local);
  C[8] = WC[2] - (ctx.wcZ0 + travel);

  return C;
}

export function evaluateJacobian(
  q: number[],
  travel: number,
  rackTravel: number,
  ctx: ConstraintContext,
): number[][] {
  const { UBJ, LBJ, TRO } = qToVecs(q);
  const TRI: Vec3 = [ctx.TRI[0], ctx.TRI[1] + rackTravel, ctx.TRI[2]];

  // Initialize 9x9 Jacobian to zeros
  const J: number[][] = Array.from({ length: 9 }, () => new Array(9).fill(0));

  // Helper: dC/dP for |P - Q|^2 = 2*(P - Q)
  // Columns: [UBJ_x(0), UBJ_y(1), UBJ_z(2), LBJ_x(3), LBJ_y(4), LBJ_z(5), TRO_x(6), TRO_y(7), TRO_z(8)]

  // C0: |UBJ - UBIF|^2 - L^2  → dC/dUBJ = 2*(UBJ - UBIF)
  for (let k = 0; k < 3; k++) J[0][k] = 2 * (UBJ[k] - ctx.UBIF[k]);

  // C1: |UBJ - UBIR|^2 - L^2
  for (let k = 0; k < 3; k++) J[1][k] = 2 * (UBJ[k] - ctx.UBIR[k]);

  // C2: |LBJ - LBIF|^2 - L^2
  for (let k = 0; k < 3; k++) J[2][3 + k] = 2 * (LBJ[k] - ctx.LBIF[k]);

  // C3: |LBJ - LBIR|^2 - L^2
  for (let k = 0; k < 3; k++) J[3][3 + k] = 2 * (LBJ[k] - ctx.LBIR[k]);

  // C4: |TRO - TRI|^2 - L^2
  for (let k = 0; k < 3; k++) J[4][6 + k] = 2 * (TRO[k] - TRI[k]);

  // C5: |UBJ - LBJ|^2 - L^2
  for (let k = 0; k < 3; k++) {
    J[5][k] = 2 * (UBJ[k] - LBJ[k]);
    J[5][3 + k] = -2 * (UBJ[k] - LBJ[k]);
  }

  // C6: |UBJ - TRO|^2 - L^2
  for (let k = 0; k < 3; k++) {
    J[6][k] = 2 * (UBJ[k] - TRO[k]);
    J[6][6 + k] = -2 * (UBJ[k] - TRO[k]);
  }

  // C7: |LBJ - TRO|^2 - L^2
  for (let k = 0; k < 3; k++) {
    J[7][3 + k] = 2 * (LBJ[k] - TRO[k]);
    J[7][6 + k] = -2 * (LBJ[k] - TRO[k]);
  }

  // C8: WC_z(q) - target  → finite difference for row 8
  const eps = 1e-6;
  for (let j = 0; j < 9; j++) {
    const qp = [...q];
    const qm = [...q];
    qp[j] += eps;
    qm[j] -= eps;

    const { UBJ: UBJp, LBJ: LBJp, TRO: TROp } = qToVecs(qp);
    const { UBJ: UBJm, LBJ: LBJm, TRO: TROm } = qToVecs(qm);

    const wcZp = deriveWheelCentre(UBJp, LBJp, TROp, ctx.uprightSpec, ctx.stubAxleDir0_local)[2];
    const wcZm = deriveWheelCentre(UBJm, LBJm, TROm, ctx.uprightSpec, ctx.stubAxleDir0_local)[2];

    J[8][j] = (wcZp - wcZm) / (2 * eps);
  }

  return J;
}
