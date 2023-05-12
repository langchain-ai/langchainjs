/* eslint-disable no-plusplus */
/* eslint-disable prefer-template */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-var */
/* eslint-disable vars-on-top */
/* eslint-disable no-param-reassign */
/* eslint-disable import/no-extraneous-dependencies */

/**
 * This is copied from @vespaiach/axios-fetch-adapter, which exposes an ESM
 * module without setting the "type" field in package.json.
 */

import axios from "axios";
import {
  EventStreamContentType,
  getLines,
  getBytes,
  getMessages,
} from "./event-source-parse.js";

function tryJsonStringify(data) {
  try {
    return JSON.stringify(data);
  } catch (e) {
    return data;
  }
}

/**
 * In order to avoid import issues with axios 1.x, copying here the internal
 * utility functions that we used to import directly from axios.
 */

// Copied from axios/lib/core/settle.js
function settle(resolve, reject, response) {
  const { validateStatus } = response.config;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(
      createError(
        `Request failed with status code ${response.status} and body ${
          typeof response.data === "string"
            ? response.data
            : tryJsonStringify(response.data)
        }`,
        response.config,
        null,
        response.request,
        response
      )
    );
  }
}

// Copied from axios/lib/helpers/isAbsoluteURL.js
function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

// Copied from axios/lib/helpers/combineURLs.js
function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "")
    : baseURL;
}

// Copied from axios/lib/helpers/buildURL.js
function encode(val) {
  return encodeURIComponent(val)
    .replace(/%3A/gi, ":")
    .replace(/%24/g, "$")
    .replace(/%2C/gi, ",")
    .replace(/%20/g, "+")
    .replace(/%5B/gi, "[")
    .replace(/%5D/gi, "]");
}

function buildURL(url, params, paramsSerializer) {
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    forEach(params, function serialize(val, key) {
      if (val === null || typeof val === "undefined") {
        return;
      }

      if (isArray(val)) {
        key = `${key}[]`;
      } else {
        val = [val];
      }

      forEach(val, function parseValue(v) {
        if (isDate(v)) {
          v = v.toISOString();
        } else if (isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(`${encode(key)}=${encode(v)}`);
      });
    });

    serializedParams = parts.join("&");
  }

  if (serializedParams) {
    var hashmarkIndex = url.indexOf("#");
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
  }

  return url;
}

// Copied from axios/lib/core/buildFullPath.js
function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
}

// Copied from axios/lib/utils.js
function isUndefined(val) {
  return typeof val === "undefined";
}

function isObject(val) {
  return val !== null && typeof val === "object";
}

function isDate(val) {
  return toString.call(val) === "[object Date]";
}

function isURLSearchParams(val) {
  return toString.call(val) === "[object URLSearchParams]";
}

function isArray(val) {
  return Array.isArray(val);
}

function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === "undefined") {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== "object") {
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

function isFormData(val) {
  return toString.call(val) === "[object FormData]";
}

// TODO this needs to be fixed to run in newer browser-like environments
// https://github.com/vespaiach/axios-fetch-adapter/issues/20#issue-1396365322
function isStandardBrowserEnv() {
  if (
    typeof navigator !== "undefined" &&
    // eslint-disable-next-line no-undef
    (navigator.product === "ReactNative" ||
      // eslint-disable-next-line no-undef
      navigator.product === "NativeScript" ||
      // eslint-disable-next-line no-undef
      navigator.product === "NS")
  ) {
    return false;
  }
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * - Create a request object
 * - Get response body
 * - Check if timeout
 */
export default async function fetchAdapter(config) {
  const request = createRequest(config);
  const data = await getResponse(request, config);

  return new Promise((resolve, reject) => {
    if (data instanceof Error) {
      reject(data);
    } else {
      // eslint-disable-next-line no-unused-expressions
      Object.prototype.toString.call(config.settle) === "[object Function]"
        ? config.settle(resolve, reject, data)
        : settle(resolve, reject, data);
    }
  });
}

/**
 * Fetch API stage two is to get response body. This funtion tries to retrieve
 * response body based on response's type
 */
async function getResponse(request, config) {
  let stageOne;
  try {
    stageOne = await fetch(request);
  } catch (e) {
    if (e && e.name === "AbortError") {
      return createError("Request aborted", config, "ECONNABORTED", request);
    }
    if (e && e.name === "TimeoutError") {
      return createError("Request timeout", config, "ECONNABORTED", request);
    }
    return createError("Network Error", config, "ERR_NETWORK", request);
  }

  const headers = {};
  stageOne.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const response = {
    ok: stageOne.ok,
    status: stageOne.status,
    statusText: stageOne.statusText,
    headers,
    config,
    request,
  };

  if (stageOne.status >= 200 && stageOne.status !== 204) {
    if (config.responseType === "stream") {
      const contentType = stageOne.headers.get("content-type");
      if (!contentType?.startsWith(EventStreamContentType)) {
        // If the content-type is not stream, response is most likely an error
        if (stageOne.status >= 400) {
          // If the error is a JSON, parse it. Otherwise, return as text
          if (contentType?.startsWith("application/json")) {
            response.data = await stageOne.json();
            return response;
          } else {
            response.data = await stageOne.text();
            return response;
          }
        }
        // If the non-stream response is also not an error, throw
        throw new Error(
          `Expected content-type to be ${EventStreamContentType}, Actual: ${contentType}`
        );
      }
      await getBytes(stageOne.body, getLines(getMessages(config.onmessage)));
    } else {
      switch (config.responseType) {
        case "arraybuffer":
          response.data = await stageOne.arrayBuffer();
          break;
        case "blob":
          response.data = await stageOne.blob();
          break;
        case "json":
          response.data = await stageOne.json();
          break;
        case "formData":
          response.data = await stageOne.formData();
          break;
        default:
          response.data = await stageOne.text();
          break;
      }
    }
  }

  return response;
}

/**
 * This function will create a Request object based on configuration's axios
 */
function createRequest(config) {
  const headers = new Headers(config.headers);

  // HTTP basic authentication
  if (config.auth) {
    const username = config.auth.username || "";
    const password = config.auth.password
      ? decodeURI(encodeURIComponent(config.auth.password))
      : "";
    headers.set("Authorization", `Basic ${btoa(`${username}:${password}`)}`);
  }

  const method = config.method.toUpperCase();
  const options = {
    headers,
    method,
  };
  if (method !== "GET" && method !== "HEAD") {
    options.body = config.data;

    // In these cases the browser will automatically set the correct Content-Type,
    // but only if that header hasn't been set yet. So that's why we're deleting it.
    if (isFormData(options.body) && isStandardBrowserEnv()) {
      headers.delete("Content-Type");
    }
  }
  // Some `fetch` implementations will override the Content-Type to text/plain
  // when body is a string.
  // See https://github.com/hwchase17/langchainjs/issues/1010
  if (typeof options.body === "string") {
    options.body = new TextEncoder().encode(options.body);
  }
  if (config.mode) {
    options.mode = config.mode;
  }
  if (config.cache) {
    options.cache = config.cache;
  }
  if (config.integrity) {
    options.integrity = config.integrity;
  }
  if (config.redirect) {
    options.redirect = config.redirect;
  }
  if (config.referrer) {
    options.referrer = config.referrer;
  }
  if (config.timeout && config.timeout > 0) {
    options.signal = AbortSignal.timeout(config.timeout);
  }
  if (config.signal) {
    // this overrides the timeout signal if both are set
    options.signal = config.signal;
  }
  // This config is similar to XHR’s withCredentials flag, but with three available values instead of two.
  // So if withCredentials is not set, default value 'same-origin' will be used
  if (!isUndefined(config.withCredentials)) {
    options.credentials = config.withCredentials ? "include" : "omit";
  }
  // for streaming
  if (config.responseType === "stream") {
    options.headers.set("Accept", EventStreamContentType);
  }

  const fullPath = buildFullPath(config.baseURL, config.url);
  const url = buildURL(fullPath, config.params, config.paramsSerializer);

  // Expected browser to throw error if there is any wrong configuration value
  return new Request(url, options);
}

/**
 * Note:
 *
 *   From version >= 0.27.0, createError function is replaced by AxiosError class.
 *   So I copy the old createError function here for backward compatible.
 *
 *
 *
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
function createError(message, config, code, request, response) {
  if (axios.AxiosError && typeof axios.AxiosError === "function") {
    return new axios.AxiosError(
      message,
      axios.AxiosError[code],
      config,
      request,
      response
    );
  }

  const error = new Error(message);
  return enhanceError(error, config, code, request, response);
}

/**
 *
 * Note:
 *
 *   This function is for backward compatible.
 *
 *
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }

  error.request = request;
  error.response = response;
  error.isAxiosError = true;

  error.toJSON = function toJSON() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: this.config,
      code: this.code,
      status:
        this.response && this.response.status ? this.response.status : null,
    };
  };
  return error;
}
