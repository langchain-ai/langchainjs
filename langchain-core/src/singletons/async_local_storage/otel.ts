import { getEnvironmentVariable } from "../../utils/env";
import { OTEL_CONTEXT_KEY, OTEL_TRACE_KEY } from "./globals";

/**
 * Get OpenTelemetry trace ID as hex string from UUID.
 * @param uuidStr - The UUID string to convert
 * @returns Hex string representation of the trace ID
 */
function getOtelTraceIdFromUuid(uuidStr: string): string {
  // Use full UUID hex (like Python's uuid_val.hex)
  return uuidStr.replace(/-/g, "");
}

/**
 * Get OpenTelemetry span ID as hex string from UUID.
 * @param uuidStr - The UUID string to convert
 * @returns Hex string representation of the span ID
 */
function getOtelSpanIdFromUuid(uuidStr: string): string {
  // Convert UUID string to bytes equivalent (first 8 bytes for span ID)
  // Like Python's uuid_val.bytes[:8].hex()
  const cleanUuid = uuidStr.replace(/-/g, "");
  return cleanUuid.substring(0, 16); // First 8 bytes (16 hex chars)
}

export function createOtelSpanContextFromRun(run: {
  trace_id?: string;
  id: string;
}) {
  const traceId = getOtelTraceIdFromUuid(run.trace_id ?? run.id);
  const spanId = getOtelSpanIdFromUuid(run.id);
  return {
    traceId,
    spanId,
    isRemote: false,
    traceFlags: 1, // SAMPLED
  };
}

export function getOtelGlobalsIfInitializedInLangSmith(): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  otel_trace?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  otel_context?: Record<string, any>;
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const otel_trace = (globalThis as any)?.[OTEL_TRACE_KEY];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const otel_context = (globalThis as any)?.[OTEL_CONTEXT_KEY];
  return { otel_trace, otel_context };
}

/**
 * Create OpenTelemetry context manager from RunTree if OTEL is enabled.
 */
export function maybeCreateOtelContext<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partialRunTree?: {
    name?: string;
    trace_id?: string;
    id: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tracer?: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (fn: (...args: any[]) => T) => T {
  if (!partialRunTree || getEnvironmentVariable("OTEL_ENABLED") !== "true") {
    return (fn: (...args: any[]) => T) => fn();
  }

  const { otel_trace, otel_context } = getOtelGlobalsIfInitializedInLangSmith();
  if (!otel_trace || !otel_context) {
    return (fn: (...args: any[]) => T) => fn();
  }

  try {
    const spanContext = createOtelSpanContextFromRun(partialRunTree);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (fn: (...args: any[]) => T) => {
      const resolvedTracer = tracer ?? otel_trace?.getTracer("langchain");
      return resolvedTracer.startActiveSpan(
        partialRunTree.name,
        {
          attributes: {
            "langsmith.traceable": "true",
          },
        },
        async () => {
          otel_trace?.setSpanContext(otel_context?.active(), spanContext);
          const res = await fn();
          return res;
        }
      );
    };
  } catch {
    // Silent failure if OTEL setup is incomplete
    return (fn: (...args: any[]) => T) => fn();
  }
}
