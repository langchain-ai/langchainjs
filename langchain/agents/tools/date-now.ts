import { Tool } from "./base";

export class DateNow extends Tool {
  name = "date-now";

  async call() {
    const now = new Date();
    return now.toISOString();
  }

  description = `Gets the current date/time as an ISO string.`;
}
