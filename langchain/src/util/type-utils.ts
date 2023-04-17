// Utility for marking only some keys of an interface as optional
// Compare to Partial<T> which marks all keys as optional
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
