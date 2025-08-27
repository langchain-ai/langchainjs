/**
 * TypeScript currently doesn't support types for `AbortSignal.any`
 * @see https://github.com/microsoft/TypeScript/issues/60695
 */
declare const AbortSignal: {
  any(signals: AbortSignal[]): AbortSignal;
};

/**
 * `config` always contains a signal from LangGraphs Pregel class.
 * To ensure we acknowledge the abort signal from the user, we merge it
 * with the signal from the ToolNode.
 *
 * @param signals - The signals to merge.
 * @returns The merged signal.
 */
export function mergeAbortSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal {
  return AbortSignal.any(
    signals.filter(
      (maybeSignal): maybeSignal is AbortSignal =>
        maybeSignal !== null &&
        maybeSignal !== undefined &&
        typeof maybeSignal === "object" &&
        "aborted" in maybeSignal &&
        typeof maybeSignal.aborted === "boolean"
    )
  );
}
