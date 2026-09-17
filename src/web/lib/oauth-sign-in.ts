// Forward only the server-signed OAuth fields. This is not validation: Better
// Auth verifies the signature/expiry before using them on either sign-in route.
export function oauthSignInQuery(search: string): string | undefined {
  const params = new URLSearchParams(search);
  const names = new Set(params.getAll("ba_param"));
  if (!params.has("sig") || !params.has("client_id") || !names.size)
    return undefined;
  const signed = new URLSearchParams();
  for (const [key, value] of params)
    if (key === "sig" || key === "ba_param" || names.has(key))
      signed.append(key, value);
  return signed.toString();
}
