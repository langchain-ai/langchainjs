export function zipEntries(...arrays: unknown[][]): unknown[][] {
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
  const zipped: unknown[][] = [];

  // Iterate through each element of the first input array
  for (let i = 0; i < firstArrayLength; i++) {
    // Create an array to store the zipped elements at the current index
    const zippedElement: unknown[] = [];

    // Iterate through each input array
    for (const array of arrays) {
      // Add the element at the current index to the zipped element array
      zippedElement.push(array[i]);
    }

    // Add the zipped element array to the zipped array
    zipped.push(zippedElement);
  }

  return zipped;
}
