// Download an Excel or PDF file from the API, keeping the server's file name.
// Throws an Error with the server's message if it refuses (e.g. no permission).
export async function downloadFile(path, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  const res = await fetch(`/api${path}?${query}`, { credentials: 'same-origin' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Could not make the file (error ${res.status}).`);
  }
  const blob = await res.blob();
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
  const name = match ? match[1] : `download.${params.format || 'xlsx'}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
