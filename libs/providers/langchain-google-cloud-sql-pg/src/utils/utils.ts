import { GoogleAuth } from "google-auth-library";

/**
 * Get email address associated with current authenticated IAM principal.
 * Email will be used for automatic IAM database authentication to Cloud SQL.
 *
 * @param {GoogleAuth} auth - object to use in finding the associated IAM principal email address.
 * @returns {string} email - email address associated with the current authenticated IAM principal
 */
export const getIAMPrincipalEmail = async (
  auth: GoogleAuth
): Promise<string> => {
  const credentials = await auth.getCredentials();

  if ("client_email" in credentials && credentials.client_email !== undefined) {
    return credentials.client_email.replace(".gserviceaccount.com", "");
  }

  const accessToken = await auth.getAccessToken();
  const client = await auth.getClient();

  const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`;
  const clientResponse = await client
    .request({ url })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((res: { data: any }) => res.data);

  if (!("email" in clientResponse)) {
    throw new Error(
      "Failed to automatically obtain authenticated IAM principal's " +
        "email address using environment's ADC credentials!"
    );
  }
  const { email } = clientResponse;
  return email.replace(".gserviceaccount.com", "");
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const customZip = (...arrays: any[]) => {
  const minLength = Math.min(...arrays.map((arr) => arr.length));
  const result = [];
  for (let i = 0; i < minLength; i += 1) {
    result.push(arrays.map((arr) => arr[i]));
  }
  return result;
};

/*
  Formatter functions
*/

// txt document formatter.
export function textFormatter(
  row: { [key: string]: string },
  content_columns: string[]
): string {
  return content_columns
    .filter((column) => column in row)
    .map((column) => String(row[column]))
    .join(" ");
}

// CSV document formatter.
export function csvFormatter(
  row: { [key: string]: string },
  content_columns: string[]
): string {
  return content_columns
    .filter((column) => column in row)
    .map((column) => String(row[column]))
    .join(", ");
}

// YAML document formatter
export function yamlFormatter(
  row: { [key: string]: string },
  content_columns: string[]
): string {
  return content_columns
    .filter((column) => column in row)
    .map((column) => `${column}: ${String(row[column])}`)
    .join("\n");
}

// JSON document formatter
export function jsonFormatter(
  row: { [key: string]: string },
  content_columns: string[]
): string {
  const dictionary: { [key: string]: string } = {};
  for (const column of content_columns) {
    if (column in row) {
      dictionary[column] = row[column];
    }
  }
  return JSON.stringify(dictionary);
}
