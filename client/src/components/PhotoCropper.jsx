import { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { cropToBlob } from '../utils/cropImage.js';

const MAX_MB = 20;

// Pick a photo, then drag and zoom so the face sits in the card frame (5:6).
// Calls onDone(blob) with the cropped JPEG when she clicks "Use this photo".
// Other shapes (e.g. 16:9 news pictures) pass aspect, label and hint.
export default function PhotoCropper({
  onDone,
  onCancel,
  aspect = 5 / 6,
  label = 'Choose a clear photo of your face',
  hint = 'Drag the photo so your face sits in the middle of the frame.',
  maxWidth = 800,
}) {
  const [src, setSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Free the browser's copy of the photo when it is no longer shown.
  useEffect(() => () => src && URL.revokeObjectURL(src), [src]);

  function handleFile(e) {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo (JPEG or PNG).');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That photo is very large. Please choose one under ${MAX_MB} MB.`);
      return;
    }
    setSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  async function usePhoto() {
    if (!area) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(src, area, maxWidth);
      onDone(blob);
      setSrc(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cropper">
      <label className="field">
        {label}
        <input type="file" accept="image/*" onChange={handleFile} />
      </label>
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {src && (
        <>
          <div className={aspect > 1 ? 'crop-area crop-area-wide' : 'crop-area'}>
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          </div>
          <label className="field">
            Zoom
            <input type="range" min="1" max="3" step="0.05" value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <p className="muted small">{hint}</p>
        </>
      )}

      <div className="row-actions">
        {src && (
          <button type="button" className="btn btn-navy" onClick={usePhoto} disabled={busy || !area}>
            {busy ? 'Preparing…' : 'Use this photo'}
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </div>
  );
}
