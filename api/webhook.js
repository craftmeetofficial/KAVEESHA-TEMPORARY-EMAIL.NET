const { getDb } = require('../lib/firebase');
const { verifyMailgunSignature } = require('../lib/email');
const { sanitizeHtml, extractOTP } = require('../lib/sanitize');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    // Mailgun sends form-urlencoded or multipart
    const body = req.body;

    // Signature verification (required for production)
    const timestamp = body.timestamp;
    const token = body.token;
    const signature = body.signature;

    if (process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
      if (!verifyMailgunSignature(timestamp, token, signature)) {
        console.warn('Invalid Mailgun signature');
        return res.status(403).send('Forbidden');
      }
    }

    const recipient = (body.recipient || body.To || '').toLowerCase();
    const localPart = recipient.split('@')[0];
    if (!localPart) {
      return res.status(200).send('OK'); // Accept but ignore
    }

    const db = getDb();
    const inboxRef = db.collection('inboxes').doc(localPart);
    const inboxSnap = await inboxRef.get();

    if (!inboxSnap.exists) {
      // Unknown address – still accept to avoid bounce loops if catch-all
      return res.status(200).send('OK');
    }

    const inbox = inboxSnap.data();
    if (Date.now() > inbox.expiresAt) {
      return res.status(200).send('OK');
    }

    const from = body.from || body.From || 'unknown';
    const subject = body.subject || body.Subject || '(no subject)';
    const text = body['body-plain'] || body.text || '';
    const html = body['body-html'] || body.html || '';
    const preview = (text || html.replace(/<[^>]+>/g, ' ')).substring(0, 180).trim();
    const otp = extractOTP(text + ' ' + subject);

    const messageRef = inboxRef.collection('messages').doc();
    await messageRef.set({
      from,
      to: recipient,
      subject,
      text,
      html: sanitizeHtml(html),
      preview,
      otp,
      receivedAt: Date.now(),
      rawHeaders: body['message-headers'] || null
    });

    await inboxRef.update({
      messageCount: (inbox.messageCount || 0) + 1,
      lastMessageAt: Date.now()
    });

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    // Always return 200 to Mailgun to avoid retries on our bugs
    res.status(200).send('OK');
  }
};