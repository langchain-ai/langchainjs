import { test, expect } from "@jest/globals";
import { OutputParserException } from "@langchain/core/output_parsers";
import { DatetimeOutputParser } from "../datetime.js";

test("DatetimeOutputParser", async () => {
  const parser = new DatetimeOutputParser();

  const currentDate = new Date();
  const currentDateStr = currentDate.toISOString();

  expect(await parser.parse(currentDateStr)).toEqual(currentDate);

  const isoDateStr = "05 October 2011 14:48Z";
  const isoDate = new Date(Date.UTC(2011, 9, 5, 14, 48));

  expect(await parser.parse(isoDateStr)).toEqual(isoDate);

  const invalidDateStr = "Vespertine was released by Bjork.";
  await expect(() => parser.parse(invalidDateStr)).rejects.toThrow(
    OutputParserException
  );
});
