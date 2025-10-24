import { AsyncCallerParams } from "@langchain/core/utils/async_caller";

const STATUS_NO_RETRY = [
  400,
  401,
  402,
  403,
  404,
  405,
  406,
  407,
  408,
  409, // Conflict
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function failedAttemptHandler(error: any) {
  const status = error?.response?.status ?? 0;

  if (status === 0) {
    // What is this?
    console.error("failedAttemptHandler", error);
    throw error;
  }

  // What errors shouldn't be retried?
  if (STATUS_NO_RETRY.includes(+status)) {
    throw error;
  }
}

export function ensureParams(params?: AsyncCallerParams): AsyncCallerParams {
  const base: AsyncCallerParams = params ?? {};
  return {
    onFailedAttempt: failedAttemptHandler,
    ...base,
  };
}
