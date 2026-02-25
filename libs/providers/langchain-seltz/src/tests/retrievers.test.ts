import { it, expect } from "vitest";
import { _getMetadata } from "../retrievers.js";

it("should include the url field in metadata", () => {
  const dummyResult = {
    url: "https://example.com",
    content: "Example content",
  };

  const metadata = _getMetadata(dummyResult);
  expect(metadata.url).toBe("https://example.com");
});

it("should not include content in metadata", () => {
  const dummyResult = {
    url: "https://example.com",
    content: "Example content",
  };

  const metadata = _getMetadata(dummyResult);
  expect("content" in metadata).toBe(false);
});

it("should handle missing url", () => {
  const dummyResult = {
    content: "Example content",
  };

  const metadata = _getMetadata(dummyResult);
  expect("url" in metadata).toBe(false);
});
