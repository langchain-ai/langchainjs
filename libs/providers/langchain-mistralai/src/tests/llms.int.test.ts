/* eslint-disable no-process-env */

import { test, expect } from "@jest/globals";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { HTTPClient } from "@mistralai/mistralai/lib/http.js";
import { MistralAI } from "../llms.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

test("Test MistralAI default", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    model: "codestral-latest",
  });
  const res = await model.invoke(
    "Log 'Hello world' to the console in javascript: "
  );
  // console.log({ res }, "Test MistralAI");
  expect(res.length).toBeGreaterThan(1);
});

test("Test MistralAI with stop in object", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    model: "codestral-latest",
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("console.log 'Hello world' in javascript:", {
    stop: ["world"],
  });
  // console.log({ res }, "Test MistralAI with stop in object");
});

test("Test MistralAI with timeout in call options", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    maxRetries: 0,
    model: "codestral-latest",
  });
  await expect(() =>
    model.invoke("Log 'Hello world' to the console in javascript: ", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test MistralAI with timeout in call options and node adapter", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    maxRetries: 0,
    model: "codestral-latest",
  });
  await expect(() =>
    model.invoke("Log 'Hello world' to the console in javascript: ", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test MistralAI with signal in call options", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    model: "codestral-latest",
  });
  const controller = new AbortController();
  await expect(async () => {
    const ret = await model.stream(
      "Log 'Hello world' to the console in javascript 100 times: ",
      {
        signal: controller.signal,
      }
    );

    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    for await (const chunk of ret) {
      // console.log({ chunk }, "Test MistralAI with signal in call options");
      controller.abort();
    }

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test MistralAI in streaming mode", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let nrNewTokens = 0;
    let streamedCompletion = "";

    const model = new MistralAI({
      maxTokens: 5,
      model: "codestral-latest",
      streaming: true,
      callbacks: CallbackManager.fromHandlers({
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      }),
    });
    const res = await model.invoke(
      "Log 'Hello world' to the console in javascript: "
    );
    // console.log({ res }, "Test MistralAI in streaming mode");

    expect(nrNewTokens > 0).toBe(true);
    expect(res).toBe(streamedCompletion);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test MistralAI stream method", async () => {
  const model = new MistralAI({
    maxTokens: 50,
    model: "codestral-latest",
  });
  const stream = await model.stream(
    "Log 'Hello world' to the console in javascript: ."
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test MistralAI stream method with abort", async () => {
  await expect(async () => {
    const model = new MistralAI({
      maxTokens: 250,
      maxRetries: 0,
      model: "codestral-latest",
    });
    const stream = await model.stream(
      "How is your day going? Be extremely verbose.",
      {
        signal: AbortSignal.timeout(1000),
      }
    );
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    for await (const chunk of stream) {
      // console.log({ chunk }, "Test MistralAI stream method with abort");
    }
  }).rejects.toThrow();
});

test("Test MistralAI stream method with early break", async () => {
  const model = new MistralAI({
    maxTokens: 50,
    model: "codestral-latest",
  });
  const stream = await model.stream(
    "How is your day going? Be extremely verbose."
  );
  let i = 0;
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  for await (const chunk of stream) {
    // console.log({ chunk }, "Test MistralAI stream method with early break");
    i += 1;
    if (i > 5) {
      break;
    }
  }
  expect(i).toBeGreaterThan(5);
});

test("Test MistralAI can register BeforeRequestHook function", async () => {
  const model = new MistralAI({
    model: "codestral-latest",
  });

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.addAllHooksToHttpClient();

  await model.invoke("Log 'Hello world' to the console in javascript: .");
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test MistralAI can register RequestErrorHook function", async () => {
  const fetcher = (): Promise<Response> =>
    Promise.reject(new Error("Intended fetcher error"));
  const customHttpClient = new HTTPClient({ fetcher });

  const model = new MistralAI({
    model: "codestral-latest",
    httpClient: customHttpClient,
    maxRetries: 0,
  });

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const RequestErrorHook = (): void => {
    addCount();
    console.log("In request error hook");
  };
  model.requestErrorHooks = [RequestErrorHook];
  model.addAllHooksToHttpClient();

  try {
    await model.invoke("Log 'Hello world' to the console in javascript: .");
  } catch (e: unknown) {
    // Intended error, do not rethrow
  }

  // console.log(count);
  expect(count).toEqual(1);
});

test("Test MistralAI can register ResponseHook function", async () => {
  const model = new MistralAI({
    model: "codestral-latest",
  });

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const ResponseHook = (): void => {
    addCount();
  };
  model.responseHooks = [ResponseHook];
  model.addAllHooksToHttpClient();

  await model.invoke("Log 'Hello world' to the console in javascript: .");
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test MistralAI can register multiple hook functions with success", async () => {
  const model = new MistralAI({
    model: "codestral-latest",
  });

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  const ResponseHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.responseHooks = [ResponseHook];
  model.addAllHooksToHttpClient();

  await model.invoke("Log 'Hello world' to the console in javascript: ");
  // console.log(count);
  expect(count).toEqual(2);
});

test("Test MistralAI can register multiple hook functions with error", async () => {
  const fetcher = (): Promise<Response> =>
    Promise.reject(new Error("Intended fetcher error"));
  const customHttpClient = new HTTPClient({ fetcher });

  const model = new MistralAI({
    model: "codestral-latest",
    httpClient: customHttpClient,
    maxRetries: 0,
  });

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  const RequestErrorHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.requestErrorHooks = [RequestErrorHook];
  model.addAllHooksToHttpClient();

  try {
    await model.invoke("Log 'Hello world' to the console in javascript: ");
  } catch (e: unknown) {
    // Intended error, do not rethrow
  }
  // console.log(count);
  expect(count).toEqual(2);
});

test("Test MistralAI can remove hook", async () => {
  const model = new MistralAI({
    model: "codestral-latest",
  });

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.addAllHooksToHttpClient();

  await model.invoke("Log 'Hello world' to the console in javascript: ");
  // console.log(count);
  expect(count).toEqual(1);

  model.removeHookFromHttpClient(beforeRequestHook);

  await model.invoke("Log 'Hello world' to the console in javascript: ");
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test MistralAI can remove all hooks", async () => {
  const model = new MistralAI({
    model: "codestral-latest",
  });

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  const ResponseHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.responseHooks = [ResponseHook];
  model.addAllHooksToHttpClient();

  await model.invoke("Log 'Hello world' to the console in javascript: ");
  // console.log(count);
  expect(count).toEqual(2);

  model.removeAllHooksFromHttpClient();

  await model.invoke("Log 'Hello world' to the console in javascript: ");
  // console.log(count);
  expect(count).toEqual(2);
});
