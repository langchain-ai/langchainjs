import { Tool, Toolkit } from "./base";

type headers = { [key: string]: string };

interface RequestTool {
  headers: headers;
}

export class RequestsGetTool extends Tool implements RequestTool {
  name = "requests_get";

  headers: headers;

  constructor(headers?: headers) {
    super();
    this.headers = headers ?? {};
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

  headers: headers;

  constructor(headers?: headers) {
    super();
    this.headers = headers ?? {};
  }

  async call(input: string) {
    const res = await fetch(input, {
      method: "POST",
      headers: this.headers,
    });
    return res.text();
  }

  description = `Use this when you want to POST to a website.
  Input should be a json string with two keys: "url" and "data".
  The value of "url" should be a string, and the value of "data" should be a dictionary of 
  key-value pairs you want to POST to the url.
  Be careful to always use double quotes for strings in the json string
  The output will be the text response of the POST request.`;
}

export class RequestsToolkit extends Toolkit {
  tools: Tool[];

  constructor(headers?: headers) {
    super();
    this.tools = [new RequestsGetTool(headers), new RequestsPostTool(headers)];
  }
}
