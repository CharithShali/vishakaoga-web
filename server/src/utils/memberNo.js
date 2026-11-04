// Member numbers start with the branch code, so the three cities never clash:
//   OGA-KDY-2004-0012  (branch, batch year, running number within the branch)
export function formatMemberNo(branchCode, batchYear, seq) {
  const year = batchYear ? String(batchYear) : '0000';
  return `OGA-${branchCode.toUpperCase()}-${year}-${String(seq).padStart(4, '0')}`;
}
