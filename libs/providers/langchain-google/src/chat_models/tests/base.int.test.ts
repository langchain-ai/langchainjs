describe("invoke", () => {
  describe("basic text generation", () => {
    it("should successfully generate text response for simple string prompt and return AIMessage", async () => {});
    it("should successfully generate text response for array of message objects with role and content properties", async () => {});
    it("should successfully generate text response for array of LangChain Message instances (HumanMessage, AIMessage, SystemMessage)", async () => {});
    it("should convert system messages to Gemini systemInstruction format correctly", async () => {});
    it("should convert conversation history with multiple user and assistant messages to Gemini contents format", async () => {});
    it("should extract and return text content from AIMessage when response contains text parts", async () => {});
    it("should handle empty text response gracefully and return empty string", async () => {});
  });
  describe("response metadata", () => {
    it("should include finishReason in generation info when provided in candidate response", async () => {});
    it("should include finishMessage in generation info when provided in candidate response", async () => {});
    it("should include safetyRatings in generation info when provided in candidate response", async () => {});
    it("should include citationMetadata in generation info when provided in candidate response", async () => {});
    it("should include tokenCount in generation info when provided in candidate response", async () => {});
    it("should populate usageMetadata with input_tokens from promptTokenCount", async () => {});
    it("should populate usageMetadata with output_tokens as sum of candidatesTokenCount and thoughtsTokenCount", async () => {});
    it("should populate usageMetadata with total_tokens from usageMetadata.totalTokenCount or calculated sum", async () => {});
    it("should populate input_token_details.cache_read from cachedContentTokenCount", async () => {});
    it("should populate output_token_details.reasoning from thoughtsTokenCount", async () => {});
    it("should include model version in llmOutput when provided in response", async () => {});
    it("should include responseId in llmOutput when provided in response", async () => {});
  });
  describe("error handling", () => {
    it("should throw PromptBlockedError when response contains promptFeedback with blockReason", async () => {});
    it("should throw NoCandidatesError when response contains no candidates array", async () => {});
    it("should throw NoCandidatesError when response candidates array is empty", async () => {});
    it("should throw RequestError when API response status is not ok (4xx or 5xx)", async () => {});
    it("should include response status and body in RequestError for debugging", async () => {});
  });
});
describe("stream", () => {
  describe("basic streaming", () => {
    it("should yield multiple AIMessageChunk objects progressively as content is generated", async () => {});
    it("should include text delta in each chunk when text parts are present", async () => {});
    it("should accumulate chunks into complete AIMessage using concat method", async () => {});
    it("should yield chunk with finishReason when generation completes", async () => {});
    it("should yield empty chunk when null data is received from stream", async () => {});
    it("should call runManager.handleLLMNewToken for each text chunk when runManager is provided", async () => {});
  });
  describe("with finishReason", () => {
    it("should include finishReason in chunk additional_kwargs when candidate contains finishReason", async () => {});
    it("should include finishMessage in chunk additional_kwargs when candidate contains finishMessage", async () => {});
    it("should include safetyRatings in chunk generationInfo when candidate contains safetyRatings", async () => {});
  });
  describe("error handling", () => {
    it("should throw RequestError when streaming API response status is not ok", async () => {});
    it("should handle stream interruption when signal is aborted via AbortController", async () => {});
  });
});
describe("tool calling", () => {
  describe("binding and invocation", () => {
    it("should include tool schemas in request when tools are bound using bindTools method", async () => {});
    it("should return AIMessage with tool_calls property populated when model decides to call tools", async () => {});
    it("should include tool name, arguments, and call id in each tool_call object", async () => {});
    it("should support binding multiple tools simultaneously", async () => {});
    it("should allow model to choose between multiple bound tools based on user query", async () => {});
  });
  describe("tool choice enforcement", () => {
    it('should force model to use any tool when tool_choice is set to "any"', async () => {});
    it("should force model to use specific tool when tool_choice is set to tool name string", async () => {});
    it("should allow model to choose freely when tool_choice is not specified", async () => {});
  });
  describe("parallel execution", () => {
    it("should generate multiple tool calls simultaneously when query requires independent operations", async () => {});
    it("should assign unique id to each parallel tool call for correlation with results", async () => {});
  });
});
describe("structured output", () => {
  describe("jsonMode", () => {
    it("should raise a warning and reassign method to jsonSchema", async () => {});
  });
  describe("jsonSchema", () => {
    it("should return structured output matching Zod schema when using jsonMode method", async () => {});
    it("should parse JSON response and validate against Zod schema automatically", async () => {});
    it("should return structured output matching JSON Schema when using jsonMode method with plain JSON Schema", async () => {});
    it("should throw MalformedOutputError when response is not an AIMessage or AIMessageChunk in jsonMode", async () => {});
    it("should throw MalformedOutputError when response contains no text content in jsonMode", async () => {});
  });
  describe("functionCalling", () => {
    it("should return structured output using function calling method when method is set to functionCalling", async () => {});
    it("should create function declaration with parameters derived from Zod schema", async () => {});
    it('should use provided name for function declaration or default to "extract" when name not specified', async () => {});
    it("should handle plain JSON Schema by converting to Gemini function parameters", async () => {});
    it("should handle GeminiFunctionDeclaration format when schema contains name and parameters properties", async () => {});
    it("should force tool_choice to function name when using functionCalling method", async () => {});
  });
  describe("includeRaw option", () => {
    it("should return both raw AIMessage and parsed structured output when includeRaw is true", async () => {});
    it("should return only parsed structured output when includeRaw is false or undefined", async () => {});
    it("should fallback to returning null for parsed field when parsing fails with includeRaw true", async () => {});
  });
});
describe("multimodal", () => {
  describe("image inputs", () => {
    it("should accept and process image content blocks in message content array", async () => {});
    it("should send image data with appropriate mimeType to API", async () => {});
  });
  describe("audio inputs", () => {
    it("should accept and process audio content blocks in message content array", async () => {});
    it("should send audio data with appropriate mimeType to API", async () => {});
  });
  describe("video inputs", () => {
    it("should accept and process video content blocks in message content array", async () => {});
    it("should send video data with appropriate mimeType to API", async () => {});
  });
  describe("mixed content", () => {
    it("should process messages containing both text and image content blocks simultaneously", async () => {});
    it("should process messages containing multiple multimodal content blocks of different types", async () => {});
  });
});
describe("streaming behavior with non-streaming flag", () => {
  it("should use internal streaming and aggregate chunks when streaming property is true but _generate is called", async () => {});
  it("should concatenate all chunks into single ChatResult with complete message", async () => {});
});
