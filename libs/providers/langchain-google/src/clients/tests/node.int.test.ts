describe("NodeApiClient", () => {
  describe("initialization", () => {
    it("should initialize with API key when provided explicitly in constructor params", async () => {});
    it("should initialize with API key from GOOGLE_API_KEY environment variable when not provided in constructor", async () => {});
    it("should initialize with service account credentials when provided as JSON string in constructor params", async () => {});
    it("should initialize with service account credentials when provided as GCPCredentials object in constructor params", async () => {});
    it("should initialize with service account credentials from GOOGLE_CLOUD_CREDENTIALS environment variable when not provided in constructor", async () => {});
    it("should initialize GoogleAuth instance when googleAuthOptions parameter is provided", async () => {});
    it("should initialize GoogleAuth instance with Application Default Credentials when no auth params provided and no API key or credentials exist", async () => {});
    it("should prioritize explicit API key parameter over environment variable when both are present", async () => {});
    it("should prioritize explicit credentials parameter over environment variable when both are present", async () => {});
    it("should normalize and freeze credentials object to prevent mutation", async () => {});
    it("should handle empty constructor params and fall back to environment variables or ADC", async () => {});
  });
  describe("API key authentication", () => {
    it("should add X-Goog-Api-Key header to request when API key is configured", async () => {});
    it("should use API key from constructor parameter when both API key and credentials are provided", async () => {});
    it("should use API key from constructor parameter when API key credentials and googleAuthOptions are all provided", async () => {});
    it("should use API key from environment variable when no constructor params provided", async () => {});
    it("should successfully make authenticated request to Google API endpoint with valid API key", async () => {});
    it("should return response with status 200 when API key is valid and endpoint is accessible", async () => {});
    it("should not use GoogleAuth when API key is configured", async () => {});
    it("should preserve existing request headers when adding API key authentication header", async () => {});
  });
  describe("service account credentials authentication", () => {
    it("should generate access token from service account credentials and add to Authorization header", async () => {});
    it("should add Authorization header with Bearer scheme when credentials are configured", async () => {});
    it("should successfully make authenticated request to Google API endpoint with valid service account credentials", async () => {});
    it("should return response with status 200 when credentials are valid and endpoint is accessible", async () => {});
    it("should handle invalid service account credentials and throw AuthError with descriptive message", async () => {});
  });
  describe("Google Auth Library authentication", () => {
    it("should use GoogleAuth getRequestHeaders method when googleAuthOptions is provided and no API key or credentials exist", async () => {});
    it("should use GoogleAuth getRequestHeaders method when googleAuthOptions is provided explicitly", async () => {});
    it("should add Authorization header from GoogleAuth when using googleAuthOptions authentication", async () => {});
    it("should successfully make authenticated request to Google API endpoint with GoogleAuth and Application Default Credentials", async () => {});
  });
  describe("error handling", () => {
    it("should throw AuthError with response body details when token request fails with error response", async () => {});
    it("should throw Error when GoogleAuth getRequestHeaders rejects with authentication error", async () => {});
    it("should propagate fetch errors when underlying fetch implementation throws network error", async () => {});
    it("should handle invalid JSON in credentials string and throw error during parsing", async () => {});
  });
  describe("Application Default Credentials integration", () => {
    it("should initialize GoogleAuth with ADC when no auth configuration provided", async () => {});
    it("should use ADC for authentication when GoogleAuth is initialized without explicit credentials", async () => {});
  });
  describe("integration with Google APIs", () => {
    it("should successfully authenticate and retrieve models list from Generative AI API with API key", async () => {});
    it("should successfully authenticate and make chat completion request to Generative AI API with API key", async () => {});
    it("should handle request to Vertex AI endpoint with service account credentials and correct scopes", async () => {});
  });
});
