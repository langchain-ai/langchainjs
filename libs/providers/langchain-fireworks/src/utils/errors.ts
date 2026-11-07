import { stampRetryable } from "@langchain/core/errors";

/** Statuses absent here stay unclassified and keep their default retry behavior. */
const STATUS_RETRYABILITY: Record<number, boolean> = {
  400: false,
  401: false,
  402: false,
  403: false,
  404: false,
  408: true,
  413: false,
  429: true,
  500: true,
  502: true,
  503: true,
  504: true,
};

export function createFireworksResponseError(
  status: number,
  detail: string
): Error {
  const error = Object.assign(new Error(`Error ${status}: ${detail}`), {
    status,
  });

  const retryable = STATUS_RETRYABILITY[status];
  return retryable === undefined ? error : stampRetryable(error, retryable);
}
