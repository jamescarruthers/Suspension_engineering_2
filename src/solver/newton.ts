import { solveLinearSystem } from '../math/LinAlg';
import { evaluateConstraints, evaluateJacobian, type ConstraintContext } from './constraints';

export function solve(
  q0: number[],
  travel: number,
  rackTravel: number,
  ctx: ConstraintContext,
  tol = 1e-8,
  maxIter = 50,
): number[] {
  let q = [...q0];

  for (let iter = 0; iter < maxIter; iter++) {
    const C = evaluateConstraints(q, travel, rackTravel, ctx);
    const residual = Math.max(...C.map(Math.abs));

    if (residual < tol) return q;

    const J = evaluateJacobian(q, travel, rackTravel, ctx);
    const dq = solveLinearSystem(J, C);
    q = q.map((qi, i) => qi - dq[i]);
  }

  const C = evaluateConstraints(q, travel, rackTravel, ctx);
  const residual = Math.max(...C.map(Math.abs));
  if (residual < tol * 100) return q; // close enough

  throw new Error(
    `Newton-Raphson did not converge at travel=${travel.toFixed(1)}mm. Residual: ${residual.toExponential(3)}`
  );
}
