// Utility for marking only some keys of an interface as optional
// Compare to Partial<T> which marks all keys as optional
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Utility type for extracting the constructor type of a class
// Returns a constructor function type that can create instances of T
export type Constructor<T> = new (...args: unknown[]) => T;
