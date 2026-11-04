// Small helper for calling the Express API. Throws an Error with the
// server's message (e.g. "Email or password is wrong.") when a call fails.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Something went wrong (error ${res.status}).`);
  }
  return data;
}
