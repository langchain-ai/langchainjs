import { GoogleLLMResponse } from "../types.js";

export interface GoogleAISafetyHandler {
  /**
   * A function that will take a response and return the, possibly modified,
   * response or throw an exception if there are safety issues.
   *
   * @throws GoogleAISafetyError
   */
  handle(response: GoogleLLMResponse): GoogleLLMResponse;
}

export class GoogleAISafetyError extends Error {
  response: GoogleLLMResponse;

  reply: any = "";

  constructor(response: GoogleLLMResponse, message?: string) {
    super(message);

    this.response = response;
  }
}

export interface GoogleAISafetyParams {
  safetyHandler?: GoogleAISafetyHandler;
}
