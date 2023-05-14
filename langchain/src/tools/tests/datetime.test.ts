import { it, expect, jest } from "@jest/globals";

import { DateTimeTool } from "../datetime.js";

describe("DateTimeTool", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2023-05-14"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return the current date time", async () => {
    const tool = new DateTimeTool();

    const result = await tool.call({});

    expect(result).toEqual(
      "Current date time is Sun, 14 May 2023 00:00:00 GMT"
    );
  });
});
