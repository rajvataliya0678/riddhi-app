/**
 * logCrmCall — Auto-logs a call entry into crm_enquiries Firestore document.
 * Usage: await logCrmCall(db, enquiryId, enquiryData);
 */
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function logCrmCall(db, enquiryId, enquiryData = {}) {
  if (!enquiryId) return null;
  try {
    let existingLogs = enquiryData.callLogs || [];
    try {
      const snap = await getDoc(doc(db, 'crm_enquiries', enquiryId));
      if (snap.exists()) existingLogs = snap.data().callLogs || [];
    } catch (_) {}

    const currentStatus = enquiryData.status || 'New Lead';
    const isNewLead = currentStatus === 'New Lead' || currentStatus === 'New';

    const newEntry = {
      id: `call-${Date.now()}`,
      callType: isNewLead ? 'Invitation' : 'Follow-up',
      statusAtCall: currentStatus,
      outcome: '📞 Called',
      notes: '',
      calledAt: new Date().toISOString(),
    };

    const updatedLogs = [newEntry, ...existingLogs];
    await updateDoc(doc(db, 'crm_enquiries', enquiryId), { callLogs: updatedLogs });
    return newEntry;
  } catch (err) {
    console.error('[logCrmCall] Failed:', err);
    return null;
  }
}
