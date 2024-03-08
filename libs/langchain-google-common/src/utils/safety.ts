import { GoogleLLMResponse } from "../types.js";

export class GoogleAISafetyError extends Error {
  response: GoogleLLMResponse;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reply: any = "";

  constructor(response: GoogleLLMResponse, message?: string) {
    super(message);

    this.response = response;
  }
}
