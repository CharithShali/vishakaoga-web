// Same wording as server/src/utils/feeReminder.js, for the WhatsApp message.
export function feeReminderText(firstName, year, branchName) {
  const who = firstName ? `Dear ${firstName}, ` : '';
  const where = branchName ? `your ${branchName} branch treasurer` : 'your branch treasurer';
  return (
    `${who}we haven't recorded your Vishaka OGA membership fee for ${year} yet. ` +
    `Please pay ${where} by cash or bank transfer. ` +
    `If you have already paid, please let the treasurer know so it can be recorded. Thank you!`
  );
}

export const firstNameOf = (fullName) => String(fullName || '').trim().split(/\s+/)[0] || '';

/**
 * A wa.me link that opens WhatsApp with the message typed in, or null if the
 * phone number can't be used. Sri Lankan numbers like 0771234567 become 94771234567.
 */
export function whatsappLink(phone, text) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2); // 0094...
  if (digits.length === 10 && digits.startsWith('0')) digits = `94${digits.slice(1)}`;
  else if (digits.length === 9 && digits.startsWith('7')) digits = `94${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
