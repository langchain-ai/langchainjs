/**
 * Validation utilities for IBM watsonx.ai parameters
 * @module utils/validation
 */

/* oxlint-disable @typescript-eslint/no-explicit-any */
import { WatsonxValidationError } from "../types.js";

/**
 * Shared property validator for IBM watsonx.ai configurations.
 * Provides centralized validation logic for common patterns.
 *
 * @example
 * ```typescript
 * const validator = new PropertyValidator();
 *
 * // Validate that only allowed properties are present
 * validator.checkAllowed(
 *   { model: "granite", temperature: 0.7 },
 *   ["model", "temperature", "maxTokens"]
 * );
 *
 * // Validate exactly one of multiple options
 * validator.expectExactlyOne(
 *   { projectId: "123" },
 *   ["projectId", "spaceId"]
 * );
 *
 * // Validate at most one of multiple options
 * validator.expectAtMostOne(
 *   { projectId: "123" },
 *   ["projectId", "spaceId", "idOrName"]
 * );
 * ```
 */
export class PropertyValidator {
  private static readonly ALWAYS_ALLOWED = ["headers", "signal", "promptIndex"];
  private static readonly AUTH_PROPS = [
    "serviceUrl",
    "apiKey",
    "bearerToken",
    "username",
    "password",
    "authType",
    "authUrl",
    "disableSSL",
    // Legacy props
    "watsonxAIApikey",
    "watsonxAIBearerToken",
    "watsonxAIUsername",
    "watsonxAIPassword",
    "watsonxAIUrl",
    "watsonxAIAuthType",
  ];

  /**
   * Validates that only allowed properties are present.
   *
   * @param fields - The object to validate
   * @param allowedProps - Array of allowed property names
   * @param options - Validation options
   * @throws {WatsonxValidationError} If unexpected properties are found
   */
  validate(
    fields: Record<string, unknown>,
    allowedProps: string[],
    options: { includeCommon?: boolean; includeAuth?: boolean } = {},
  ): void {
    const { includeCommon = true, includeAuth = true } = options;

    const allowed = [
      ...allowedProps,
      ...(includeCommon ? PropertyValidator.ALWAYS_ALLOWED : []),
      ...(includeAuth ? PropertyValidator.AUTH_PROPS : []),
    ];

    const unexpected = Object.keys(fields).filter(
      (key) => !allowed.includes(key),
    );

    if (unexpected.length > 0) {
      throw new WatsonxValidationError(
        `Unexpected properties: ${unexpected.join(", ")}. ` +
          `Expected only: ${allowed.join(", ")}.`,
      );
    }
  }

  /**
   * Validates that exactly one of the specified properties is present.
   *
   * @param fields - The object to validate
   * @param props - Array of property names (exactly one must be present)
   * @throws {WatsonxValidationError} If not exactly one property is present
   */
  expectExactlyOne(fields: Record<string, unknown>, props: string[]): void {
    const provided = props.filter(
      (key) => key in fields && fields[key] !== undefined,
    );

    if (provided.length !== 1) {
      throw new WatsonxValidationError(
        `Expected exactly one of: ${props.join(", ")}. Got: ${provided.join(", ") || "none"}`,
      );
    }
  }

  /**
   * Validates that at most one of the specified properties is present.
   *
   * @param fields - The object to validate
   * @param props - Array of property names (at most one can be present)
   * @throws {WatsonxValidationError} If more than one property is present
   */
  expectAtMostOne(fields: Record<string, unknown>, props: string[]): void {
    const provided = props.filter(
      (key) => key in fields && fields[key] !== undefined,
    );

    if (provided.length > 1) {
      throw new WatsonxValidationError(
        `Expected at most one of: ${props.join(", ")}. Got: ${provided.join(", ")}`,
      );
    }
  }

  /**
   * Alias for validate() that checks only allowed properties.
   */
  checkAllowed(fields: Record<string, unknown>, allowedProps: string[]): void {
    const unexpected = Object.keys(fields).filter(
      (key) => !allowedProps.includes(key),
    );

    if (unexpected.length > 0) {
      throw new WatsonxValidationError(
        `Unexpected properties: ${unexpected.join(", ")}. Expected only: ${allowedProps.join(", ")}.`,
      );
    }
  }
}

/**
 * Validates that exactly one or at most one of the specified keys is provided.
 *
 * @param params - The parameters object to validate
 * @param keys - Array of key names to check
 * @param exactlyOneOf - If true, requires exactly one key; if false, allows zero or one key
 * @throws {WatsonxValidationError} If validation fails
 *
 * @example
 * ```typescript
 * // Require exactly one of projectId or spaceId
 * expectOneOf({ projectId: "123" }, ["projectId", "spaceId"], true);
 *
 * // Allow at most one of projectId or spaceId
 * expectOneOf({ projectId: "123" }, ["projectId", "spaceId"], false);
 * ```
 */
export function expectOneOf(
  params: Record<string, any>,
  keys: string[],
  exactlyOneOf = false,
): void {
  const provided = keys.filter(
    (key) => key in params && params[key] !== undefined,
  );

  if (exactlyOneOf && provided.length !== 1) {
    throw new WatsonxValidationError(
      `Expected exactly one of: ${keys.join(", ")}. Got: ${provided.join(", ")}`,
    );
  }

  if (!exactlyOneOf && provided.length > 1) {
    throw new WatsonxValidationError(
      `Expected one of: ${keys.join(", ")} or none. Got: ${provided.join(", ")}`,
    );
  }
}

/**
 * Validates that only allowed properties are present in the parameters object.
 *
 * @param params - The parameters object to validate
 * @param allowedKeys - Array of allowed key names
 * @throws {WatsonxValidationError} If unexpected properties are found
 *
 * @example
 * ```typescript
 * checkValidProps(
 *   { model: "granite", temperature: 0.7 },
 *   ["model", "temperature", "maxTokens"]
 * );
 * ```
 */
export function checkValidProps(
  params: Record<string, any>,
  allowedKeys: string[],
): void {
  const unexpected = Object.keys(params).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unexpected.length > 0) {
    throw new WatsonxValidationError(
      `Unexpected properties: ${unexpected.join(", ")}. Expected only: ${allowedKeys.join(", ")}.`,
    );
  }
}
