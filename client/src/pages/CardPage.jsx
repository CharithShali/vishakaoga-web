import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';
import MemberCard from '../components/MemberCard.jsx';

export default function CardPage() {
  const [member, setMember] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/members/me')
      .then((d) => setMember(d.member))
      .catch((e) => setError(e.message));
  }, []);

  // The QR code holds only the member number; the event scanner looks her up.
  useEffect(() => {
    if (!member?.memberNo) return;
    QRCode.toDataURL(member.memberNo, {
      width: 320,
      margin: 1,
      color: { dark: '#0E1D38', light: '#FFFFFF' },
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [member]);

  if (error) return <p className="container page alert alert-error">{error}</p>;
  if (!member) return <p className="container page muted">Loading your card…</p>;

  return (
    <div className="container page card-page">
      <div className="no-print">
        <h1>Your membership card</h1>
        <p className="muted">Show it at events in any of the three cities. A screenshot works too.</p>
      </div>

      <div className="card-page-row">
        <MemberCard
          name={member.fullName}
          branchName={member.branch?.name}
          batchYear={member.batchYear}
          lastClass={member.lastClass}
          schoolRoles={member.schoolRoles}
          memberNo={member.memberNo}
          photoUrl={member.photoUrl}
          qrDataUrl={qr}
          status={member.status === 'active' ? 'Active member' : member.status}
        />

        <div className="card-actions no-print">
          <button type="button" className="btn btn-navy btn-lg" onClick={() => window.print()}>
            Print card
          </button>
          {qr && (
            <a className="btn btn-lg" href={qr} download={`${member.memberNo}.png`}>
              Save QR code
            </a>
          )}
          <p className="muted small">
            On a phone, take a screenshot of the card to keep it in your photos. The QR code
            holds only your member number.
          </p>
          {!member.memberNo && (
            <p className="alert">
              This account has no member number yet. Members get one when their registration
              is approved.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
