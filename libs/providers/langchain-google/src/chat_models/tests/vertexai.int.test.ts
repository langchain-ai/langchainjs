describe("ChatGoogleVertexAI", () => {
  describe("API compatibility", () => {
    it("should successfully invoke Google Cloud Vertex AI API endpoint with generateContent method", async () => {});
    it("should successfully stream from Vertex AI API endpoint with generateContentStream method", async () => {});
    it("should handle Vertex AI-specific error response formats correctly", async () => {});
    it("should parse Vertex AI-specific response metadata and candidates structure", async () => {});
  });
  describe("model selection", () => {
    it("should successfully invoke with gemini-pro model name in Vertex AI format", async () => {});
    it("should successfully invoke with gemini-2.0-flash model name in Vertex AI format", async () => {});
    it("should handle Vertex AI model versioning (e.g., publishers/google/models/gemini-pro-001)", async () => {});
    it("should throw error when model is not available in specified GCP region", async () => {});
  });
  describe("Vertex AI multimodal", () => {
    it("should handle Cloud Storage URIs (gs://) for large media files in Vertex AI requests", async () => {});
    it("should download and process media from Cloud Storage when gs:// URIs are provided", async () => {});
    it("should handle Vertex AI Video Intelligence API integration for video content", async () => {});
  });
});
