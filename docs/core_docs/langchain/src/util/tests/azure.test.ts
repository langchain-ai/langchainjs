import { getEndpoint, OpenAIEndpointConfig } from "../azure.js";

describe("getEndpoint", () => {
  it("should return the correct endpoint with azureOpenAIBasePath and azureOpenAIApiDeploymentName", () => {
    const config: OpenAIEndpointConfig = {
      azureOpenAIApiKey: "API-KEY",
      azureOpenAIApiDeploymentName: "deploymentName",
      azureOpenAIBasePath:
        "https://westeurope.api.cognitive.microsoft.com/openai/deployments",
    };
    const result = getEndpoint(config);
    expect(result).toBe(
      "https://westeurope.api.cognitive.microsoft.com/openai/deployments/deploymentName"
    );
  });

  it("should return the correct endpoint with azureOpenAIApiKey, azureOpenAIApiInstanceName, and azureOpenAIApiDeploymentName", () => {
    const config: OpenAIEndpointConfig = {
      azureOpenAIApiKey: "key",
      azureOpenAIApiInstanceName: "instanceName",
      azureOpenAIApiDeploymentName: "deploymentName",
    };
    const result = getEndpoint(config);
    expect(result).toBe(
      "https://instanceName.openai.azure.com/openai/deployments/deploymentName"
    );
  });

  it("should throw error when azureOpenAIApiInstanceName is missing with azureOpenAIApiKey", () => {
    const config: OpenAIEndpointConfig = {
      azureOpenAIApiKey: "key",
      azureOpenAIApiDeploymentName: "deploymentName",
    };
    expect(() => getEndpoint(config)).toThrowError(
      "azureOpenAIApiInstanceName is required when using azureOpenAIApiKey"
    );
  });

  it("should throw error when azureOpenAIApiDeploymentName is missing with azureOpenAIApiKey", () => {
    const config: OpenAIEndpointConfig = {
      azureOpenAIApiKey: "key",
      azureOpenAIApiInstanceName: "instanceName",
    };
    expect(() => getEndpoint(config)).toThrowError(
      "azureOpenAIApiDeploymentName is a required parameter when using azureOpenAIApiKey"
    );
  });

  it("should return the custom basePath when neither azureOpenAIBasePath nor azureOpenAIApiKey is provided", () => {
    const config: OpenAIEndpointConfig = {
      baseURL: "https://basepath.com",
    };
    const result = getEndpoint(config);
    expect(result).toBe("https://basepath.com");
  });
});
