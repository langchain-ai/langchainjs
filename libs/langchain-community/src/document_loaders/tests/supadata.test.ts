import {
  test,
  expect,
  jest,
  describe,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { SupadataLoader } from "../web/supadata.js";

const mockTranscript = jest.fn();
const mockYoutubeVideo = jest.fn();

const mockSupadataConstructor = jest.fn().mockImplementation(() => ({
  transcript: mockTranscript,
  youtube: {
    video: mockYoutubeVideo,
  },
}));

jest.mock("@supadata/js", () => {
  return {
    Supadata: mockSupadataConstructor,
  };
});

const REAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...REAL_ENV };
  jest.clearAllMocks();
  mockTranscript.mockReset();
  mockYoutubeVideo.mockReset();
  mockSupadataConstructor.mockClear();
});

afterAll(() => {
  process.env = REAL_ENV;
});

describe("SupadataLoader", () => {
  test("initializes with API key", async () => {
    mockTranscript.mockResolvedValue({ content: "test", lang: "en" });

    const loader = new SupadataLoader({
      urls: ["https://youtube.com/watch?v=123"],
      apiKey: "test-key",
    });

    await loader.load();

    expect(mockSupadataConstructor).toHaveBeenCalledWith({ apiKey: "test-key" });
  });

  test("fetches transcript successfully", async () => {
    mockTranscript.mockResolvedValue({
      content: "Hello world",
      lang: "en",
    });

    const loader = new SupadataLoader({
      urls: ["https://youtube.com/watch?v=123"],
      apiKey: "test-key",
      operation: "transcript",
    });

    const docs = await loader.load();

    expect(mockTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://youtube.com/watch?v=123",
        text: true,
      }),
    );
    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).toBe("Hello world");
  });

  test("fetches metadata successfully", async () => {
    mockYoutubeVideo.mockResolvedValue({ title: "Awesome Video" });

    const loader = new SupadataLoader({
      urls: ["https://youtube.com/watch?v=123"],
      apiKey: "test-key",
      operation: "metadata",
    });

    const docs = await loader.load();

    expect(mockYoutubeVideo).toHaveBeenCalled();
    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).toContain("Awesome Video");
    expect(docs[0].metadata.supadataOperation).toBe("metadata");
  });
});
