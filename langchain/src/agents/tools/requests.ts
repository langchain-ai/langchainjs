import { Tool } from "./base.js";

export interface Headers {
  [key: string]: string;
}

export interface RequestTool {
  headers: Headers;
}

export class RequestsGetTool extends Tool implements RequestTool {
  name = "requests_get";

  constructor(public headers: Headers = {}) {
    super();
  }

  async call(input: string) {
    const res = await fetch(input, {
      headers: this.headers,
    });
    return res.text();
  }

  description = `A portal to the internet. Use this when you need to get specific content from a website. 
  Input should be a  url (i.e. https://www.google.com). The output will be the text response of the GET request.`;
}

export class RequestsPostTool extends Tool implements RequestTool {
  name = "requests_post";

  constructor(public headers: Headers = {}) {
    super();
  }

  async call(input: string) {
    try {
      const { url, data } = JSON.parse(input);
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(data),
      });
      return res.text();
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
