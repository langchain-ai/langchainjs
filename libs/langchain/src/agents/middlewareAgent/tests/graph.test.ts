import fs from "node:fs";
import { describe, it, expect, afterAll } from "vitest";
import { tool } from "@langchain/core/tools";
import { createAgent, createMiddleware } from "../index.js";
import type { JumpToTarget } from "../types.js";

function powerSet<T>(arr: T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of arr) {
    const len = result.length;
    for (let i = 0; i < len; i++) {
      result.push([...result[i], item]);
    }
  }
  return result;
}

const jumpTargets: JumpToTarget[] = ["tools", "model", "end"];
const allSets: JumpToTarget[][] = powerSet(jumpTargets);
const beforeOptions: (JumpToTarget[] | undefined)[] = [undefined, ...allSets];
const afterOptions: (JumpToTarget[] | undefined)[] = [undefined, ...allSets];

const pairs = beforeOptions.flatMap((before) =>
  afterOptions.map((after) => ({ before, after }))
);

type Case = {
  aBefore?: JumpToTarget[];
  aAfter?: JumpToTarget[];
  bBefore?: JumpToTarget[];
  bAfter?: JumpToTarget[];
  hasTool: boolean;
};

const hasToolOptions = [false, true];
const matrix: Case[] = hasToolOptions.flatMap((hasTool) =>
  pairs.map((a, i) => {
    const b = pairs[(i + 1) % pairs.length];
    return {
      aBefore: a.before,
      aAfter: a.after,
      bBefore: b.before,
      bAfter: b.after,
      hasTool,
    };
  })
);

const collected: {
  aBeforeLabel: string;
  aAfterLabel: string;
  bBeforeLabel: string;
  bAfterLabel: string;
  toolsLabel: string;
  mermaid: string;
}[] = [];

const someTool = tool(async () => "Hello, world!", {
  name: "someTool",
});

describe.each(matrix)(
  "graph (A before: $aBefore, A after: $aAfter | B before: $bBefore, B after: $bAfter | tools: $hasTool)",
  ({ aBefore, aAfter, bBefore, bAfter, hasTool }) => {
    it("should create correct graph structure", async () => {
      const middleware1 = createMiddleware({
        name: "MiddlewareA",
        beforeModelJumpTo: aBefore,
        afterModelJumpTo: aAfter,
        beforeModel: () => {},
        afterModel: () => {},
      });

      const middleware2 = createMiddleware({
        name: "MiddlewareB",
        beforeModelJumpTo: bBefore,
        afterModelJumpTo: bAfter,
        beforeModel: () => {},
        afterModel: () => {},
      });

      const agent = createAgent({
        model: "openai:gpt-4o-mini",
        tools: hasTool ? [someTool] : [],
        middleware: [middleware1, middleware2] as const,
      });

      expect(agent.graph).toMatchSnapshot();
      const fmt = (v?: JumpToTarget[]) =>
        v === undefined
          ? "undefined"
          : v.length === 0
          ? "empty"
          : `<code>${v.join("</code>, <code>")}</code>`;
      const aBeforeLabel = fmt(aBefore);
      const aAfterLabel = fmt(aAfter);
      const bBeforeLabel = fmt(bBefore);
      const bAfterLabel = fmt(bAfter);
      const toolsLabel = hasTool ? "yes" : "no";
      const mermaid = await agent.drawMermaid({ withStyles: false });
      collected.push({
        aBeforeLabel,
        aAfterLabel,
        bBeforeLabel,
        bAfterLabel,
        toolsLabel,
        mermaid,
      });
    });
  }
);

afterAll(() => {
  const content = `# Graph Matrix (Mermaid)\n\n
This test creates a matrix of all possible combinations of before and after model jump targets for two middleware instances.
The basic test setup is as follows:

\`\`\`ts
const middleware1 = createMiddleware({
    name: "MiddlewareA",
    beforeModelJumpTo: aBefore,
    afterModelJumpTo: aAfter,
    beforeModel: () => {},
    afterModel: () => {},
});

const middleware2 = createMiddleware({
    name: "MiddlewareB",
    beforeModelJumpTo: bBefore,
    afterModelJumpTo: bAfter,
    beforeModel: () => {},
    afterModel: () => {},
});

const agent = createAgent({
    model: "openai:gpt-4o-mini",
    tools: [someTool],
    middleware: [middleware1, middleware2] as const,
});
\`\`\`

${collected
  .map(
    ({
      aBeforeLabel,
      aAfterLabel,
      bBeforeLabel,
      bAfterLabel,
      toolsLabel,
      mermaid,
    }) =>
      `<details>
<summary>

MiddlewareA before: ${aBeforeLabel}<br/>
MiddlewareA after: ${aAfterLabel}<br/>
MiddlewareB before: ${bBeforeLabel}<br/>
MiddlewareB after: ${bAfterLabel}<br/>
Tools: <code>${toolsLabel}</code>

</summary>

\`\`\`mermaid
${mermaid}
\`\`\`

</details>`
  )
  .join("\n\n")}`;
  fs.writeFileSync("graph-matrix.mermaid.md", content);
});
