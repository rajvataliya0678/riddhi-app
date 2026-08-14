/**
 * openWhatsAppChat(phone, message)
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens WhatsApp chat for a given phone number.
 * Triggers native Android App Chooser (WhatsApp vs WhatsApp Business selection)
 * when both apps are installed on the user's mobile device.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function openWhatsAppChat(rawPhone, message = '') {
  if (!rawPhone) return;

  const cleaned = String(rawPhone).replace(/\D/g, '');
  if (!cleaned) return;

  const formattedPhone = cleaned.startsWith('91') && cleaned.length === 12
    ? cleaned
    : cleaned.length === 10
      ? `91${cleaned}`
      : cleaned;

  const encodedMsg = message ? `&text=${encodeURIComponent(message)}` : '';
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // whatsapp:// scheme triggers Android OS App Selector (WhatsApp vs WhatsApp Business)
    const schemeUrl = `whatsapp://send?phone=${formattedPhone}${encodedMsg}`;
    window.location.href = schemeUrl;

    // Fallback timer if app scheme fails after 1200ms
    setTimeout(() => {
      window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}${encodedMsg}`, '_blank');
    }, 1200);
  } else {
    // Desktop Browser fallback
    window.open(`https://web.whatsapp.com/send?phone=${formattedPhone}${encodedMsg}`, '_blank');
  }
}
