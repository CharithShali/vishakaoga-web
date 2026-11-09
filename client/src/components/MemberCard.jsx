// The membership card, portrait like an ID card. The same component is used for
// the member's preview while registering, the committee's check before approving,
// the final card, printing, and (drawn the same way) the "Save card" image.

export default function MemberCard({
  name,
  branchName,
  batchYear,
  lastClass,
  schoolRoles = [],
  memberNo,
  photoUrl,
  qrDataUrl,
  status = 'Active member',
}) {
  const details = [batchYear && `Batch ${batchYear}`, lastClass && `Class ${lastClass}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="member-card">
      <div className="mc-top">
        <img src="/badge.png" alt="" className="mc-badge" />
        <span>Vishaka OGA</span>
      </div>

      <div className="mc-photo">
        {photoUrl ? <img src={photoUrl} alt={`Photo of ${name || 'member'}`} /> : <span>Photo</span>}
      </div>

      <div className="mc-text">
        <span className="mc-name">{name || 'Your name'}</span>
        {details && <span className="mc-detail">{details}</span>}
        {schoolRoles.length > 0 && (
          <span className="mc-roles">{schoolRoles.slice(0, 3).join(' · ')}</span>
        )}
      </div>

      <div className="mc-qr">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`QR code for member number ${memberNo}`} />
        ) : (
          <span>QR code after approval</span>
        )}
      </div>

      <div className="mc-meta">
        <span className="mc-no">{memberNo ? `No. ${memberNo}` : 'Member number given on approval'}</span>
        <span className="mc-status">{status}</span>
      </div>

      <div className="mc-branch">{branchName ? `${branchName} branch` : 'Branch'}</div>
    </div>
  );
}
