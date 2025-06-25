import {
  EncodedEventStream,
  HARCookie,
  HAREntry,
  HARHeader,
  HARPostData,
  HARQueryString,
  HARRequest,
  HARResponse,
} from "./spec";
import { parse as parseCookie } from "cookie";
import { deepEqual, delay, iife } from "./utils";

export type MatchRequestEntryOptions = {
  request: Request;
  requestBody: Uint8Array | null;
  entry: HAREntry;
  redactedKeys?: string[];
};

/**
 * Determines whether a given HTTP request matches a stored HAR entry.
 *
 * This function compares the method, URL (origin and pathname), content-type header,
 * selected headers (excluding content-type and any redacted keys), query parameters
 * (excluding any redacted keys), and optionally the request body (if provided).
 *
 * The request body is provided separately instead of being consumed directly in
 * this predicate because it's assumed that this function is used where the request
 * body is re-used multiple times, and we don't need to repeat the work of consuming
 * the body.
 *
 * @param {Object} params - The parameters for matching.
 * @param {Request} params.request - The incoming Request object to match against the HAR entry.
 * @param {Uint8Array | null} params.requestBody - The body of the incoming request as a Uint8Array, or null if not present.
 * @param {HAREntry} params.entry - The HAR entry to match against.
 * @param {string[]} [params.redactedKeys=[]] - An array of header or query parameter names to ignore during matching.
 * @returns {boolean} True if the request matches the HAR entry, false otherwise.
 */
export function matchRequestEntryPredicate({
  request,
  requestBody,
  entry,
  redactedKeys = [],
}: MatchRequestEntryOptions): boolean {
  const { request: storedRequest } = entry;
  if (storedRequest.method !== request.method) return false;

  // Compare request URL
  const storedRequestUrl = new URL(storedRequest.url);
  const requestUrl = new URL(request.url);
  if (storedRequestUrl.origin !== requestUrl.origin) return false;
  if (storedRequestUrl.pathname !== requestUrl.pathname) return false;

  // Compare content-type header and mime type
  const contentTypeHeader = storedRequest.headers.find(
    (header) => header.name.toLowerCase() === "content-type"
  );
  if (contentTypeHeader) {
    const contentType = contentTypeHeader.value;
    if (contentType !== request.headers.get("content-type")) {
      return false;
    }
  }

  // Compare request headers with (excluding content-type and redacted keys)
  const redactedRequestHeaders = storedRequest.headers.filter((header) =>
    redactedKeys.includes(header.name)
  );
  for (const header of redactedRequestHeaders) {
    if (header.name.toLowerCase() === "content-type") continue;
    if (header.value !== request.headers.get(header.name)) return false;
  }

  // Compare query params
  const storedRequestQueryParams = new URLSearchParams(storedRequestUrl.search);
  const requestQueryParams = new URLSearchParams(requestUrl.search);
  for (const key of redactedKeys) {
    storedRequestQueryParams.delete(key);
    requestQueryParams.delete(key);
  }
  if (storedRequestQueryParams.toString() !== requestQueryParams.toString()) {
    return false;
  }

  // Compare request body if it's provided
  if (requestBody) {
    const requestBodyText = new TextDecoder().decode(requestBody);
    return deepEqual(entry.request.postData?.text, requestBodyText);
  }

  return true;
}

/**
 * Reads and returns the full body from a ReadableStream as a Uint8Array.
 * @param {ReadableStream<Uint8Array>} bodyStream
 * @returns {Promise<Uint8Array | null>}
 */
export async function consumeBodyStream(
  bodyStream: ReadableStream<Uint8Array>
): Promise<Uint8Array | null> {
  const reader = bodyStream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (value) chunks.push(value);
    done = streamDone;
  }
  // Concatenate all chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Creates a ReadableStream that emits the provided string content after an optional delay.
 *
 * This function is useful for simulating network latency or delayed responses in tests.
 *
 * @param {string | undefined} content - The string content to emit in the stream. If undefined or empty, nothing is emitted.
 * @param {number} delayMs - The delay in milliseconds before emitting the content.
 * @returns {ReadableStream<Uint8Array>} A ReadableStream that emits the encoded content after the specified delay.
 */
function delayedReadableStream(content: string | undefined, delayMs: number) {
  return new ReadableStream({
    async start(controller) {
      if (delayMs > 0) await delay(delayMs);
      if (typeof content === "string" && content.length > 0) {
        controller.enqueue(new TextEncoder().encode(content));
      }
      controller.close();
    },
  });
}

/**
 * Type guard to check if a value is an EncodedEventStream.
 *
 * @param {unknown} value - The value to check.
 * @returns {value is EncodedEventStream} True if the value is an EncodedEventStream, false otherwise.
 */
function isEncodedEventStream(value: unknown): value is EncodedEventStream {
  return (
    typeof value === "object" &&
    value !== null &&
    "$type" in value &&
    value.$type === "event-stream"
  );
}

/**
 * Creates a ReadableStream that emits events from an encoded event stream,
 * optionally delaying each event according to its specified timing.
 *
 * This function is intended to simulate a server-sent events (SSE) stream
 * by emitting each event as a chunk, with optional delays between events
 * to mimic real-time streaming behavior.
 *
 * @param {EncodedEventStream} encodedEventStream - The encoded event stream object containing events and their timings.
 * @throws {Error} If the provided value is not a valid encoded event stream.
 * @returns {ReadableStream<Uint8Array>} A ReadableStream emitting the encoded event data as Uint8Array chunks.
 */
function readableEncodedEventStream(encodedEventStream: EncodedEventStream) {
  if (!isEncodedEventStream(encodedEventStream)) {
    throw new Error("Provided value is not an encoded event stream");
  }
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      // Emit each event in the stream with the associated delay
      await Promise.all(
        encodedEventStream.events.map(async (event) => {
          if (event.timing) await delay(event.timing);
          const content: string[] = [];
          if (event.data) content.push(event.data);
          if (event.event) content.push(event.event);
          if (event.id) content.push(event.id);
          if (content.length > 0) {
            controller.enqueue(encoder.encode(content.join("\n")));
            controller.enqueue(encoder.encode("\n"));
          }
        })
      );
      controller.close();
    },
  });
}

/**
 * Encodes a ReadableStream of Uint8Array chunks representing an event stream
 * into an EncodedEventStream object, capturing the timing and content of each event.
 *
 * This function reads from the provided ReadableStream, decodes each chunk,
 * and attempts to parse it as JSON to extract event, id, and data fields.
 * If parsing fails, the raw decoded string is used as the data.
 * The timing for each event is measured relative to the start of the stream.
 *
 * @param {ReadableStream<Uint8Array>} readableStream - The stream of event data to encode.
 * @returns {Promise<EncodedEventStream>} A promise that resolves to the encoded event stream object,
 *   containing the type and an array of events with their timing and content.
 */
export async function encodeEventStream(
  readableStream: ReadableStream<Uint8Array>
): Promise<EncodedEventStream> {
  const events: EncodedEventStream["events"] = [];
  const decoder = new TextDecoder();
  const reader = readableStream.getReader();
  const startTime = performance.now();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const eventTime = performance.now();
    const timing = eventTime - startTime;

    const event = iife(() => {
      try {
        const output = JSON.parse(decoder.decode(value));
        return {
          event: output.event,
          id: output.id,
          data: output.data,
        };
      } catch (error) {
        return { data: decoder.decode(value) };
      }
    });

    events.push({
      timing: Math.round(timing), // Round to nearest millisecond
      ...event,
    });
  }
  return { $type: "event-stream", events };
}

/**
 * Creates a ReadableStream for the HAR entry's response body, optionally delaying
 * the emission of the body according to the HAR entry's `timings.receive` value. If the
 * response body is a text/event-stream, has the proper encoding, and `useTimings` is true,
 * the stream chunks will be delayed according to the timings provided in the response contents.
 *
 * This is useful for simulating network latency or response timing when replaying
 * HTTP interactions from a HAR archive.
 *
 * @param {HAREntry} entry - The HAR entry containing the response and timing information.
 * @returns {Promise<ReadableStream<Uint8Array>>} A promise that resolves to a ReadableStream
 *   emitting the response body as a Uint8Array, after an optional delay.
 */
export function readableHARResponseStream(
  entry: HAREntry,
  useTimings: boolean
) {
  const contentType = entry.response.headers.find(
    (header) => header.name.toLowerCase() === "content-type"
  );
  // If the response is a text/event-stream and has the proper encoding, we handle it differently
  // to more closely model streaming responses.
  if (contentType?.value.includes("text/event-stream") && useTimings) {
    // Safely parse the contained event stream to valid JSON
    const responseJson = iife<string | undefined>(() => {
      try {
        return JSON.parse(entry.response.content.text ?? "");
      } catch (error) {
        return undefined;
      }
    });
    if (isEncodedEventStream(responseJson)) {
      return readableEncodedEventStream(responseJson);
    }
  }
  // Otherwise, we default to using the timings contained within the HAR entry.
  return delayedReadableStream(
    entry.response.content.text,
    useTimings ? entry.timings.receive : 0
  );
}

function encodeHARHeaders(headers: Headers, redactedKeys: string[] = []) {
  const harHeaders: HARHeader[] = [];
  for (const [key, value] of headers.entries()) {
    // don't store the passthrough header in the archive
    if (key === "x-mock-passthrough") continue;
    if (redactedKeys.includes(key)) continue;
    harHeaders.push({ name: key, value });
  }
  return harHeaders;
}

function encodeHARCookies(headers: Headers, redactedKeys: string[] = []) {
  const cookies: HARCookie[] = [];
  const cookieMap = parseCookie(headers.get("cookie") ?? "");
  for (const [key, value] of Object.entries(cookieMap)) {
    if (!value) continue;
    if (redactedKeys.includes(key)) continue;
    cookies.push({ name: key, value });
  }
  return cookies;
}

export async function encodeHARRequest(
  request: Request,
  redactedKeys: string[] = []
): Promise<HARRequest> {
  const requestUrl = new URL(request.url);
  const queryParams = new URLSearchParams(requestUrl.search);
  const queryString: HARQueryString[] = [];
  for (const [key, value] of queryParams.entries()) {
    queryString.push({ name: key, value });
  }
  let postData: HARPostData | undefined;
  if (request.body && request.method !== "GET") {
    const buffer = await consumeBodyStream(request.body);
    const text = buffer ? new TextDecoder("utf-8").decode(buffer) : "";
    postData = {
      mimeType: request.headers.get("content-type") ?? "",
      text,
    };
  }
  return {
    method: request.method,
    url: request.url,
    httpVersion: request.headers.get("version") ?? "HTTP/1.1",
    cookies: encodeHARCookies(request.headers, redactedKeys),
    headers: encodeHARHeaders(request.headers, redactedKeys),
    queryString,
    postData,
    headersSize: JSON.stringify(request.headers.entries()).length,
    bodySize: postData?.text?.length ?? 0,
  };
}

export async function encodeHARResponse(
  response: Response,
  redactedKeys: string[] = []
): Promise<HARResponse> {
  const content = await iife(async () => {
    const contentType = response.headers.get("content-type");
    if (!response.body) {
      return {
        size: 0,
        mimeType: contentType ?? "",
        text: "",
      };
    }
    if (contentType?.includes("text/event-stream")) {
      const encodedEventStream = await encodeEventStream(response.body);
      const text = JSON.stringify(encodedEventStream);
      return {
        size: text.length,
        mimeType: contentType ?? "",
        text,
      };
    }
    const body = await consumeBodyStream(response.body);
    const text = body ? new TextDecoder("utf-8").decode(body) : "";
    return {
      size: text.length,
      mimeType: contentType ?? "",
      text,
    };
  });
  return {
    status: response.status,
    statusText: response.statusText,
    httpVersion: response.headers.get("version") ?? "HTTP/1.1",
    cookies: encodeHARCookies(response.headers, redactedKeys),
    headers: encodeHARHeaders(response.headers, redactedKeys),
    content,
    redirectURL: response.headers.get("location") ?? "",
    headersSize: JSON.stringify(response.headers.entries()).length,
    bodySize: content.size,
  };
}

export function entryIsStale(entry: HAREntry, maxAge: number) {
  return new Date(entry.startedDateTime).getTime() < Date.now() - maxAge;
}
