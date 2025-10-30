import WatsonxAiMlVml_v1 from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import {
  authenticateAndSetInstance,
  authenticateAndSetGatewayInstance,
} from "../ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};
const serviceUrl = "https://fake.url/";
describe("Utils tests", () => {
  describe("Positive tests", () => {
    test("Test authentication function", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(WatsonxAiMlVml_v1);
    });

    test.only("Test authentication gateway function", () => {
      const instance = authenticateAndSetGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(Gateway);
    });
  });
});
