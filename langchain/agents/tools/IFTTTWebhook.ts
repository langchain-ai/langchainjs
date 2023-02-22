import fetch from "node-fetch";
import { Tool } from "./base";

class IFTTTWebhook extends Tool {
  private url: string;

  name: string;

  description: string;

  constructor(
    url: string,
    name = "ifttt",
    description = "Send data to an IFTTT webhook URL"
  ) {
    super();
    this.url = url;
    this.name = name;
    this.description = description;
  }

  async call(input: string): Promise<string> {
    const headers = { "Content-Type": "application/json" };
    const body = JSON.stringify({ this: input });

    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const result = await response.text();
    return result;
  }
}

export { IFTTTWebhook };
