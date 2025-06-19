import type { GoogleAuth } from "./auth/types.js";
import type { WebGoogleAuthOptions } from "./auth/web.js";
import type { GoogleAuthOptions as NodeGoogleAuthOptions } from "google-auth-library";

export interface EnvironmentDependencies {
  GoogleAuth: new (...args: any[]) => GoogleAuth;
}

export type Environment = "node" | "web";
export type GoogleAuthOptions<Env extends Environment> = Env extends "node"
  ? NodeGoogleAuthOptions
  : WebGoogleAuthOptions;

/**
 * Holder for environment dependencies. These dependencies cannot
 * be used during the module instantiation.
 */
export const environment: {
  value: EnvironmentDependencies;
} = {
  value: {
    get GoogleAuth(): EnvironmentDependencies["GoogleAuth"] {
      throw new Error("GoogleAuth is not available in this environment");
    },
  },
};
