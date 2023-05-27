import { Tool } from "./base.js";

export interface Headers {
  [key: string]: string;
}

export interface RequestTool {
  headers: Headers;
  maxOutputLength: number;
}

export class RequestsGetTool extends Tool implements RequestTool {
  name = "requests_get";

  maxOutputLength = 2000;

  constructor(
    public headers: Headers = {},
    { maxOutputLength }: { maxOutputLength?: number } = {}
  ) {
    super();

    this.maxOutputLength = maxOutputLength ?? this.maxOutputLength;
  }

  /** @ignore */
  async _call(input: string) {
    const res = await fetch(input, {
      headers: this.headers,
    });
    const text = await res.text();
    return text.slice(0, this.maxOutputLength);
  }

  description = `A portal to the internet. Use this when you need to get specific content from a website. 
  Input should be a  url (i.e. https://www.google.com). The output will be the text response of the GET request.`;
}

export class RequestsPostTool extends Tool implements RequestTool {
  name = "requests_post";

  maxOutputLength = Infinity;

  constructor(
    public headers: Headers = {},
    { maxOutputLength }: { maxOutputLength?: number } = {}
  ) {
    super();

    this.maxOutputLength = maxOutputLength ?? this.maxOutputLength;
  }

  /** @ignore */
  async _call(input: string) {
    try {
      const { url, data } = JSON.parse(input);
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(data),
      });
      const text = await res.text();
      return text.slice(0, this.maxOutputLength);
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Use this when you want to POST to a website.
  Input should be a json string with two keys: "url" and "data".
  The value of "url" should be a string, and the value of "data" should be a dictionary of 
  key-value pairs you want to POST to the url as a JSON body.
  Be careful to always use double quotes for strings in the json string
  The output will be the text response of the POST request.`;
}

export class HttpRequestTool extends Tool implements RequestTool {
  name: string;
  description: string;
  headers: any;
  maxOutputLength: number;

  constructor(headers = {}, { maxOutputLength = Infinity } = {}) {
    super();
    this.headers = headers;
    this.name = "http_request";
    this.maxOutputLength = maxOutputLength ?? Infinity;
    this.description = `Executes HTTP methods (GET, POST, PUT, DELETE, etc.). The input is an object with three keys: "url", "method", and "data". Even for GET or DELETE, include "data" key as an empty string. "method" is the HTTP method, and "url" is the desired endpoint. If POST or PUT, "data" should contain a stringified JSON representing the body to send. Only one url per use.`;
  }

  async _call(input: string) {
    try {
      const { url, method, data } = JSON.parse(input);

      let options: { method: any; headers: any; body?: any } = {
        method: method,
        headers: this.headers,
        body: undefined,
      };

      if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && data) {
        // If data if an object, stringify it
        if (typeof data === "object") {
          options.body = JSON.stringify(data);
        } else {
          options.body = data; // no need to stringify here
        }
        options.headers["Content-Type"] = "application/json";
      }

      const res = await fetch(url, options);

      const text = await res.text();
      // If "text" is an html page (check html tag), return an error
      if (text.includes("<html")) {
        return "This tool is not designed to browse web pages. Only use it for API calls.";
      }

      return text.slice(0, this.maxOutputLength);
    } catch (error) {
      console.log(error);
      return `${error}`;
    }
  }
}