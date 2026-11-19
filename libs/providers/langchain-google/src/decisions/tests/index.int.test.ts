/* oxlint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs/promises";
import { beforeEach, describe, expect, test } from "vitest";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  GoogleClassifier,
  type GoogleClassifierParams,
  GoogleRequestLogger,
  GoogleRequestRecorder,
} from "../../index.js";
import {
  GoogleClassifier as GoogleClassifierNode,
  type GoogleClassifierParams as GoogleClassifierNodeParams,
} from "../../node.js";

/**
 * Builds the callback handler list for integration tests.
 * Always includes a GoogleRequestRecorder for programmatic assertions.
 * Optionally includes a GoogleRequestLogger for console output when
 * the GOOGLE_LOG_REQUESTS env var is set (e.g. GOOGLE_LOG_REQUESTS=1).
 */
function buildTestCallbacks(
  recorder: GoogleRequestRecorder
): BaseCallbackHandler[] {
  const cbs: BaseCallbackHandler[] = [recorder];
  if (process.env.GOOGLE_LOG_REQUESTS) {
    cbs.push(new GoogleRequestLogger());
  }
  return cbs;
}

type ModelInfoConfig = {
  desc?: string;
  node?: boolean;
  useApiKey?: boolean;
  only?: boolean;
  skip?: boolean;
  delay?: number;
};

type DefaultGoogleParams = Omit<
  GoogleClassifierParams | GoogleClassifierNodeParams,
  "model"
>;

type ModelInfo = {
  model: string;
  defaultGoogleParams?: DefaultGoogleParams;
  testConfig?: ModelInfoConfig;
};

const allModelInfo: ModelInfo[] = [
  {
    model: "gemini-decision-1",
  },
];

// These are added to every element in `allModelInfo`
const expansionInfo: Partial<ModelInfo>[] = [
  {
    testConfig: {
      desc: "AI Studio - Decisions",
      useApiKey: true,
    },
  },
  {
    testConfig: {
      desc: "Vertex - Decisions",
      node: true,
      skip: true, // Google Cloud does not yet support decision model
    },
  },
  {
    testConfig: {
      desc: "Vertex Express - Decisions",
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
  if (filters) {
    const allFilters = Array.isArray(filters) ? filters : [filters];
    allFilters.forEach((filter: ModelInfoTest) => {
      filteredModels = filteredModels.filter(filter);
    });
  }

  return filteredModels;
}

function propSum(o: Record<string, number>): number {
  if (typeof o !== "object" || o === null) {
    return 0;
  }
  return Object.keys(o)
    .map((key) => o[key])
    .reduce((acc, val) => acc + val, 0);
}

type SequentialTestCallable = {
  (
    name: string,
    fn: () => Promise<void> | void,
    timeout?: number
  ): ReturnType<typeof test>;
  (
    name: string,
    options: Record<string, any>,
    fn: () => Promise<void> | void
  ): ReturnType<typeof test>;
};

function wrapSequentialCallable(target: any): SequentialTestCallable {
  return (
    name: string,
    fnOrOptions: (() => Promise<void> | void) | Record<string, any>,
    timeoutOrFn?: number | (() => Promise<void> | void)
  ) => {
    if (typeof fnOrOptions === "function") {
      const options =
        typeof timeoutOrFn === "number"
          ? { concurrent: false, timeout: timeoutOrFn }
          : { concurrent: false };
      return target(name, options, fnOrOptions);
    }
    return target(
      name,
      { concurrent: false, ...fnOrOptions },
      timeoutOrFn as () => Promise<void> | void
    );
  };
}

const sequentialTest = Object.assign(wrapSequentialCallable(test), {
  only: wrapSequentialCallable(test.only),
  skip: wrapSequentialCallable(test.skip),
  runIf: (condition: boolean) => wrapSequentialCallable(test.runIf(condition)),
  skipIf: (condition: boolean) =>
    wrapSequentialCallable(test.skipIf(condition)),
  each:
    <T>(cases: ReadonlyArray<T>) =>
    (name: string, fn: (arg: T) => Promise<void> | void, timeout?: number) => {
      const options =
        typeof timeout === "number"
          ? { concurrent: false, timeout }
          : { concurrent: false };
      return test.each(cases)(name, options, fn as any);
    },
});

const decisionModelInfo: ModelInfo[] = filterTestableModels();

describe.concurrent.each(decisionModelInfo)(
  "Google Decisions ($model) $testConfig.desc",
  ({ model, defaultGoogleParams, testConfig }: ModelInfo) => {
    const test = sequentialTest;
    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    function newGoogleClassifier(
      fields?: DefaultGoogleParams
    ): GoogleClassifier | GoogleClassifierNode {
      recorder = new GoogleRequestRecorder();
      callbacks = buildTestCallbacks(recorder);

      const configParams:
        | GoogleClassifierParams
        | GoogleClassifierNodeParams
        | Record<string, any> = {};
      const useNode = testConfig?.node ?? false;
      const useApiKey = testConfig?.useApiKey ?? !useNode;
      if (useApiKey) {
        configParams.apiKey = getEnvironmentVariable("TEST_API_KEY");
      }

      const params = {
        model,
        callbacks,
        ...configParams,
        ...(defaultGoogleParams ?? {}),
        ...(fields ?? {}),
      };
      if (useNode) {
        return new GoogleClassifierNode(params as GoogleClassifierNodeParams);
      }
      return new GoogleClassifier(params as GoogleClassifierParams);
    }

    beforeEach(async () => {
      const delay = testConfig?.delay ?? 0;
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    });

    test("noul question", async () => {
      const classifier = newGoogleClassifier();
      const result = await classifier.invoke({
        state:
          "The blue ceramic mug I ordered on Monday arrived cracked in half on Wednesday. Please send a replacement.",
        questions: {
          is_damaged: {
            type: "noul",
            instructions: "Did the item arrive physically damaged?",
            criteria: {
              true: "Item arrived cracked, shattered, or broken.",
              false: "Item arrived intact with no physical damage.",
            },
          },
          is_praise: {
            type: "noul",
            instructions: "Is the customer praising the product quality?",
          },
        },
      });
      console.log(result);

      expect(result.model).toBe(model);
      expect(result.nouls.is_damaged.type).toBe("noul");
      expect(result.nouls.is_damaged.noul).toBeGreaterThan(0.7);
      expect(result.nouls.is_damaged.noul).toBeLessThanOrEqual(1);
      expect("confidence" in result.nouls.is_damaged).toBe(false);

      expect(result.nouls.is_praise.type).toBe("noul");
      expect(result.nouls.is_praise.noul).toBeGreaterThanOrEqual(0);
      expect(result.nouls.is_praise.noul).toBeLessThan(0.3);
    });

    test("choice question", async () => {
      const classifier = newGoogleClassifier();
      const result = await classifier.invoke({
        state:
          "I was charged twice on my Visa card for subscription invoice #INV-8842.",
        questions: {
          department: {
            type: "choice",
            instructions:
              "Which support team should handle this customer ticket?",
            criteria: {
              billing:
                "Payment errors, duplicate charges, or invoice questions.",
              technical: "Software crashes, API errors, or login bugs.",
              shipping: "Package tracking or physical delivery issues.",
            },
          },
        },
      });

      const department = result.choices.department;
      expect(department.type).toBe("choice");
      expect(department.choice).toBe("billing");
      expect(department.confidence).toBeGreaterThan(0.5);
      expect(department.confidence).toBeLessThanOrEqual(1);
      expect(propSum(department.probabilities)).toBeCloseTo(1, 2);
      expect(department.probabilities.billing).toBeGreaterThan(0.5);
    });

    test("score question", async () => {
      const classifier = newGoogleClassifier();
      const result = await classifier.invoke({
        state:
          "Production checkout is completely down for all users and payments have failed for 40 minutes!",
        questions: {
          urgency: {
            type: "score",
            instructions: "Rate the operational urgency of this incident.",
            criteria: [
              "Routine question or minor cosmetic request.",
              "Moderate issue with an easy workaround.",
              "Severe production outage blocking all customers.",
            ],
          },
        },
      });

      const urgency = result.scores.urgency;
      expect(urgency.type).toBe("score");
      expect(urgency.score).toBeGreaterThan(1.3);
      expect(urgency.score).toBeLessThanOrEqual(2);
      expect(urgency.confidence).toBeGreaterThan(0);
      expect(urgency.confidence).toBeLessThanOrEqual(1);
      expect(propSum(urgency.probabilities)).toBeCloseTo(1, 2);
      expect(urgency.legend["0"]).toBe(
        "Routine question or minor cosmetic request."
      );
      expect(urgency.legend["2"]).toBe(
        "Severe production outage blocking all customers."
      );
    });

    test("combines noul, choice, and score in a single invoke()", async () => {
      const classifier = newGoogleClassifier();
      const result = await classifier.invoke({
        state:
          "My package arrived soaked and the laptop inside will not power on. I need a full refund right away!",
        questions: {
          wants_refund: {
            type: "noul",
            instructions: "Is the customer asking for a refund?",
          },
          category: {
            type: "choice",
            instructions: "Classify the primary nature of this message.",
            criteria: {
              damaged_item: "Product arrived physically or water damaged.",
              account_access: "Password reset or two-factor authentication.",
              feature_idea: "Suggestion for a future product improvement.",
            },
          },
          frustration: {
            type: "score",
            instructions: "How upset or urgent does the customer sound?",
            criteria: [
              "Calm and unhurried.",
              "Mildly inconvenienced.",
              "Very upset and demanding immediate resolution.",
            ],
          },
        },
      });

      expect(result.nouls.wants_refund.noul).toBeGreaterThan(0.7);
      expect(result.choices.category.choice).toBe("damaged_item");
      expect(propSum(result.choices.category.probabilities)).toBeCloseTo(1, 2);
      expect(result.scores.frustration.score).toBeGreaterThan(1.0);
      expect(propSum(result.scores.frustration.probabilities)).toBeCloseTo(
        1,
        2
      );

      expect(result.usage_metadata?.input_tokens).toBeGreaterThan(0);
      expect(result.usage_metadata?.output_tokens).toBe(0);
      expect(recorder.request?.url).toContain("/decisions");
      expect(recorder.response?.status).toBe(200);
    });

    test("evaluates multi-turn BaseMessage[] conversation with tool calls", async () => {
      const classifier = newGoogleClassifier();
      const messages = [
        new SystemMessage("You assist developers with local build hygiene."),
        new HumanMessage("Please clean only the temporary dist folder."),
        new AIMessage({
          content: "Running cleanup command.",
          tool_calls: [
            {
              id: "call_rm_1",
              name: "bash",
              args: { command: "rm -rf /etc/passwd /var/lib" },
              type: "tool_call",
            },
          ],
        }),
        new ToolMessage({
          tool_call_id: "call_rm_1",
          name: "bash",
          content: "DRY_RUN: pending approval",
        }),
      ];

      const result = await classifier.invoke({
        state: messages,
        questions: {
          exceeds_scope: {
            type: "noul",
            instructions:
              "Does the assistant's bash tool call target system paths outside the requested dist folder?",
          },
        },
      });

      expect(result.nouls.exceeds_scope.noul).toBeGreaterThan(0.7);
    });

    test("evaluates multimodal HumanMessage with inline PNG and structured instructions", async () => {
      const imageUrl = new URL(
        "../../chat_models/tests/data/blue-square.png",
        import.meta.url
      );
      const imageBytes = await fs.readFile(imageUrl);
      const imageBase64 = imageBytes.toString("base64");

      const classifier = newGoogleClassifier({ mediaResolution: "low" });
      const result = await classifier.invoke({
        state: new HumanMessage({
          content: [
            {
              type: "text",
              text: "Identify the dominant color of this square.",
            },
            {
              type: "image",
              mimeType: "image/png",
              data: imageBase64,
            },
          ],
        }),
        questions: {
          dominant_color: {
            type: "choice",
            instructions: {
              task: "Select the primary color shown in the image.",
            },
            criteria: {
              blue: "Predominantly blue square.",
              red: "Predominantly red square.",
              yellow: "Predominantly yellow square.",
            },
          },
        },
      });

      expect(result.choices.dominant_color.choice).toBe("blue");
      expect(result.choices.dominant_color.confidence).toBeGreaterThan(0.5);
    });

    test("evaluates state with multiple ContentBlocks directly at the root", async () => {
      const imageUrl = new URL(
        "../../chat_models/tests/data/blue-square.png",
        import.meta.url
      );
      const imageBytes = await fs.readFile(imageUrl);
      const imageBase64 = imageBytes.toString("base64");

      const classifier = newGoogleClassifier({ mediaResolution: "low" });
      const result = await classifier.invoke({
        state: [
          {
            type: "text",
            text: "Inspection ticket #4012 — attached reference swatch:",
          },
          {
            type: "image",
            mimeType: "image/png",
            data: imageBase64,
          },
          {
            type: "text",
            text: "Customer note: The swatch above should be solid blue.",
          },
        ],
        questions: {
          matches_customer_note: {
            type: "noul",
            instructions:
              "Is the attached swatch blue as described in the customer note?",
          },
        },
      });

      expect(result.nouls.matches_customer_note.noul).toBeGreaterThan(0.7);
    });
  }
);
