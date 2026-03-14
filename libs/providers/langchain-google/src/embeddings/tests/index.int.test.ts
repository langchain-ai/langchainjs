/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  MockInstance,
  test,
  vi,
} from "vitest";
import {
  GoogleEmbeddings,
  GoogleEmbeddingsParams,
} from "../../index.js";
import {
  GoogleEmbeddings as GoogleEmbeddingsNode,
  GoogleEmbeddingsParams as GoogleEmbeddingsNodeParams,
} from "../../node.js";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

// function buildTestCallbacks(
//   recorder: GoogleRequestRecorder
// ): BaseCallbackHandler[] {
//   const cbs: BaseCallbackHandler[] = [recorder];
//   if (process.env.GOOGLE_LOG_REQUESTS) {
//     cbs.push(new GoogleRequestLogger());
//   }
//   return cbs;
// }

type ModelInfoConfig = {
  node?: boolean;
  useApiKey?: boolean;
  useCredentials?: boolean;
  only?: boolean;
  skip?: boolean;
  delay?: number;
  defaultDimensions?: number;
  testDimensions?: number[];
  isMultimodal?: boolean;
};

type DefaultGoogleParams = Omit<
  GoogleEmbeddingsParams | GoogleEmbeddingsNodeParams,
  "model"
>;

type ModelInfo = {
  model: string;
  defaultGoogleParams?: DefaultGoogleParams;
  testConfig?: ModelInfoConfig;
};

const allModelInfo: ModelInfo[] = [
  {
    model: "text-embedding-005",
    testConfig: {
      defaultDimensions: 768,
      useApiKey: false,
    }
  },
  {
    model: "multimodalembedding@001",
    testConfig: {
      defaultDimensions: 1408,
      testDimensions: [128, 256, 512],
      useApiKey: false,

    }
  },
  {
    model: "gemini-embedding-001",
    testConfig: {
      defaultDimensions: 3072,
      testDimensions: [768, 1536],
    }
  },
  {
    model: "gemini-embedding-2-preview",
    testConfig: {
      isMultimodal: true,
      defaultDimensions: 3072,
      testDimensions: [768, 1536],
    }
  },
];

type ModelInfoTest = (modelInfo: ModelInfo) => boolean;

function filterTestableModels(
  filters?: ModelInfoTest | ModelInfoTest[]
): ModelInfo[] {
  const expandedModelInfo = expandAllModelInfo();

  const modelsWithOnly = expandedModelInfo.filter(
    (modelInfo) => modelInfo.testConfig?.only === true
  );

  const startingModels =
    modelsWithOnly.length > 0 ? modelsWithOnly : expandedModelInfo;

  const skippedModels = startingModels.filter(
    (modelInfo) => modelInfo.testConfig?.skip !== true
  );

  let filteredModels = skippedModels;
  let allFilters: ModelInfoTest[] = [];
  if (filters) {
    allFilters = Array.isArray(filters) ? filters : [filters];
  }
  allFilters.push((info) => info.testConfig?.useApiKey || info.testConfig?.node || false)
  allFilters.forEach((filter: ModelInfoTest) => {
    filteredModels = filteredModels.filter(filter);
  });

  return filteredModels;
}

const expansionInfo: Partial<ModelInfo>[] = [
  {
    testConfig: {
      useApiKey: true,
    },
  },
  {
    testConfig: {
      node: true,
    },
  },
  {
    testConfig: {
      useApiKey: true,
      node: true,
      skip: true,
    },
  },
];

function expandAllModelInfo(): ModelInfo[] {
  const ret: ModelInfo[] = [];

  allModelInfo.forEach((modelInfo: ModelInfo) => {
    expansionInfo.forEach((addl: Partial<ModelInfo>) => {
      const newInfo: ModelInfo = {
        model: modelInfo.model,
        defaultGoogleParams: modelInfo.defaultGoogleParams,
        testConfig: modelInfo.testConfig ?? {},
      };

      if (addl.defaultGoogleParams) {
        newInfo.defaultGoogleParams = {
          ...addl.defaultGoogleParams,
          ...newInfo.defaultGoogleParams,
        };
      }
      if (addl.testConfig) {
        newInfo.testConfig = {
          ...addl.testConfig,
          ...newInfo.testConfig,
        };
      }
      ret.push(newInfo);
    });
  });

  return ret;
}

const coreModelInfo: ModelInfo[] = filterTestableModels();

describe.each(coreModelInfo)(
  "Google Embeddings ($model) $testConfig",
  ({ model, defaultGoogleParams, testConfig }: ModelInfo) => {
    // let recorder: GoogleRequestRecorder;
    // let callbacks: BaseCallbackHandler[];
    let warnSpy: MockInstance<any>;

    function newGoogleEmbeddings(
      fields?: DefaultGoogleParams
    ): GoogleEmbeddings | GoogleEmbeddingsNode {
      // recorder = new GoogleRequestRecorder();
      // callbacks = buildTestCallbacks(recorder);

      const configParams:
        | GoogleEmbeddingsParams
        | GoogleEmbeddingsNodeParams
        | Record<string, any> = {};
      const useNode = testConfig?.node ?? false;
      const useApiKey = testConfig?.useApiKey ?? !useNode;
      if (useApiKey) {
        configParams.apiKey = getEnvironmentVariable("TEST_API_KEY");
      }

      const params = {
        model,
        ...configParams,
        ...(defaultGoogleParams ?? {}),
        ...(fields ?? {}),
      };
      
      if (useNode) {
        return new GoogleEmbeddingsNode(params);
      } else {
        return new GoogleEmbeddings(params);
      }
    }

    beforeEach(async () => {
      warnSpy = vi.spyOn(global.console, "warn");
      const delay = testConfig?.delay ?? 0;
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test("embedQuery", async () => {
      const embeddings = newGoogleEmbeddings();
      const result = await embeddings.embedQuery("What is 1 + 1?");

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toEqual(testConfig?.defaultDimensions);
      expect(typeof result[0]).toBe("number");
    });
    
    test("embedDocuments", async () => {
      const embeddings = newGoogleEmbeddings();
      const result = await embeddings.embedDocuments(["What is 1 + 1?", "Why is the sky blue?"]);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(Array.isArray(result[0])).toBe(true);
      expect(typeof result[0][0]).toBe("number");
    });
  }
);
