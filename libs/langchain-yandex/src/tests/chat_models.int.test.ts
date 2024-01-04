import { test } from "@jest/globals";
import { ChatYandexGPT } from "../chat_models.js";

test("Test YandexGPT generation", async () => {
  const model = new ChatYandexGPT({});
  const res = await model?.generate([
    [["human", `Translate "I love programming" into Korean.`]],
  ]);
  expect(res).toBeTruthy();
});
