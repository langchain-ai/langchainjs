describe("constructor", () => {
  it("should initialize successfully with required model parameter and valid apiClient", async () => {});
  it("should throw error when apiClient is not provided in constructor params", async () => {});
  it("should set model property to the value provided in constructor params", async () => {});
  it("should initialize streaming property to false by default", async () => {});
});
describe("invocationParams", () => {
  it("should return empty tools array when no tools are provided in params or options", async () => {});
  it("should convert LangChain tools to Gemini format when tools are provided", async () => {});
  it("should convert tool_choice to Gemini toolConfig when tool_choice is provided and tools exist", async () => {});
  it("should not include toolConfig when tool_choice is provided but no tools exist", async () => {});
  it("should convert Zod schemas to JSON schemas", async () => {});
  it("should use responseSchema as-is when it is already a plain JSON Schema object", async () => {});
  it("should automatically set responseMimeType to application/json when responseSchema is provided", async () => {});
  it("should not include responseMimeType when responseSchema is not provided", async () => {});
  it("should include safetySettings in generation config when provided", async () => {});
  it("should include all generation config parameters when provided", async () => {});
});
describe("bindTools", () => {
  it("should return a new Runnable instance with tools configured", async () => {});
  it("should accept array of BindToolsInput and merge with additional kwargs", async () => {});
  it("should preserve existing configuration while adding tools", async () => {});
});
