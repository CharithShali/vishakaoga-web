// The membership card. The same component is used for the member's preview
// while registering, the committee's check before approving, and the final card.

function Crest() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" />
      <path d="M8 11l3 3 5-6" />
    </svg>
  );
}

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
        <span className="mc-brand"><Crest /> Visakha OGA</span>
        <span className="mc-branch">{branchName ? `${branchName} branch` : 'Branch'}</span>
      </div>

      <div className="mc-body">
        <div className="mc-person">
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
        </div>
        <div className="mc-qr">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR code for member number ${memberNo}`} />
          ) : (
            <span>QR code after approval</span>
          )}
        </div>
      </div>

      <div className="mc-bottom">
        <span className="mc-no">{memberNo ? `No. ${memberNo}` : 'Member number given on approval'}</span>
        <span className="mc-status">{status}</span>
      </div>
    </div>
  );
}
