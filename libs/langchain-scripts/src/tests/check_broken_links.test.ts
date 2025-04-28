import { test, expect } from "@jest/globals";
import { extractLinks } from "../check_broken_links.js";

test("Regex can find links in md files", () => {
  const link1 =
    "https://console.anthropic.com/workbench/2812bee0-2333-42cb-876e-6a5a5aab035a";
  const link2 =
    "https://js.langchain.com/docs/get_started/installation#installing-integration-packages";
  const link3 = "https://www.doordash.com/cart/";
  const mdWithLinks = `---
  title: Function calling
  ---
  
  # Function calling
  
  A growing number of chat models, like
  [OpenAI](${link1}),
  [Mistral](${link2}),
  etc., have a function-calling API that lets you describe functions and
  their arguments, and have the model return a JSON object with a function
  to invoke and the inputs to that function. Function-calling is extremely
  useful for building [tool-using chains and
  agents](${link3}), and for getting
  structured outputs from models more generally.`;

  const links = extractLinks(mdWithLinks);
  // console.log(links);
  expect(links).toEqual([link1, link2, link3]);
});
