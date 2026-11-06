import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';
import MemberCard from '../components/MemberCard.jsx';
import { drawCardPng } from '../utils/cardImage.js';

export default function CardPage() {
  const [member, setMember] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/members/me')
      .then((d) => setMember(d.member))
      .catch((e) => setError(e.message));
  }, []);

  // The QR code holds only the member number; the event scanner looks her up.
  useEffect(() => {
    if (!member?.memberNo) return;
    QRCode.toDataURL(member.memberNo, {
      width: 400,
      margin: 1,
      color: { dark: '#0E1D38', light: '#FFFFFF' },
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [member]);

  async function saveCard() {
    setSaving(true);
    setError('');
    try {
      // The photo comes through our own server so the browser lets us draw it.
      const blob = await drawCardPng(member, member.photoUrl ? '/api/members/me/photo' : null, qr);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${member.memberNo || 'membership-card'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!member) {
    return error
      ? <p className="container page alert alert-error">{error}</p>
      : <p className="container page muted">Loading your card…</p>;
  }

  return (
    <div className="container page card-page">
      <div className="no-print">
        <h1>Your membership card</h1>
        <p className="muted">Show it at events in any of the three cities.</p>
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
          {member.memberNo && (
            <button type="button" className="btn btn-navy btn-lg" onClick={saveCard} disabled={saving || !qr}>
              {saving ? 'Saving…' : 'Save card to my phone'}
            </button>
          )}
          <button type="button" className="btn btn-lg" onClick={() => window.print()}>
            Print card
          </button>
          {member.memberNo && (
            <p className={member.subscriptionYears?.includes(new Date().getFullYear()) ? 'alert alert-ok' : 'alert'}>
              {member.subscriptionYears?.includes(new Date().getFullYear())
                ? `Membership fee paid for ${new Date().getFullYear()}.`
                : `No membership fee recorded for ${new Date().getFullYear()} yet. Pay your branch treasurer, who records it here.`}
              {member.subscriptionYears?.length > 0 && (
                <span className="small"> Paid years: {member.subscriptionYears.join(', ')}.</span>
              )}
            </p>
          )}
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          <p className="muted small">
            "Save card" downloads the card as a picture you can keep in your photos.
            The QR code holds only your member number.
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
