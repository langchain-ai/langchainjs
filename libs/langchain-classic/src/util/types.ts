/**
 * Represents a string value with autocompleted, but not required, suggestions.
 */

export type StringWithAutocomplete<T> = T | (string & Record<never, never>);
