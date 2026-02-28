import type {
  UsageMetadata,
  InputTokenDetails,
  OutputTokenDetails,
} from "@langchain/core/messages";

/**
 * Computes the delta between two token detail objects by subtracting
 * each field in `previous` from the corresponding field in `current`.
 *
 * This is used to convert cumulative token detail counts (as reported
 * by the Gemini streaming API) into per-chunk deltas that can be
 * correctly summed by {@link mergeUsageMetadata} during chunk
 * concatenation.
 *
 * @param current - The cumulative token details from the current chunk.
 * @param previous - The cumulative token details from the previous chunk.
 * @returns The per-chunk delta, or `undefined` if `current` is undefined.
 */
function subtractTokenDetails<T extends InputTokenDetails | OutputTokenDetails>(
  current?: T,
  previous?: T
): T | undefined {
  if (!current) return undefined;
  if (!previous) return current;
  const result = {} as Record<string, number>;
  for (const key of Object.keys(current) as (keyof T)[]) {
    const cur = current[key] as number | undefined;
    const prev = previous[key] as number | undefined;
    if (cur !== undefined) {
      result[key as string] = cur - (prev ?? 0);
    }
  }
  return result as T;
}

/**
 * Computes the delta between two {@link UsageMetadata} objects by
 * subtracting each field in `previous` from the corresponding field in
 * `current`.
 *
 * The Gemini streaming API reports **cumulative** token counts on every
 * SSE chunk, but `@langchain/core`'s `mergeUsageMetadata` combines
 * values via addition. Emitting raw cumulative values on each
 * `AIMessageChunk` would therefore inflate the totals when chunks are
 * concatenated. This function converts cumulative values into per-chunk
 * deltas so that additive merging produces the correct final totals.
 *
 * @param current - The cumulative usage metadata from the current chunk.
 * @param previous - The cumulative usage metadata from the previous
 *   chunk, or `undefined` for the first chunk in the stream.
 * @returns The per-chunk delta usage metadata.
 */
export function subtractUsageMetadata(
  current: UsageMetadata,
  previous?: UsageMetadata
): UsageMetadata {
  if (!previous) return current;
  return {
    input_tokens: current.input_tokens - previous.input_tokens,
    output_tokens: current.output_tokens - previous.output_tokens,
    total_tokens: current.total_tokens - previous.total_tokens,
    input_token_details: subtractTokenDetails(
      current.input_token_details,
      previous.input_token_details
    ),
    output_token_details: subtractTokenDetails(
      current.output_token_details,
      previous.output_token_details
    ),
  };
}
