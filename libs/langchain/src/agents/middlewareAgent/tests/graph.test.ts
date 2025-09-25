import fs from "node:fs";
import { describe, it, expect, afterAll } from "vitest";
import { tool } from "@langchain/core/tools";
import { createAgent, createMiddleware } from "../index.js";
import type { JumpToTarget } from "../types.js";

// Strategic test cases covering meaningful middleware interaction patterns
// rather than exhaustive combinations which would result in 13,122 test cases

type Case = {
  aBefore?: JumpToTarget[];
  aAfter?: JumpToTarget[];
  bBefore?: JumpToTarget[];
  bAfter?: JumpToTarget[];
  hasTool: boolean;
};

// Strategic matrix covering meaningful interaction patterns
const strategicCases: Omit<Case, "hasTool">[] = [
  // Basic cases - no jumps
  {
    aBefore: undefined,
    aAfter: undefined,
    bBefore: undefined,
    bAfter: undefined,
  },
  { aBefore: [], aAfter: [], bBefore: [], bAfter: [] },

  // Single middleware patterns
  {
    aBefore: ["tools"],
    aAfter: undefined,
    bBefore: undefined,
    bAfter: undefined,
  },
  {
    aBefore: undefined,
    aAfter: ["tools"],
    bBefore: undefined,
    bAfter: undefined,
  },
  {
    aBefore: ["model"],
    aAfter: undefined,
    bBefore: undefined,
    bAfter: undefined,
  },
  {
    aBefore: undefined,
    aAfter: ["model"],
    bBefore: undefined,
    bAfter: undefined,
  },
  {
    aBefore: ["end"],
    aAfter: undefined,
    bBefore: undefined,
    bAfter: undefined,
  },
  {
    aBefore: undefined,
    aAfter: ["end"],
    bBefore: undefined,
    bAfter: undefined,
  },

  // Interaction patterns - both middleware active
  {
    aBefore: ["tools"],
    aAfter: undefined,
    bBefore: ["model"],
    bAfter: undefined,
  },
  {
    aBefore: ["model"],
    aAfter: undefined,
    bBefore: ["tools"],
    bAfter: undefined,
  },
  {
    aBefore: undefined,
    aAfter: ["tools"],
    bBefore: undefined,
    bAfter: ["model"],
  },
  {
    aBefore: undefined,
    aAfter: ["model"],
    bBefore: undefined,
    bAfter: ["tools"],
  },

  // Sequential dependency patterns
  {
    aBefore: ["tools"],
    aAfter: ["model"],
    bBefore: undefined,
    bAfter: undefined,
  },
  {
    aBefore: undefined,
    aAfter: undefined,
    bBefore: ["tools"],
    bAfter: ["model"],
  },
  {
    aBefore: ["model"],
    aAfter: ["tools"],
    bBefore: undefined,
    bAfter: undefined,
  },

  // Termination patterns
  {
    aBefore: ["end"],
    aAfter: undefined,
    bBefore: ["tools"],
    bAfter: undefined,
  },
  {
    aBefore: ["tools"],
    aAfter: ["end"],
    bBefore: ["model"],
    bAfter: undefined,
  },
  {
    aBefore: undefined,
    aAfter: ["end"],
    bBefore: undefined,
    bAfter: ["tools"],
  },

  // Multiple option patterns
  {
    aBefore: ["tools", "model"],
    aAfter: undefined,
    bBefore: undefined,
    bAfter: undefined,
  },
  {
    aBefore: undefined,
    aAfter: ["tools", "model"],
    bBefore: undefined,
    bAfter: undefined,
  },
  {
    aBefore: ["tools", "end"],
    aAfter: undefined,
    bBefore: ["model"],
    bAfter: undefined,
  },
  {
    aBefore: ["model", "end"],
    aAfter: undefined,
    bBefore: ["tools"],
    bAfter: undefined,
  },

  // Complex interaction patterns
  {
    aBefore: ["tools", "model"],
    aAfter: ["end"],
    bBefore: ["tools"],
    bAfter: ["model"],
  },
  {
    aBefore: ["tools"],
    aAfter: ["model", "end"],
    bBefore: ["model"],
    bAfter: ["tools"],
  },
  {
    aBefore: ["tools", "model", "end"],
    aAfter: undefined,
    bBefore: undefined,
    bAfter: ["tools", "model", "end"],
  },

  // Edge cases - conflicting or unusual patterns
  { aBefore: ["end"], aAfter: ["tools"], bBefore: ["end"], bAfter: ["model"] },
  {
    aBefore: ["tools", "model", "end"],
    aAfter: ["tools", "model", "end"],
    bBefore: ["tools", "model", "end"],
    bAfter: ["tools", "model", "end"],
  },
];

const hasToolOptions = [false, true];
const matrix: Case[] = hasToolOptions.flatMap((hasTool) =>
  strategicCases.map((testCase) => ({
    ...testCase,
    hasTool,
  }))
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
