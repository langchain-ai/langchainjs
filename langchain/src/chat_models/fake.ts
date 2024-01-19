import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "chat_models/fake",
  newEntrypointName: "utils/testing",
  newPackageName: "@langchain/core",
});
export {
  type FakeChatInput,
  FakeListChatModel,
} from "@langchain/core/utils/testing";
