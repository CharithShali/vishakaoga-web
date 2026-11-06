import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { api } from '../api.js';
import { timeOnly } from '../utils/time.js';

const SAME_CARD_PAUSE_MS = 4000; // ignore the same card held in front of the camera

const RESULT_TEXT = {
  ok: { tone: 'ok', title: (m) => `Welcome, ${m.fullName.split(' ')[0]}!` },
  already: { tone: 'warn', title: () => 'Already checked in' },
  removed: { tone: 'bad', title: () => 'Membership removed' },
  inactive: { tone: 'bad', title: () => 'Not an active member' },
  unknown: { tone: 'bad', title: () => 'Card not recognised' },
};

// The gate: point a phone at members' QR cards, or type the member number.
export default function ScanPage() {
  const { id } = useParams();
  const videoRef = useRef(null);
  const busyRef = useRef(false);
  const lastRef = useRef({ code: '', at: 0 });
  const [event, setEvent] = useState(null);
  const [count, setCount] = useState(0);
  const [result, setResult] = useState(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    api(`/events/${id}`)
      .then(({ event: e }) => {
        setEvent(e);
        setCount(e.attendedCount);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const checkIn = useCallback(
    async (code, method) => {
      const clean = String(code || '').trim();
      if (!clean || busyRef.current) return;
      const now = Date.now();
      if (clean === lastRef.current.code && now - lastRef.current.at < SAME_CARD_PAUSE_MS) return;
      lastRef.current = { code: clean, at: now };

      busyRef.current = true;
      setError('');
      try {
        const res = await api(`/events/${id}/checkin`, { method: 'POST', body: { code: clean, method } });
        setResult(res);
        if (res.attendedCount != null) setCount(res.attendedCount);
        navigator.vibrate?.(res.result === 'ok' ? 120 : [80, 60, 80]);
      } catch (e) {
        setError(e.message);
      } finally {
        busyRef.current = false;
      }
    },
    [id]
  );

  // Start the camera once the event has loaded and she may scan.
  useEffect(() => {
    if (!event?.canScan || !videoRef.current) return undefined;
    const scanner = new QrScanner(videoRef.current, (r) => checkIn(r.data, 'qr'), {
      returnDetailedScanResult: true,
      preferredCamera: 'environment',
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 5,
    });
    scanner.start().catch(() =>
      setCameraError(
        'The camera could not start. Allow camera access for this site, or type member numbers below. (Phones only allow the camera on https:// sites.)'
      )
    );
    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [event, checkIn]);

  function submitTyped(e) {
    e.preventDefault();
    lastRef.current = { code: '', at: 0 }; // typing the same number again is on purpose
    checkIn(typed, 'typed');
    setTyped('');
  }

  if (!event) {
    return error
      ? <p className="container page alert alert-error">{error}</p>
      : <p className="container page muted">Loading…</p>;
  }
  if (!event.canScan) {
    return (
      <div className="container page narrow">
        <h1>Scanning not allowed</h1>
        <p>Only the committee and event helpers of this branch can scan cards for this event.</p>
        <Link to={`/events/${id}`}>Back to the event</Link>
      </div>
    );
  }

  const text = result && RESULT_TEXT[result.result];
  const m = result?.member;

  return (
    <div className="container page scan-page">
      <div className="scan-head">
        <div>
          <p className="eyebrow">Gate scanner</p>
          <h1 className="scan-title">{event.title}</h1>
        </div>
        <div className="scan-count" aria-live="polite">
          <span className="scan-count-n">{count}</span>
          <span className="small">checked in</span>
        </div>
      </div>

      <div className="scan-layout">
        <div className="scan-camera">
          {/* The scanner draws its frame over the video, so the wrapper must be position: relative. */}
          <div className="scan-video-wrap">
            <video ref={videoRef} muted playsInline className="scan-video" />
          </div>
          {cameraError && <p className="alert alert-error">{cameraError}</p>}
          <form className="scan-typed" onSubmit={submitTyped}>
            <label className="field">
              Or type the member number
              <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)}
                placeholder="OGA-COL-2016-0001" autoCapitalize="characters" autoComplete="off" />
            </label>
            <button type="submit" className="btn btn-navy" disabled={!typed.trim()}>Check in</button>
          </form>
        </div>

        <div className={`scan-result ${text ? `scan-${text.tone}` : 'scan-idle'}`} aria-live="assertive">
          {!result && <p className="scan-idle-text">Hold a membership card's QR code in front of the camera.</p>}
          {result && (
            <>
              <h2 className="scan-result-title">{text.title(m || {})}</h2>
              {m ? (
                <div className="scan-person">
                  <div className="scan-photo">
                    {m.photoUrl ? <img src={m.photoUrl} alt={`Photo of ${m.fullName}`} /> : <span>No photo</span>}
                  </div>
                  <div className="scan-person-text">
                    <span className="scan-name">{m.fullName}</span>
                    <span>{m.branch?.name} branch{m.batchYear ? ` · Batch ${m.batchYear}` : ''}</span>
                    <span className="small">{m.memberNo}</span>
                    {m.visiting && <span className="pill pill-gold">Visiting from {m.branch?.name}</span>}
                  </div>
                </div>
              ) : (
                <p>No member has the number <strong>{result.code}</strong>. Check the card, or ask her to show "My card" on her phone.</p>
              )}
              {result.result === 'ok' && <p className="scan-note">Checked in at {timeOnly(result.at)}.</p>}
              {result.result === 'already' && (
                <p className="scan-note">
                  Scanned at {timeOnly(result.at)}{result.by ? ` by ${result.by}` : ''}. No need to scan again.
                </p>
              )}
              {result.result === 'removed' && <p className="scan-note">Her membership has been removed. Please refer her to the committee.</p>}
              {result.result === 'inactive' && <p className="scan-note">This membership is not active. Please refer her to the committee.</p>}
            </>
          )}
          {error && <p className="alert alert-error" role="alert">{error}</p>}
        </div>
      </div>

      <p><Link to={`/events/${id}`}>See who's checked in</Link></p>
    </div>
  );
}
