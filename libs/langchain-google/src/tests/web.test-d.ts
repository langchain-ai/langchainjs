import { expectTypeOf, describe, it, test } from "vitest";
import {
  type GoogleEmbeddingsInput,
  GoogleEmbeddings,
  VertexAIEmbeddings,
  BlobStoreGoogleCloudStorage,
  BlobStoreAIStudioFile,
  type GoogleLLMInput,
  GoogleLLM,
  type ChatGoogleInput,
  ChatGoogle,
} from "../web.js";
import type { Credentials } from "web-auth-library/google";

describe("GoogleEmbeddingsInput types", () => {
  it("requires model and accepts web credentials", () => {
    // Test that these objects are assignable to GoogleEmbeddingsInput
    expectTypeOf<{
      model: string;
      authOptions: {
        credentials: string;
      };
    }>().toExtend<GoogleEmbeddingsInput>();

    // Test with Credentials object
    expectTypeOf<{
      model: string;
      authOptions: {
        credentials: Credentials;
      };
    }>().toExtend<GoogleEmbeddingsInput>();

    // should not allow node credentials
    expectTypeOf<{
      model: string;
      authOptions: {
        keyFilename: string;
      };
      // @ts-expect-error - should not allow node credentials
    }>().toExtend<GoogleEmbeddingsInput>();
  });

  // Test optional properties
  it("accepts optional web auth properties", () => {
    expectTypeOf<{
      model: string;
      authOptions: {
        credentials: string;
        scope?: string | string[];
        accessToken?: string;
        responseModality?: string;
      };
      apiKey?: string;
      maxConcurrency?: number;
      maxRetries?: number;
      endpoint?: string;
      location?: string;
      apiVersion?: string;
      platformType?: "gcp" | "gai";
    }>().toExtend<GoogleEmbeddingsInput>();
  });

  // Test that model is required
  it("has required model property", () => {
    expectTypeOf<GoogleEmbeddingsInput>().toHaveProperty("model");
    expectTypeOf<GoogleEmbeddingsInput["model"]>().toEqualTypeOf<string>();
  });

  // Test authOptions structure
  it("authOptions has web-specific structure", () => {
    expectTypeOf<GoogleEmbeddingsInput>().toHaveProperty("authOptions");

    type AuthOptions = NonNullable<GoogleEmbeddingsInput["authOptions"]>;
    expectTypeOf<AuthOptions>().toHaveProperty("credentials");
    expectTypeOf<AuthOptions["credentials"]>().toEqualTypeOf<
      string | Credentials
    >();

    // Test optional properties
    expectTypeOf<AuthOptions>().toHaveProperty("scope");
    expectTypeOf<AuthOptions["scope"]>().toEqualTypeOf<
      string | string[] | undefined
    >();

    expectTypeOf<AuthOptions>().toHaveProperty("accessToken");
    expectTypeOf<AuthOptions["accessToken"]>().toEqualTypeOf<
      string | undefined
    >();

    expectTypeOf<AuthOptions>().toHaveProperty("responseModality");
    expectTypeOf<AuthOptions["responseModality"]>().toEqualTypeOf<
      string | undefined
    >();
  });
});

describe("GoogleEmbeddings", () => {
  // Test that GoogleEmbeddings constructor accepts GoogleEmbeddingsInput
  test("constructor accepts GoogleEmbeddingsInput", () => {
    expectTypeOf<typeof GoogleEmbeddings>().toBeConstructibleWith(
      {} as GoogleEmbeddingsInput
    );
  });
});

describe("VertexAIEmbeddings", () => {
  it("constructor accepts GoogleEmbeddingsInput", () => {
    expectTypeOf<typeof VertexAIEmbeddings>().toBeConstructibleWith(
      {} as GoogleEmbeddingsInput
    );
  });
});

describe("GoogleLLMInput types", () => {
  it("accepts web credentials", () => {
    expectTypeOf<{
      authOptions: {
        credentials: string;
      };
    }>().toExtend<GoogleLLMInput>();

    expectTypeOf<{
      authOptions: {
        credentials: Credentials;
      };
    }>().toExtend<GoogleLLMInput>();
  });

  it("accepts optional web auth and LLM properties", () => {
    expectTypeOf<{
      model?: string;
      authOptions?: {
        credentials: string;
        scope?: string | string[];
        accessToken?: string;
        responseModality?: string;
      };
      apiKey?: string;
      temperature?: number;
      maxOutputTokens?: number;
      topP?: number;
      topK?: number;
      stopSequences?: string[];
      streaming?: boolean;
      endpoint?: string;
      location?: string;
      apiVersion?: string;
      platformType?: "gcp" | "gai";
    }>().toExtend<GoogleLLMInput>();
  });

  it("has model property with default", () => {
    expectTypeOf<GoogleLLMInput>().toHaveProperty("model");
    expectTypeOf<GoogleLLMInput["model"]>().toEqualTypeOf<string | undefined>();
  });
});

describe("GoogleLLM", () => {
  test("constructor accepts GoogleLLMInput", () => {
    expectTypeOf<typeof GoogleLLM>().toBeConstructibleWith(
      {} as GoogleLLMInput
    );
  });
});

describe("ChatGoogleInput types", () => {
  it("accepts web credentials", () => {
    expectTypeOf<{
      authOptions: {
        credentials: string;
      };
    }>().toExtend<ChatGoogleInput>();

    expectTypeOf<{
      authOptions: {
        credentials: Credentials;
      };
    }>().toExtend<ChatGoogleInput>();
  });

  it("accepts optional web auth and chat model properties", () => {
    expectTypeOf<{
      model?: string;
      authOptions?: {
        credentials: string;
        scope?: string | string[];
        accessToken?: string;
        responseModality?: string;
      };
      apiKey?: string;
      temperature?: number;
      maxOutputTokens?: number;
      topP?: number;
      topK?: number;
      stopSequences?: string[];
      streaming?: boolean;
      streamUsage?: boolean;
      endpoint?: string;
      location?: string;
      apiVersion?: string;
      platformType?: "gcp" | "gai";
    }>().toExtend<ChatGoogleInput>();
  });

  it("has model property with default", () => {
    expectTypeOf<ChatGoogleInput>().toHaveProperty("model");
    expectTypeOf<ChatGoogleInput["model"]>().toEqualTypeOf<
      string | undefined
    >();
  });
});

describe("ChatGoogle", () => {
  test("constructor accepts ChatGoogleInput", () => {
    expectTypeOf<typeof ChatGoogle>().toBeConstructibleWith(
      {} as ChatGoogleInput
    );
  });
});

describe("BlobStoreGoogleCloudStorage", () => {
  it("requires uriPrefix parameter", () => {
    expectTypeOf<typeof BlobStoreGoogleCloudStorage>().toBeConstructibleWith({
      uriPrefix: "gs://bucket/path" as any, // Using any to avoid complex URI type imports
    });
  });

  it("can be constructed with auth options", () => {
    expectTypeOf<typeof BlobStoreGoogleCloudStorage>().toBeConstructibleWith({
      uriPrefix: "gs://bucket/path" as any,
      authOptions: {
        credentials: "web-credentials",
      },
    });
    expectTypeOf<typeof BlobStoreGoogleCloudStorage>().toBeConstructibleWith({
      uriPrefix: "gs://bucket/path" as any,
      authOptions: {
        // @ts-expect-error - should not allow node credentials
        keyFilename: "/path/to/service-account.json",
      },
    });
  });
});

describe("BlobStoreAIStudioFile", () => {
  it("is constructible without parameters", () => {
    expectTypeOf<typeof BlobStoreAIStudioFile>().toBeConstructibleWith();
  });

  it("can be constructed with options", () => {
    expectTypeOf<typeof BlobStoreAIStudioFile>().toBeConstructibleWith({
      authOptions: {
        credentials: "web-credentials",
      },
      retryTime: 2000,
    });
    expectTypeOf<typeof BlobStoreAIStudioFile>().toBeConstructibleWith({
      authOptions: {
        // @ts-expect-error - should not allow node credentials
        keyFilename: "/path/to/service-account.json",
        projectId: "my-project",
      },
      retryTime: 2000,
    });
  });
});
