// Helpers for calling the Express API. They throw an Error with the server's
// message (e.g. "Email or password is wrong.") when a call fails; err.field
// names the form field it is about, when the server says so.

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Something went wrong (error ${res.status}).`);
    err.field = data.field;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle(res);
}

// For forms with a file (e.g. registration with a photo).
export async function apiForm(path, formData) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    body: formData, // the browser sets the multipart Content-Type itself
  });
  return handle(res);
}
