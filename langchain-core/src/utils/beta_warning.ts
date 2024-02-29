/**
 * Decorator for logging a warning when a method is called.
 */
export function betaWarning(reason: string) {
  console.warn(`The function '${reason}' is in beta. It is actively being worked on, so the API may change.`);
}

