/**
 * The read-only CLIs send a real OAuth access token (an Owner's, when run by hand) with every request.
 * Their API roots can be overridden by env vars - but only so tests can point them at a local fake
 * server. Any other override would hand the token to an arbitrary host, so it is refused.
 */
export function assertOverrideIsLoopback(name, value) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} is not a valid URL`); }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error(`${name} may only point to a local test server (127.0.0.1/localhost), got ${url.hostname} - refusing to send the access token there`);
  }
  return value;
}
