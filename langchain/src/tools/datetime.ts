import { Tool } from "./base.js";

export class DateTimeTool extends Tool {
  name = "date-time";

  description =
    "Useful for getting the current date and time. No input is required.";

  /** @ignore */
  async _call(): Promise<string> {
    return `Current date time is ${new Date().toUTCString()}`;
  }
}
