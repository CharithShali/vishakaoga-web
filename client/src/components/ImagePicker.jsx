import { useState } from 'react';
import { apiForm } from '../api.js';
import PhotoCropper from './PhotoCropper.jsx';

const SHAPES = {
  wide: { aspect: 16 / 9, maxWidth: 1600, label: 'Choose a picture', hint: 'Drag and zoom to choose what shows. The picture is cut to a wide 16:9 shape.' },
  portrait: { aspect: 5 / 6, maxWidth: 800, label: 'Choose a photo of her', hint: 'Drag the photo so her face sits in the middle of the frame.' },
};

// Pick, crop and upload a public picture (news cover, branch photo, honours photo).
// value = { id, url } or null; onChange gets the new { id, url } or null.
export default function ImagePicker({ shape = 'wide', value, onChange }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = SHAPES[shape];

  async function upload(blob) {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', blob, 'picture.jpg');
      const { id, url } = await apiForm(`/images?shape=${shape}`, form);
      onChange({ id, url });
      setOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`image-picker image-picker-${shape}`}>
      {value?.url && !open && (
        <img src={value.url} alt="" className="image-picker-preview" />
      )}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {busy && <p className="muted small">Uploading the picture…</p>}

      {open ? (
        <PhotoCropper
          aspect={s.aspect}
          maxWidth={s.maxWidth}
          label={s.label}
          hint={s.hint}
          onDone={upload}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <div className="row-actions">
          <button type="button" className="btn btn-small" onClick={() => setOpen(true)} disabled={busy}>
            {value?.id ? 'Change picture' : 'Add a picture'}
          </button>
          {value?.id && (
            <button type="button" className="btn btn-small" onClick={() => onChange(null)} disabled={busy}>
              Remove picture
            </button>
          )}
        </div>
      )}
    </div>
  );
}
