export const instanceUrl =
  (import.meta.env.WXT_ISSOPEN_BASE_URL as string | undefined) ??
  "https://issopen.serviciosegado.com";
export const extensionResource = `${instanceUrl}/api/extension/v1`;
