// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zipEntries<T extends any[]>(
  ...arrays: {
    [P in keyof T]: T[P][];
  }
): T[] {
  // Check for empty input
  if (arrays.length === 0) {
    return [];
  }

  // Find the length of the first input array
  const firstArrayLength = arrays[0].length;

  // Ensure all input arrays have the same length
  for (const array of arrays) {
    if (array.length !== firstArrayLength) {
      throw new Error("All input arrays must have the same length.");
    }
  }

  // Create an empty array to store the zipped arrays
  const zipped: T[] = [];

  // Iterate through each element of the first input array
  for (let i = 0; i < firstArrayLength; i += 1) {
    // Create an array to store the zipped elements at the current index
    const zippedElement: T[keyof T][] = [];

    // Iterate through each input array
    for (const array of arrays) {
      // Add the element at the current index to the zipped element array
      zippedElement.push(array[i]);
    }

    // Add the zipped element array to the zipped array
    zipped.push(zippedElement as T);
  }

  return zipped;
}
