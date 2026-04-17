/**
 * Default base URL for Baseten's managed inference API.
 * Supports all open-source models hosted on Baseten's Model APIs.
 *
 * For self-deployed models, override with the model-specific URL:
 * `https://model-{model_id}.api.baseten.co/v1`
 */
export const DEFAULT_BASE_URL = "https://inference.baseten.co/v1";

/**
 * Default environment variable name for the Baseten API key.
 */
export const DEFAULT_API_KEY_ENV_VAR = "BASETEN_API_KEY";
