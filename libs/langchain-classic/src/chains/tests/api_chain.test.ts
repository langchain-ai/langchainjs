import { expect, test, vi } from "vitest";
import { APIChain } from "../api/api_chain.js";
import { FakeListLLM } from "../../util/testing/llms/fake.js";

test("APIChain uses the fetch it is given", async () => {
  const llm = new FakeListLLM({
    responses: ["https://api.example.com/weather", "It is sunny."],
  });
  const fetch = vi.fn(async () => new Response('{"weather":"sunny"}'));
  const chain = APIChain.fromLLMAndAPIDocs(llm, "docs", { fetch });
  const result = await chain.invoke({ question: "Weather?" });
  expect(result.output).toBe("It is sunny.");
  expect(fetch).toHaveBeenCalledWith("https://api.example.com/weather", {
    headers: {},
  });
});

test("APIChain refuses URLs on private networks by default", async () => {
  const llm = new FakeListLLM({
    responses: ["http://169.254.169.254/latest/meta-data/"],
  });
  const chain = APIChain.fromLLMAndAPIDocs(llm, "docs");
  await expect(chain.invoke({ question: "Weather?" })).rejects.toThrow(
    /metadata/
  );
});
