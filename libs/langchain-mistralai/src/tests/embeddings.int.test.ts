import { test } from "@jest/globals";
import { HTTPClient } from "@mistralai/mistralai/lib/http.js";
import { MistralAIEmbeddings } from "../embeddings.js";

test("Test MistralAIEmbeddings can embed query", async () => {
  const model = new MistralAIEmbeddings();
  // "Hello world" in French 🤓
  const text = "Bonjour le monde";
  const embeddings = await model.embedQuery(text);
  // console.log("embeddings", embeddings);
  expect(embeddings.length).toBe(1024);
});

test("Test MistralAIEmbeddings can embed documents", async () => {
  const model = new MistralAIEmbeddings();
  // "Hello world" in French 🤓
  const text = "Bonjour le monde";
  const documents = [text, text];
  const embeddings = await model.embedDocuments(documents);
  // console.log("embeddings", embeddings);
  expect(embeddings.length).toBe(2);
  expect(embeddings[0].length).toBe(1024);
  expect(embeddings[1].length).toBe(1024);
});

test("Test MistralAIEmbeddings can register BeforeRequestHook function", async () => {
  const model = new MistralAIEmbeddings({
    model: "mistral-embed",
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

  await model.embedQuery("Hello");
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test MistralAIEmbeddings can register RequestErrorHook function", async () => {
  const fetcher = (): Promise<Response> =>
    Promise.reject(new Error("Intended fetcher error"));
  const customHttpClient = new HTTPClient({ fetcher });

  const model = new MistralAIEmbeddings({
    model: "mistral-embed",
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
    await model.embedQuery("Hello");
  } catch (e: unknown) {
    // Intended error, do not rethrow
  }

  // console.log(count);
  expect(count).toEqual(1);
});

test("Test MistralAIEmbeddings can register ResponseHook function", async () => {
  const model = new MistralAIEmbeddings({
    model: "mistral-embed",
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

  await model.embedQuery("Hello");
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test MistralAIEmbeddings can register multiple hook functions with success", async () => {
  const model = new MistralAIEmbeddings({
    model: "mistral-embed",
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

  await model.embedQuery("Hello");
  // console.log(count);
  expect(count).toEqual(2);
});

test("Test MistralAIEmbeddings can register multiple hook functions with error", async () => {
  const fetcher = (): Promise<Response> =>
    Promise.reject(new Error("Intended fetcher error"));
  const customHttpClient = new HTTPClient({ fetcher });

  const model = new MistralAIEmbeddings({
    model: "mistral-embed",
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
    await model.embedQuery("Hello");
  } catch (e: unknown) {
    // Intended error, do not rethrow
  }
  // console.log(count);
  expect(count).toEqual(2);
});

test("Test MistralAIEmbeddings can remove hook", async () => {
  const model = new MistralAIEmbeddings({
    model: "mistral-embed",
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

  await model.embedQuery("Hello");
  // console.log(count);
  expect(count).toEqual(1);

  model.removeHookFromHttpClient(beforeRequestHook);

  await model.embedQuery("Hello");
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test MistralAIEmbeddings can remove all hooks", async () => {
  const model = new MistralAIEmbeddings({
    model: "mistral-embed",
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

  await model.embedQuery("Hello");
  // console.log(count);
  expect(count).toEqual(2);

  model.removeAllHooksFromHttpClient();

  await model.embedQuery("Hello");
  // console.log(count);
  expect(count).toEqual(2);
});
