import { test, expect } from "@jest/globals";
import { FalkorDBGraph } from "../falkordb_graph.js";
import { OpenAI } from "../../llms/openai.js";
import { GraphCypherQAChain } from "../../chains/graph_qa/cypher.js";

test("Test FalkorDB with LangChain", async () => {
  const url = "redis://localhost:6379";
  const graph = await FalkorDBGraph.initialize({ url });
  const model = new OpenAI({ temperature: 0, modelName: "gpt-4" });

  await graph.query(
    "CREATE (a:Actor {name:'Bruce Willis'})" +
      "-[:ACTED_IN]->(:Movie {title: 'Pulp Fiction'})"
  );

  const chain = GraphCypherQAChain.fromLLM({
    llm: model,
    graph,
  });

  const res = await chain.run("Who played in Pulp Fiction?");
  console.log(res);

  expect(res).toContain("Bruce Willis");
});
