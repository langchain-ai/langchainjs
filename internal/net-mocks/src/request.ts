import { parse as parseCookie } from "cookie";
import {
  EncodedEventStream,
  HARContent,
  HARCookie,
  HAREntry,
  HARHeader,
  HARPostData,
  HARQueryString,
  HARRequest,
  HARResponse,
} from "./spec";
import { deepEqual, delay, iife } from "./utils";

const WELL_KNOWN_HEADERS = ["accept", "accept-encoding", "content-type"];

/**
 * Options for matching an incoming HTTP request against a HAR entry.
 */
export type MatchRequestEntryOptions = {
  /** The incoming Request object to be matched. */
  request: Request;
  /** The body of the incoming request as a Uint8Array, or null if not present. */
  requestBody: Uint8Array | null;
  /** The HAR entry to match against. */
  entry: HAREntry;
  /** Optional array of header or query parameter names to include during matching. */
  includeKeys?: string[];
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
 * @param {string[]} [params.includeKeys=[]] - An array of header or query parameter names to include during matching.
 * @returns {boolean} True if the request matches the HAR entry, false otherwise.
 */
export function matchRequestEntryPredicate({
  request,
  requestBody,
  entry,
  includeKeys = [],
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
  const includedRequestHeaders = storedRequest.headers.filter((header) =>
    includeKeys.includes(header.name)
  );
  for (const header of includedRequestHeaders) {
    if (header.name.toLowerCase() === "content-type") continue;
    if (header.value === request.headers.get(header.name)) return false;
  }

  // Compare query params
  const storedRequestQueryParams = new URLSearchParams(storedRequestUrl.search);
  const requestQueryParams = new URLSearchParams(requestUrl.search);
  for (const key of includeKeys) {
    const storedValue = storedRequestQueryParams.get(key);
    const requestValue = requestQueryParams.get(key);
    if (storedValue !== requestValue) return false;
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
export function delayedReadableStream(
  content: string | undefined,
  delayMs: number
) {
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
export function isEncodedEventStream(
  value: unknown
): value is EncodedEventStream {
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
export function readableEncodedEventStream(
  encodedEventStream: EncodedEventStream,
  initialDelayMs: number = 0
) {
  if (!isEncodedEventStream(encodedEventStream)) {
    throw new Error("Provided value is not an encoded event stream");
  }
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      if (initialDelayMs > 0) await delay(initialDelayMs);
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

  let result: ReadableStreamReadResult<Uint8Array>;
  do {
    result = await reader.read();
    if (result.done) break;

    const eventTime = performance.now();
    const timing = eventTime - startTime;

    let event;
    try {
      const output = JSON.parse(decoder.decode(result.value));
      event = {
        event: output.event,
        id: output.id,
        data: output.data,
      };
    } catch (error) {
      event = { data: decoder.decode(result.value) };
    }

    events.push({
      timing: Math.round(timing), // Round to nearest millisecond
      ...event,
    });
  } while (!result.done);
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
      return readableEncodedEventStream(responseJson, entry.timings.wait);
    }
  }
  // Otherwise, we default to using the timings contained within the HAR entry.
  return delayedReadableStream(
    entry.response.content.text,
    useTimings ? entry.timings.receive : 0
  );
}

/**
 * Encodes HTTP headers into the HAR (HTTP Archive) header format.
 *
 * Filters out headers that are not in the `includeKeys` list or are
 * the special passthrough header ("x-mock-passthrough"), and returns
 * an array of HARHeader objects suitable for inclusion in a HAR entry.
 *
 * @param {Headers} headers - The HTTP headers to encode.
 * @param {string[]} [includeKeys=[]] - An array of header names to include in the output.
 * @returns {HARHeader[]} The encoded HAR header objects.
 */
function encodeHARHeaders(headers: Headers, includeKeys?: string[]) {
  const harHeaders: HARHeader[] = [];
  for (const [key, value] of headers.entries()) {
    // don't store the passthrough header in the archive
    if (key === "x-mock-passthrough") continue;
    else if (
      includeKeys &&
      !includeKeys.includes(key) &&
      !WELL_KNOWN_HEADERS.includes(key)
    ) {
      harHeaders.push({ name: key, value: "<redacted>" });
    } else {
      harHeaders.push({ name: key, value });
    }
  }
  return harHeaders;
}

/**
 * Encodes cookies from HTTP headers into the HAR (HTTP Archive) cookie format.
 *
 * Parses the "cookie" header, filters out cookies whose names are not in the
 * `includeKeys` list or have empty values, and returns an array of HARCookie objects.
 *
 * @param {Headers} headers - The HTTP headers containing the "cookie" header.
 * @param {string[]} [includeKeys=[]] - An array of cookie names to include in the output.
 * @returns {HARCookie[]} The encoded HAR cookie objects.
 */
function encodeHARCookies(headers: Headers, includeKeys: string[] = []) {
  const cookies: HARCookie[] = [];
  const cookieMap = parseCookie(headers.get("cookie") ?? "");
  for (const [key, value] of Object.entries(cookieMap)) {
    if (!value) continue;
    if (!includeKeys.includes(key)) continue;
    cookies.push({ name: key, value });
  }
  return cookies;
}

/**
 * Encodes a request or response body into a HAR-compatible format, handling
 * both text and binary content.
 * @param {ReadableStream<Uint8Array> | null} body The body stream to encode.
 * @param {string | null} mimeType The MIME type of the content.
 * @returns {Promise<HARContent>} An object with the encoded text and an optional encoding property.
 */
async function encodeHARContent(
  body: ReadableStream<Uint8Array> | null,
  mimeType: string | null
): Promise<HARContent> {
  const resolvedMimeType = mimeType ?? "";
  if (!body) {
    return { text: "", mimeType: resolvedMimeType, size: 0 };
  }
  const buffer = await consumeBodyStream(body);

  if (isTextMimeType(resolvedMimeType)) {
    const text = buffer ? new TextDecoder("utf-8").decode(buffer) : "";
    return { text, mimeType: resolvedMimeType, size: text.length };
  }
  let text = "";
  if (buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    text = btoa(binary);
  }
  return {
    text,
    encoding: "base64",
    mimeType: resolvedMimeType,
    size: text.length,
  };
}

/**
 * Encodes a Fetch API Request object into a HAR (HTTP Archive) request object.
 *
 * Extracts method, URL, HTTP version, headers, cookies, query parameters,
 * and (if present) the request body. Includes any headers or cookies whose
 * names are in the `includeKeys` list.
 *
 * @param {Request} request - The Fetch API Request to encode.
 * @param {string[]} [includeKeys=[]] - An array of header or cookie names to include in the output.
 * @returns {Promise<HARRequest>} A promise that resolves to the encoded HAR request object.
 */
export async function encodeHARRequest(
  request: Request,
  includeKeys: string[] = []
): Promise<HARRequest> {
  const requestUrl = new URL(request.url);
  const queryParams = new URLSearchParams(requestUrl.search);
  const queryString: HARQueryString[] = [];
  for (const [key, value] of queryParams.entries()) {
    queryString.push({ name: key, value });
  }
  let postData: HARPostData | undefined;
  if (request.body && request.method !== "GET") {
    const mimeType = request.headers.get("content-type");
    postData = await encodeHARContent(request.body, mimeType);
  }
  return {
    method: request.method,
    url: request.url,
    httpVersion: request.headers.get("version") ?? "HTTP/1.1",
    cookies: encodeHARCookies(request.headers, includeKeys),
    headers: encodeHARHeaders(request.headers, includeKeys),
    queryString,
    postData,
    headersSize: JSON.stringify(request.headers.entries()).length,
    bodySize: postData?.text?.length ?? 0,
  };
}

/**
 * Encodes a Fetch API Response object into a HAR (HTTP Archive) response object.
 *
 * Extracts status, status text, HTTP version, headers, cookies, and response body.
 * If the response is a text/event-stream, encodes the event stream as JSON.
 * Includes any headers or cookies whose names are in the `includeKeys` list.
 *
 * @param {Response} response - The Fetch API Response to encode.
 * @param {string[]} [includeKeys=[]] - An array of header or cookie names to include in the output.
 * @returns {Promise<HARResponse>} A promise that resolves to the encoded HAR response object.
 */
export async function encodeHARResponse(
  response: Response,
  includeKeys: string[] = []
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
    return encodeHARContent(response.body, contentType);
  });
  return {
    status: response.status,
    statusText: response.statusText,
    httpVersion: response.headers.get("version") ?? "HTTP/1.1",
    cookies: encodeHARCookies(response.headers, includeKeys),
    headers: encodeHARHeaders(response.headers),
    content,
    redirectURL: response.headers.get("location") ?? "",
    headersSize: JSON.stringify(response.headers.entries()).length,
    bodySize: content.size,
  };
}

/**
 * A helper function to determine if a mime type should be treated as text.
 * @param {string | null | undefined} mimeType The mime type to check.
 * @returns {boolean} True if the mime type is text-based, false otherwise.
 */
function isTextMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) {
    return true; // Default to text if mime type is not provided
  }
  const textMimeTypes = [
    "application/json",
    "application/xml",
    "application/x-www-form-urlencoded",
    "application/javascript",
    "text/",
  ];
  return textMimeTypes.some((textMimeType) =>
    mimeType.startsWith(textMimeType)
  );
}

/**
 * Determines whether a HAR entry is considered stale based on its start time and a maximum age.
 *
 * @param {HAREntry} entry - The HAR entry to check.
 * @param {number} maxAge - The maximum allowed age in milliseconds.
 * @returns {boolean} True if the entry is older than the allowed maxAge, false otherwise.
 */
export function entryIsStale(entry: HAREntry, maxAge: number) {
  return new Date(entry.startedDateTime).getTime() < Date.now() - maxAge;
}
