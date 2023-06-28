export interface OpenAIEndpointConfig {
  azureOpenAIApiDeploymentName?: string;
  azureOpenAIApiInstanceName?: string;
  azureOpenAIApiKey?: string;
  azureOpenAiBasePath?: string;
  basePath?: string;
}

/**
 * This function generates an endpoint URL for (Azure) OpenAI
 * based on the configuration parameters provided.
 *
 * @param {OpenAIEndpointConfig} config - The configuration object for the (Azure) endpoint.
 *
 * @property {string} config.azureOpenAIApiDeploymentName - The deployment name of Azure OpenAI.
 * @property {string} config.azureOpenAIApiInstanceName - The instance name of Azure OpenAI.
 * @property {string} config.azureOpenAIApiKey - The API Key for Azure OpenAI.
 * @property {string} config.azureOpenAiBasePath - The base path for Azure OpenAI.
 * @property {string} config.basePath - The base path URL.
 *
 * The function operates as follows:
 * - If both `azureOpenAiBasePath` and `azureOpenAIApiDeploymentName` are provided, it returns an URL combining these two parameters.
 * - If `azureOpenAIApiKey` is provided, it checks for `azureOpenAIApiInstanceName` and `azureOpenAIApiDeploymentName` and throws an error if any of these is missing. If both are provided, it generates an URL incorporating these parameters.
 * - If none of the above conditions are met and `basePath` is not provided, it throws an error.
 * - The function returns the generated URL as a string.
 *
 * @throws Will throw an error if the necessary parameters for generating the URL are missing.
 *
 * @returns {string} The generated (Azure) OpenAI endpoint URL.
 */
export function getEndpoint(config: OpenAIEndpointConfig): string {
  const {
    azureOpenAIApiDeploymentName,
    azureOpenAIApiInstanceName,
    azureOpenAIApiKey,
    azureOpenAiBasePath,
    basePath,
  } = config;

  if (azureOpenAiBasePath && azureOpenAIApiDeploymentName) {
    return `${azureOpenAiBasePath}/openai/deployments/${azureOpenAIApiDeploymentName}`;
  }

  if (azureOpenAIApiKey) {
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

  if (!basePath) {
    throw new Error(
      "You must provide either an azureOpenAiBasePath or an azureOpenAIApiKey or a basePath"
    );
  }

  return basePath;
}
