/**
 * Decorator for logging a warning when a method is called.
 */
export function betaWarning(func: string) {
  console.warn(
    `The function '${func}' is in beta. It is actively being worked on, so the API may change.`
  );
}
