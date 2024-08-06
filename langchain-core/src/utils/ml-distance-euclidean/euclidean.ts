export function squaredEuclidean(p: number[], q: number[]) {
  let d = 0;
  for (let i = 0; i < p.length; i++) {
    d += (p[i] - q[i]) * (p[i] - q[i]);
  }
  return d;
}

export function euclidean(p: number[], q: number[]) {
  return Math.sqrt(squaredEuclidean(p, q));
}
