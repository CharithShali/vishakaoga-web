// Wording of the membership fee reminder, shared by the website notification
// and (in the browser) the WhatsApp message.

export function feeReminderText(firstName, year, branchName) {
  const who = firstName ? `Dear ${firstName}, ` : '';
  const where = branchName ? `your ${branchName} branch treasurer` : 'your branch treasurer';
  return (
    `${who}we haven't recorded your Visakha OGA membership fee for ${year} yet. ` +
    `Please pay ${where} by cash or bank transfer. ` +
    `If you have already paid, please let the treasurer know so it can be recorded. Thank you!`
  );
}

export const firstNameOf = (fullName) => String(fullName || '').trim().split(/\s+/)[0] || '';

export function isValidYear(value) {
  const year = Number(value);
  const now = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1917 && year <= now + 1;
}
