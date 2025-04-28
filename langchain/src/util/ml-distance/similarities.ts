/**
 * Returns the average of cosine distances between vectors a and b
 * @param a - first vector
 * @param b - second vector
 *
 */
export function cosine(a: number[], b: number[]): number {
  let p = 0;
  let p2 = 0;
  let q2 = 0;
  for (let i = 0; i < a.length; i++) {
    p += a[i] * b[i];
    p2 += a[i] * a[i];
    q2 += b[i] * b[i];
  }
  return p / (Math.sqrt(p2) * Math.sqrt(q2));
}
