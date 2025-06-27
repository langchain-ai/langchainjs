/**
 * HTTP Archive (HAR) v1.2 TypeScript Interfaces
 * Based on the HAR 1.2 specification derived from http://www.softwareishard.com/blog/har-12-spec/
 */

/**
 * Root HAR object containing the log data.
 */
export interface HARArchive {
  /**
   * The main log object containing all HAR data.
   */
  log: HARLog;
}

/**
 * Root object representing the exported data
 */
export interface HARLog {
  /** Version number of the format */
  version: "1.2";
  /** Name and version info of the log creator application */
  creator: HARCreator;
  /** Name and version info of used browser (optional) */
  browser?: HARBrowser;
  /** List of all exported (tracked) pages (optional) */
  pages: HARPage[];
  /** List of all exported (tracked) requests */
  entries: HAREntry[];
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Name and version info of the application used to export the log
 */
export interface HARCreator {
  /** Name of the application used to export the log */
  name: string;
  /** Version of the application used to export the log */
  version: string;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Name and version info of the browser used to export the log
 */
export interface HARBrowser {
  /** Name of the browser used to export the log */
  name: string;
  /** Version of the browser used to export the log */
  version: string;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Represents an exported page
 */
export interface HARPage {
  /** Date and time stamp for the beginning of the page load (ISO 8601) */
  startedDateTime: string;
  /** Unique identifier of a page within the log. Entries use it to refer the parent page */
  id: string;
  /** Page title */
  title: string;
  /** Detailed timing info about page load */
  pageTimings: HARPageTimings;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Describes timings for various events (states) fired during the page load
 * All times are specified in milliseconds. If a time info is not available appropriate field is set to -1
 */
export interface HARPageTimings {
  /** Content of the page loaded. Number of milliseconds since page load started (optional, default -1) */
  onContentLoad?: number;
  /** Page is loaded (onLoad event fired). Number of milliseconds since page load started (optional, default -1) */
  onLoad?: number;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Represents an HTTP request entry
 */
export interface HAREntry {
  /** Unique Reference to the parent page (optional) */
  pageref?: string;
  /** Date and time stamp of the request start (ISO 8601) */
  startedDateTime: string;
  /** Total elapsed time of the request in milliseconds. This is the sum of all timings available in the timings object (not including -1 values) */
  time: number;
  /** Detailed info about the request */
  request: HARRequest;
  /** Detailed info about the response */
  response: HARResponse;
  /** Info about cache usage */
  cache: HARCache;
  /** Detailed timing info about request/response round trip */
  timings: HARTimings;
  /** IP address of the server that was connected (result of DNS resolution) (optional) */
  serverIPAddress?: string;
  /** Unique ID of the parent TCP/IP connection, can be the client or server port number (optional) */
  connection?: string;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Contains detailed info about performed request
 */
export interface HARRequest {
  /** Request method */
  method: string;
  /** Absolute URL of the request (fragments are not included) */
  url: string;
  /** Request HTTP Version */
  httpVersion: string;
  /** List of cookie objects */
  cookies: HARCookie[];
  /** List of header objects */
  headers: HARHeader[];
  /** List of query parameter objects */
  queryString: HARQueryString[];
  /** Posted data info (optional) */
  postData?: HARPostData;
  /** Total number of bytes from the start of the HTTP request message until (and including) the double CRLF before the body */
  headersSize: number;
  /** Size of the request body in bytes (e.g. POST data payload) */
  bodySize: number;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Contains detailed info about the response
 */
export interface HARResponse {
  /** Response status */
  status: number;
  /** Response status description */
  statusText: string;
  /** Response HTTP Version */
  httpVersion: string;
  /** List of cookie objects */
  cookies: HARCookie[];
  /** List of header objects */
  headers: HARHeader[];
  /** Details about the response body */
  content: HARContent;
  /** Redirection target URL from the Location response header */
  redirectURL: string;
  /** Total number of bytes from the start of the HTTP response message until (and including) the double CRLF before the body */
  headersSize: number;
  /** Size of the received response body in bytes. Set to 0 in case of responses coming from the cache (304) */
  bodySize: number;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Contains list of all cookies (used in request and response objects)
 */
export interface HARCookie {
  /** The name of the cookie */
  name: string;
  /** The cookie value */
  value: string;
  /** The path pertaining to the cookie (optional) */
  path?: string;
  /** The host of the cookie (optional) */
  domain?: string;
  /** Cookie expiration time (ISO 8601) (optional) */
  expires?: string;
  /** Set to true if the cookie is HTTP only, false otherwise (optional) */
  httpOnly?: boolean;
  /** true if the cookie was transmitted over ssl, false otherwise (optional) */
  secure?: boolean;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Contains list of all headers (used in request and response objects)
 */
export interface HARHeader {
  /** The name of the header */
  name: string;
  /** The header value */
  value: string;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Contains list of all parameters & values parsed from a query string
 */
export interface HARQueryString {
  /** The name of the query */
  name: string;
  /** The query value */
  value: string;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Describes posted data
 */
export interface HARPostData {
  /** Mime type of posted data */
  mimeType: string;
  /** List of posted parameters (in case of URL encoded parameters) (optional, mutually exclusive with text) */
  params?: HARParam[];
  /** Plain text posted data (optional, mutually exclusive with params) */
  text?: string;
  /** Encoding used for posted data e.g. "base64" (optional) */
  encoding?: string;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * List of posted parameters
 */
export interface HARParam {
  /** name of a posted parameter */
  name: string;
  /** value of a posted parameter or content of a posted file (optional) */
  value?: string;
  /** name of a posted file (optional) */
  fileName?: string;
  /** content type of a posted file (optional) */
  contentType?: string;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Describes details about response content
 */
export interface HARContent {
  /** Length of the returned content in bytes. Should be equal to response.bodySize if there is no compression and bigger when the content has been compressed */
  size: number;
  /** Number of bytes saved (optional) */
  compression?: number;
  /** MIME type of the response text (value of the Content-Type response header). The charset attribute of the MIME type is included (if available) */
  mimeType: string;
  /** Response body sent from the server or loaded from the browser cache (optional) */
  text?: string;
  /** Encoding used for response text field e.g "base64" (optional) */
  encoding?: string;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Contains info about a request coming from browser cache
 */
export interface HARCache {
  /** State of a cache entry before the request (optional) */
  beforeRequest?: HARCacheEntry | null;
  /** State of a cache entry after the request (optional) */
  afterRequest?: HARCacheEntry | null;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Cache entry state (before or after request)
 */
export interface HARCacheEntry {
  /** Expiration time of the cache entry (optional) */
  expires?: string;
  /** The last time the cache entry was opened */
  lastAccess: string;
  /** Etag */
  eTag: string;
  /** The number of times the cache entry has been opened */
  hitCount: number;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * Describes various phases within request-response round trip
 * All times are specified in milliseconds
 */
export interface HARTimings {
  /** Time spent in a queue waiting for a network connection (optional, default -1) */
  blocked?: number;
  /** DNS resolution time. The time required to resolve a host name (optional, default -1) */
  dns?: number;
  /** Time required to create TCP connection (optional, default -1) */
  connect?: number;
  /** Time required to send HTTP request to the server */
  send: number;
  /** Waiting for a response from the server */
  wait: number;
  /** Time required to read entire response from the server (or cache) */
  receive: number;
  /** Time required for SSL/TLS negotiation (optional, default -1) */
  ssl?: number;
  /** A comment provided by the user or the application (optional) */
  comment?: string;
}

/**
 * (NOT PART OF SPEC)
 * Additional type for event streams that are encoded as JSON.
 */
export type EncodedEventStream = {
  $type: "event-stream";
  events: {
    /** The time in milliseconds since the start of the stream */
    timing?: number;
    /** The ID of the event */
    id?: string;
    /** The event type */
    event?: string;
    /** The data of the event */
    data?: string;
  }[];
};
