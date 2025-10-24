/**
 *Returns the Inner Product similarity between vectors a and b
 * @link [Inner Product Similarity algorithm](https://www.naun.org/main/NAUN/ijmmas/mmmas-49.pdf)
 * @param a - first vector
 * @param b - second vector
 *
 */
export function innerProduct(a: number[], b: number[]): number {
  let ans = 0;
  for (let i = 0; i < a.length; i++) {
    ans += a[i] * b[i];
  }
  return ans;
}

/**
 *Returns the Chebyshev distance between vectors a and b
 * @link [Chebyshev algorithm](https://en.wikipedia.org/wiki/Chebyshev_distance)
 * @param a - first vector
 * @param b - second vector
 *
 */
export function chebyshev(a: number[], b: number[]): number {
  let max = 0;
  let aux = 0;
  for (let i = 0; i < a.length; i++) {
    aux = Math.abs(a[i] - b[i]);
    if (max < aux) {
      max = aux;
    }
  }
  return max;
}

/**
 *Returns the Manhattan distance between vectors a and b
 * @link [Manhattan algorithm](https://www.naun.org/main/NAUN/ijmmas/mmmas-49.pdf)
 * @param a - first vector
 * @param b - second vector
 *
 */

export function manhattan(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d += Math.abs(a[i] - b[i]);
  }
  return d;
}
