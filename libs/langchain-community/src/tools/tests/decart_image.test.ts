import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { DecartImageGeneration } from "../decart_image.js";

const MOCK_API_KEY = "test-api-key";
const MOCK_PROMPT = "A beautiful sunset over mountains";
const MOCK_IMAGE_DATA = new Uint8Array([137, 80, 78, 71]); // PNG header bytes

describe("DecartImageGeneration", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(
      async () =>
        ({
          ok: true,
          arrayBuffer: () => Promise.resolve(MOCK_IMAGE_DATA.buffer),
          headers: new Headers({ "content-type": "image/png" }),
        } as Response)
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  test("can be instantiated with API key", () => {
    const tool = new DecartImageGeneration({ apiKey: MOCK_API_KEY });
    expect(tool.name).toBe("decart_image_generation");
    expect(tool.description).toContain("Generate images");
  });

  test("throws without API key", () => {
    const originalEnv = process.env.DECART_API_KEY;
    delete process.env.DECART_API_KEY;

    expect(() => new DecartImageGeneration()).toThrow(
      "Decart API key is required"
    );

    if (originalEnv !== undefined) {
      process.env.DECART_API_KEY = originalEnv;
    }
  });

  test("calls correct endpoint with correct headers", async () => {
    const tool = new DecartImageGeneration({ apiKey: MOCK_API_KEY });
    await tool._call(MOCK_PROMPT);

    expect(fetchMock).toBeCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe("https://api.decart.ai/v1/generate/lucy-pro-t2i");
    expect(options.method).toBe("POST");
    expect(options.headers["X-API-KEY"]).toBe(MOCK_API_KEY);
  });

  test("sends prompt in FormData body", async () => {
    const tool = new DecartImageGeneration({ apiKey: MOCK_API_KEY });
    await tool._call(MOCK_PROMPT);

    const [, options] = fetchMock.mock.calls[0];
    const formData = options.body as FormData;

    expect(formData.get("prompt")).toBe(MOCK_PROMPT);
    expect(formData.get("orientation")).toBe("landscape");
  });

  test("sends custom orientation in FormData body", async () => {
    const tool = new DecartImageGeneration({
      apiKey: MOCK_API_KEY,
      orientation: "portrait",
    });
    await tool._call(MOCK_PROMPT);

    const [, options] = fetchMock.mock.calls[0];
    const formData = options.body as FormData;

    expect(formData.get("orientation")).toBe("portrait");
  });

  test("returns base64 data URL", async () => {
    const tool = new DecartImageGeneration({ apiKey: MOCK_API_KEY });
    const result = await tool._call(MOCK_PROMPT);

    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  test("uses custom baseUrl when provided", async () => {
    const customBaseUrl = "https://custom.api.decart.ai";
    const tool = new DecartImageGeneration({
      apiKey: MOCK_API_KEY,
      baseUrl: customBaseUrl,
    });
    await tool._call(MOCK_PROMPT);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${customBaseUrl}/v1/generate/lucy-pro-t2i`);
  });

  test("throws on API error", async () => {
    fetchMock.mockImplementation(
      async () =>
        ({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        } as Response)
    );

    const tool = new DecartImageGeneration({ apiKey: MOCK_API_KEY });
    await expect(tool._call(MOCK_PROMPT)).rejects.toThrow(
      "Decart API error (401): Unauthorized"
    );
  });
});
