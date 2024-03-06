import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { BaseLLMParams } from "@langchain/core/language_models/llms";
import { Bedrock as BaseBedrock } from "./web.js";
import { logVersion010MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "llms/bedrock",
});

export class Bedrock extends BaseBedrock {
  static lc_name() {
    return "Bedrock";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(fields?: Partial<any> & BaseLLMParams) {
    super({
      ...fields,
      credentials: fields?.credentials ?? defaultProvider(),
    });
  }
}
