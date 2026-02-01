import { describe, it, expect } from "@jest/globals";
import { YoutubeLoader } from "../web/youtube.js";

describe("YoutubeLoader", () => {
  describe("getVideoID (via createFromUrl)", () => {
    it("should extract videoId from standard watch URL", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should extract videoId from watch URL with additional params", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should extract videoId from watch URL with hash fragment", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ#anchor"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should extract videoId from short youtu.be URL", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://youtu.be/dQw4w9WgXcQ"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should extract videoId from youtu.be URL with params", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://youtu.be/dQw4w9WgXcQ?t=30"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should extract videoId from embed URL", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should extract videoId from shorts URL", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/shorts/dQw4w9WgXcQ"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should extract videoId from /v/ URL format", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/v/dQw4w9WgXcQ"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should handle video IDs with underscores", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=abc_def_123"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should handle video IDs with hyphens", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=abc-def-123"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should throw error for invalid YouTube URL", () => {
      expect(() => {
        YoutubeLoader.createFromUrl("https://example.com/not-a-video");
      }).toThrow("Failed to get youtube video id from the url");
    });

    it("should throw error for malformed URL", () => {
      expect(() => {
        YoutubeLoader.createFromUrl("not-a-url");
      }).toThrow("Failed to get youtube video id from the url");
    });

    it("should throw error for empty string", () => {
      expect(() => {
        YoutubeLoader.createFromUrl("");
      }).toThrow("Failed to get youtube video id from the url");
    });

    it("should throw error for URL with invalid video ID length", () => {
      // Video IDs must be exactly 11 characters
      expect(() => {
        YoutubeLoader.createFromUrl("https://www.youtube.com/watch?v=shortID");
      }).toThrow("Failed to get youtube video id from the url");
    });

    it("should throw error for URL with too long video ID", () => {
      expect(() => {
        YoutubeLoader.createFromUrl(
          "https://www.youtube.com/watch?v=thisIDisTooLongToBeValid"
        );
      }).toThrow("Failed to get youtube video id from the url");
    });
  });

  describe("createFromUrl options", () => {
    it("should create loader with default options", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should create loader with language option", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        { language: "es" }
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should create loader with addVideoInfo option", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        { addVideoInfo: true }
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should create loader with all options", () => {
      const loader = YoutubeLoader.createFromUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        { language: "de", addVideoInfo: true }
      );
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });
  });

  describe("constructor", () => {
    it("should create loader with videoId directly", () => {
      const loader = new YoutubeLoader({ videoId: "dQw4w9WgXcQ" });
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });

    it("should create loader with all config options", () => {
      const loader = new YoutubeLoader({
        videoId: "dQw4w9WgXcQ",
        language: "fr",
        addVideoInfo: true,
      });
      expect(loader).toBeInstanceOf(YoutubeLoader);
    });
  });
});
