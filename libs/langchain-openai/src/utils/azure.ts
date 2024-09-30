export interface OpenAIEndpointConfig {
  azureOpenAIApiDeploymentName?: string;
  azureOpenAIApiInstanceName?: string;
  azureOpenAIApiKey?: string;
  azureADTokenProvider?: () => Promise<string>;
  azureOpenAIBasePath?: string;
  baseURL?: string | null;
  azureOpenAIEndpoint?: string;
}

/**
 * This function generates an endpoint URL for (Azure) OpenAI
 * based on the configuration parameters provided.
 *
 * @param {OpenAIEndpointConfig} config - The configuration object for the (Azure) endpoint.
 *
 * @property {string} config.azureOpenAIApiDeploymentName - The deployment name of Azure OpenAI.
 * @property {string} config.azureOpenAIApiInstanceName - The instance name of Azure OpenAI, e.g. `example-resource`.
 * @property {string} config.azureOpenAIApiKey - The API Key for Azure OpenAI.
 * @property {string} config.azureOpenAIBasePath - The base path for Azure OpenAI, e.g. `https://example-resource.azure.openai.com/openai/deployments/`.
 * @property {string} config.baseURL - Some other custom base path URL.
 * @property {string} config.azureOpenAIEndpoint - The endpoint for the Azure OpenAI instance, e.g. `https://example-resource.azure.openai.com/`.
 *
 * The function operates as follows:
 * - If both `azureOpenAIBasePath` and `azureOpenAIApiDeploymentName` (plus `azureOpenAIApiKey`) are provided, it returns an URL combining these two parameters (`${azureOpenAIBasePath}/${azureOpenAIApiDeploymentName}`).
 * - If both `azureOpenAIEndpoint` and `azureOpenAIApiDeploymentName` (plus `azureOpenAIApiKey`) are provided, it returns an URL combining these two parameters (`${azureOpenAIEndpoint}/openai/deployments/${azureOpenAIApiDeploymentName}`).
 * - If `azureOpenAIApiKey` is provided, it checks for `azureOpenAIApiInstanceName` and `azureOpenAIApiDeploymentName` and throws an error if any of these is missing. If both are provided, it generates an URL incorporating these parameters.
 * - If none of the above conditions are met, return any custom `baseURL`.
 * - The function returns the generated URL as a string, or undefined if no custom paths are specified.
 *
 * @throws Will throw an error if the necessary parameters for generating the URL are missing.
 *
 * @returns {string | undefined} The generated (Azure) OpenAI endpoint URL.
 */
export function getEndpoint(config: OpenAIEndpointConfig) {
  const {
    azureOpenAIApiDeploymentName,
    azureOpenAIApiInstanceName,
    azureOpenAIApiKey,
    azureOpenAIBasePath,
    baseURL,
    azureADTokenProvider,
    azureOpenAIEndpoint,
  } = config;

  if (
    (azureOpenAIApiKey || azureADTokenProvider) &&
    azureOpenAIBasePath &&
    azureOpenAIApiDeploymentName
  ) {
    return `${azureOpenAIBasePath}/${azureOpenAIApiDeploymentName}`;
  }
  if (
    (azureOpenAIApiKey || azureADTokenProvider) &&
    azureOpenAIEndpoint &&
    azureOpenAIApiDeploymentName
  ) {
    return `${azureOpenAIEndpoint}/openai/deployments/${azureOpenAIApiDeploymentName}`;
  }

  if (azureOpenAIApiKey || azureADTokenProvider) {
    if (!azureOpenAIApiInstanceName) {
      throw new Error(
        "azureOpenAIApiInstanceName is required when using azureOpenAIApiKey"
      );
    }
    if (!azureOpenAIApiDeploymentName) {
      throw new Error(
        "azureOpenAIApiDeploymentName is a required parameter when using azureOpenAIApiKey"
      );
    }
    return `https://${azureOpenAIApiInstanceName}.openai.azure.com/openai/deployments/${azureOpenAIApiDeploymentName}`;
  }

  return baseURL;
}
