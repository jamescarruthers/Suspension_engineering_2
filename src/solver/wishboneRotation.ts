import type { Vec3 } from '../math/Vec3';
import { sub, add, scale, dot, cross, normalize, norm } from '../math/Vec3';

/**
 * Compute where a point attached to the lower wishbone moves to when
 * LBJ moves from its static position to a new solved position.
 *
 * The lower wishbone rotates about the axis LBIF→LBIR. Given the static
 * and solved positions of LBJ, we find the rotation that maps the old
 * wishbone orientation to the new one, then apply it to any point on
 * the wishbone (SL, DL, etc.).
 */
export function rotatePointWithWishbone(
  point0: Vec3,     // static position of the point (e.g. SL)
  lbj0: Vec3,       // static LBJ
  lbjNew: Vec3,     // solved LBJ
  lbif: Vec3,       // inner front pivot (fixed)
  lbir: Vec3,       // inner rear pivot (fixed)
): Vec3 {
  // Rotation axis: the inner pivot axis LBIF→LBIR
  const axis = normalize(sub(lbir, lbif));

  // Project LBJ onto the rotation axis to find the centre of rotation
  const lbj0_rel = sub(lbj0, lbif);
  const lbjNew_rel = sub(lbjNew, lbif);

  // Vectors from axis to LBJ, perpendicular to axis
  const lbj0_proj = scale(axis, dot(lbj0_rel, axis));
  const lbj0_perp = sub(lbj0_rel, lbj0_proj);
  const lbjNew_proj = scale(axis, dot(lbjNew_rel, axis));
  const lbjNew_perp = sub(lbjNew_rel, lbjNew_proj);

  const r0 = norm(lbj0_perp);
  const r1 = norm(lbjNew_perp);

  if (r0 < 1e-6 || r1 < 1e-6) {
    // LBJ is on the axis — no rotation, just return static position
    return point0;
  }

  // Build orthonormal basis in the plane perpendicular to the axis
  const e1 = normalize(lbj0_perp);
  const e2 = cross(axis, e1);

  // Find the rotation angle: decompose lbjNew_perp in the e1/e2 basis
  const cosA = dot(lbjNew_perp, e1) / r1;
  const sinA = dot(lbjNew_perp, e2) / r1;

  // Apply the same rotation to the point
  const pt_rel = sub(point0, lbif);
  const pt_axial = scale(axis, dot(pt_rel, axis));
  const pt_perp = sub(pt_rel, pt_axial);

  // Decompose pt_perp in the e1/e2 basis
  const pt_e1 = dot(pt_perp, e1);
  const pt_e2 = dot(pt_perp, e2);

  // Rotate
  const new_e1 = pt_e1 * cosA - pt_e2 * sinA;
  const new_e2 = pt_e1 * sinA + pt_e2 * cosA;

  // Reconstruct
  const rotated_perp = add(scale(e1, new_e1), scale(e2, new_e2));
  return add(lbif, add(pt_axial, rotated_perp));
}
