import { jest, afterEach, beforeEach, describe, expect } from "@jest/globals";
import { WolframAlphaTool } from "../wolframalpha.js";

const MOCK_APP_ID = "[MOCK_APP_ID]";
const QUERY_1 = "What is 2 + 2?";
const MOCK_ANSWER = "[MOCK_ANSWER]";

describe("wolfram alpha test suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(
      async () =>
        ({
          text: () => Promise.resolve(MOCK_ANSWER),
        } as Response)
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  test("test query parameters passed correctly", async () => {
    const wolframAlpha = new WolframAlphaTool({
      appid: MOCK_APP_ID,
    });
    await wolframAlpha._call(QUERY_1);
    const [url] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(url);
    const params = new URLSearchParams(parsedUrl.search);

    expect(fetchMock).toBeCalledTimes(1);
    expect(params.get("appid")).toBe(MOCK_APP_ID);
    expect(params.get("input")).toBe(QUERY_1);
  });

  test("test answer retrieved", async () => {
    const wolframAlpha = new WolframAlphaTool({
      appid: MOCK_APP_ID,
    });

    const answer = await wolframAlpha._call(QUERY_1);
    expect(answer).toBe(MOCK_ANSWER);
  });
});
