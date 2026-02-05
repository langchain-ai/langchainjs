export const iife = <T>(fn: () => T) => fn();

export const safeParseJson = <T>(json: string): T | object => {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
};
