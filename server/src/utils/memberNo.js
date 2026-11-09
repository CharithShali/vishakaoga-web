// Member numbers start with the branch code, so the three cities never clash:
//   OGA-KDY-2004-0012  (branch, batch year, running number within the branch)
export function formatMemberNo(branchCode, batchYear, seq) {
  const year = batchYear ? String(batchYear) : '0000';
  return `OGA-${branchCode.toUpperCase()}-${year}-${String(seq).padStart(4, '0')}`;
}

// Branch codes: 2 to 5 capital letters or digits, starting with a letter (e.g. KDY, VVK, CMB2).
export function isValidBranchCode(code) {
  return /^[A-Z][A-Z0-9]{1,4}$/.test(String(code || ''));
}

/** OGA-KDY-2004-0012 with KDY → KAN gives OGA-KAN-2004-0012. Other numbers are unchanged. */
export function changeMemberNoCode(memberNo, oldCode, newCode) {
  const prefix = `OGA-${oldCode}-`;
  return memberNo && memberNo.startsWith(prefix) ? `OGA-${newCode}-${memberNo.slice(prefix.length)}` : memberNo;
}
