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
} from "../node.js";
import type { GoogleAuthOptions } from "google-auth-library";

describe("GoogleEmbeddingsInput types", () => {
  it("requires model and accepts node credentials", () => {
    // Test with keyFilename
    expectTypeOf<{
      model: string;
      authOptions: {
        keyFilename: string;
      };
    }>().toExtend<GoogleEmbeddingsInput>();

    // Test with keyFile
    expectTypeOf<{
      model: string;
      authOptions: {
        keyFile: string;
      };
    }>().toExtend<GoogleEmbeddingsInput>();

    // Test with credentials object
    expectTypeOf<{
      model: string;
      authOptions: {
        credentials: {
          client_email: string;
          private_key: string;
        };
      };
    }>().toExtend<GoogleEmbeddingsInput>();

    // should not allow web credentials
    expectTypeOf<{
      model: string;
      authOptions: {
        credentials: string; // web-style string credentials
      };
      // @ts-expect-error - should not allow web credentials
    }>().toExtend<GoogleEmbeddingsInput>();
  });

  it("accepts optional node auth properties", () => {
    expectTypeOf<{
      model: string;
      authOptions: {
        keyFilename: string;
        scopes?: string | string[];
        projectId?: string;
        clientOptions?: {
          [key: string]: unknown;
        };
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

  it("has required model property", () => {
    expectTypeOf<GoogleEmbeddingsInput>().toHaveProperty("model");
    expectTypeOf<GoogleEmbeddingsInput["model"]>().toEqualTypeOf<string>();
  });

  it("authOptions has node-specific structure", () => {
    expectTypeOf<GoogleEmbeddingsInput>().toHaveProperty("authOptions");

    type AuthOptions = NonNullable<GoogleEmbeddingsInput["authOptions"]>;

    // Test that it extends GoogleAuthOptions
    expectTypeOf<AuthOptions>().toExtend<GoogleAuthOptions>();

    // Test optional node-specific properties
    expectTypeOf<AuthOptions>().toHaveProperty("keyFilename");
    expectTypeOf<AuthOptions["keyFilename"]>().toEqualTypeOf<
      string | undefined
    >();

    expectTypeOf<AuthOptions>().toHaveProperty("keyFile");
    expectTypeOf<AuthOptions["keyFile"]>().toEqualTypeOf<string | undefined>();

    expectTypeOf<AuthOptions>().toHaveProperty("scopes");
    expectTypeOf<AuthOptions["scopes"]>().toEqualTypeOf<
      string | string[] | undefined
    >();

    expectTypeOf<AuthOptions>().toHaveProperty("projectId");
    expectTypeOf<AuthOptions["projectId"]>().toEqualTypeOf<
      string | undefined
    >();
  });
});

describe("GoogleEmbeddings", () => {
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
  it("accepts node credentials", () => {
    expectTypeOf<{
      authOptions: {
        keyFilename: string;
      };
    }>().toExtend<GoogleLLMInput>();

    expectTypeOf<{
      authOptions: {
        credentials: {
          client_email: string;
          private_key: string;
        };
      };
    }>().toExtend<GoogleLLMInput>();
  });

  it("accepts optional node auth and LLM properties", () => {
    expectTypeOf<{
      model?: string;
      authOptions?: {
        keyFilename: string;
        scopes?: string | string[];
        projectId?: string;
        clientOptions?: {
          [key: string]: unknown;
        };
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
  it("accepts node credentials", () => {
    expectTypeOf<{
      authOptions: {
        keyFilename: string;
      };
    }>().toExtend<ChatGoogleInput>();

    expectTypeOf<{
      authOptions: {
        credentials: {
          client_email: string;
          private_key: string;
        };
      };
    }>().toExtend<ChatGoogleInput>();
  });

  it("accepts optional node auth and chat model properties", () => {
    expectTypeOf<{
      model?: string;
      authOptions?: {
        keyFilename: string;
        scopes?: string | string[];
        projectId?: string;
        clientOptions?: {
          [key: string]: unknown;
        };
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

  it("can be constructed with node auth options", () => {
    expectTypeOf<typeof BlobStoreGoogleCloudStorage>().toBeConstructibleWith({
      uriPrefix: "gs://bucket/path" as any,
      authOptions: {
        keyFilename: "/path/to/service-account.json",
      },
    });
    expectTypeOf<typeof BlobStoreGoogleCloudStorage>().toBeConstructibleWith({
      uriPrefix: "gs://bucket/path" as any,
      authOptions: {
        // @ts-expect-error - should not allow string credentials
        credentials: "foo",
      },
    });
  });
});

describe("BlobStoreAIStudioFile", () => {
  it("is constructible without parameters", () => {
    expectTypeOf<typeof BlobStoreAIStudioFile>().toBeConstructibleWith();
  });

  it("can be constructed with node auth options", () => {
    expectTypeOf<typeof BlobStoreAIStudioFile>().toBeConstructibleWith({
      authOptions: {
        keyFilename: "/path/to/service-account.json",
        projectId: "my-project",
      },
      retryTime: 2000,
    });
    expectTypeOf<typeof BlobStoreAIStudioFile>().toBeConstructibleWith({
      authOptions: {
        // @ts-expect-error - should not allow string credentials
        credentials: "foo",
      },
      retryTime: 2000,
    });
  });
});
