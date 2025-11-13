import type { BaseRetrieverInterface } from "@langchain/core/retrievers";
import { z } from "zod/v3";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import {
  DynamicStructuredTool,
  type DynamicStructuredToolInput,
} from "@langchain/core/tools";
import { formatDocumentsAsString } from "../util/document.js";

export function createRetrieverTool(
  retriever: BaseRetrieverInterface,
  input: Omit<DynamicStructuredToolInput, "func" | "schema">
) {
  const func = async (
    { query }: { query: string },
    runManager?: CallbackManagerForToolRun
  ) => {
    const docs = await retriever.invoke(
      query,
      runManager?.getChild("retriever")
    );
    return formatDocumentsAsString(docs);
  };
  const schema = z.object({
    query: z.string().describe("query to look up in retriever"),
  });
  return new DynamicStructuredTool({ ...input, func, schema });
}
