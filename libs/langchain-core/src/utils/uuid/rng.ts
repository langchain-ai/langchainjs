// RNG values for use in UUID generation. This *must* use a high-quality source
// of entropy, such as `crypto.getRandomValues()`.  And we reuse an array for
// performance.
const rnds8 = new Uint8Array(16);
export default function rng() {
  return crypto.getRandomValues(rnds8);
}
