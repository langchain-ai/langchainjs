import type { BaseRetrieverInterface } from "@langchain/core/retrievers";
import { z } from "zod";
import { CallbackManagerForToolRun } from "../../../callbacks/manager.js";
import {
  DynamicStructuredTool,
  DynamicStructuredToolInput,
} from "../../../tools/dynamic.js";
import { formatDocumentsAsString } from "../../../util/document.js";

/** @deprecated Use "langchain/tools/retriever" instead. */
export function createRetrieverTool(
  retriever: BaseRetrieverInterface,
  input: Omit<DynamicStructuredToolInput, "func" | "schema">
) {
  const func = async (
    { input }: { input: string },
    runManager?: CallbackManagerForToolRun
  ) => {
    const docs = await retriever.getRelevantDocuments(
      input,
      runManager?.getChild("retriever")
    );
    return formatDocumentsAsString(docs);
  };
  const schema = z.object({
    input: z
      .string()
      .describe("Natural language query used as input to the retriever"),
  });
  return new DynamicStructuredTool({ ...input, func, schema });
}
