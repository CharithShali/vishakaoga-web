import { useState } from 'react';
import { downloadFile } from '../utils/download.js';

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

// "Excel" and "PDF" buttons for one list. `params` are the list's current filters.
export default function DownloadButtons({ path, params = {}, label = 'Download' }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function get(format) {
    setBusy(format);
    setError('');
    try {
      await downloadFile(path, { ...params, format });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="download-buttons">
      {label && <span className="muted small">{label}</span>}
      <button type="button" className="btn btn-small btn-file" onClick={() => get('xlsx')} disabled={Boolean(busy)}>
        <FileIcon /> {busy === 'xlsx' ? 'Making…' : 'Excel'}
      </button>
      <button type="button" className="btn btn-small btn-file" onClick={() => get('pdf')} disabled={Boolean(busy)}>
        <FileIcon /> {busy === 'pdf' ? 'Making…' : 'PDF'}
      </button>
      {error && <span className="small download-error" role="alert">{error}</span>}
    </div>
  );
}
