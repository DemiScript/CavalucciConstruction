import { Resend } from 'resend';

// Resend sends over HTTPS (port 443), so it works on hosts that block outbound
// SMTP — including Render's free tier. The API key comes from the environment.
const apiKey = process.env.RESEND_API_KEY;

if (apiKey) {
  console.log('Resend email client initialized.');
} else {
  // Don't crash the whole server (and its health check) over a missing key —
  // boot with a placeholder so sends fail cleanly with a 500 instead.
  console.error(
    'RESEND_API_KEY is not set — email sending will fail until it is configured.'
  );
}

const resend = new Resend(apiKey || 'missing-api-key');

// Brand palette (mirrors styles/global.css).
const MAROON = '#550000';
const DARK = '#2C2C2C';
const LIGHT = '#E9E8E8';
const LOGO_URL = 'https://cavalucci.com/images/logo.png';

// Escape user-supplied values before interpolating them into the HTML body.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Assemble the printable address lines, dropping an empty line2.
function buildAddressLines({ line1, line2, city, state, zip }) {
  return [line1, line2, `${city}, ${state} ${zip}`].filter(Boolean);
}

// Branded, table-based email shell. Email clients ignore <style>/external CSS
// and web fonts, so everything is inline and uses Arial/Helvetica fallbacks.
// The logo sits on a white header (it's a dark logo) with a maroon accent rule;
// if a client blocks remote images, the alt text renders instead.
function emailShell({ preheader = '', bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4;">
  <span style="display:none; font-size:1px; color:#f4f4f4; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden; font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="background-color:#ffffff; padding:28px 32px 22px; text-align:center; border-bottom:4px solid ${MAROON};">
              <img src="${LOGO_URL}" alt="Cavalucci Construction" width="200" style="display:block; margin:0 auto; max-width:200px; height:auto;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${DARK}; padding:20px 32px; text-align:center;">
              <p style="margin:0; color:${LIGHT}; font-size:12px; line-height:1.6;">
                Cavalucci Construction &middot; PO Box 306, Park Ridge, NJ 07656<br>
                Office: 201-391-3772 &middot; <a href="https://cavalucci.com" style="color:${LIGHT};">cavalucci.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Small uppercase section label used in the notification body.
function sectionLabel(text) {
  return `<p style="margin:0 0 6px; font-weight:bold; color:${MAROON}; text-transform:uppercase; letter-spacing:0.05em; font-size:13px;">${text}</p>`;
}

// Send via Resend and surface API errors as thrown errors (the SDK returns
// errors in the response rather than throwing).
async function send(message) {
  const { data, error } = await resend.emails.send(message);
  if (error) {
    throw new Error(error.message || 'Resend failed to send the email.');
  }
  return data;
}

// Notification to the business. Follows the requested template; the visitor's
// email is shown and wired as replyTo so "Reply" reaches the sender.
function sendNotification(fields) {
  const { name, phone, email, address, projectDetails } = fields;
  const addressLines = buildAddressLines(address);

  const text = [
    'You have received a new contact form submission.',
    '',
    'From:',
    name,
    email,
    phone,
    ...addressLines,
    '',
    `Inquiry: ${projectDetails}`,
    '',
    'Reply to this message to get in contact with sender!',
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 24px; font-size:16px; color:${DARK};">You have received a new contact form submission.</p>
    ${sectionLabel('From')}
    <p style="margin:0 0 24px; font-size:15px; color:${DARK}; line-height:1.7;">
      ${escapeHtml(name)}<br>
      <a href="mailto:${escapeHtml(email)}" style="color:${MAROON};">${escapeHtml(email)}</a><br>
      ${escapeHtml(phone)}<br>
      ${addressLines.map(escapeHtml).join('<br>')}
    </p>
    ${sectionLabel('Inquiry')}
    <p style="margin:0 0 28px; font-size:15px; color:${DARK}; line-height:1.7; white-space:pre-wrap;">${escapeHtml(projectDetails)}</p>
    <div style="border-top:1px solid ${LIGHT}; padding-top:18px;">
      <p style="margin:0; font-size:14px; color:${DARK};">Reply to this message to get in contact with sender!</p>
    </div>
  `.trim();

  return send({
    from: process.env.FROM_EMAIL,
    to: process.env.RECIPIENT_EMAIL,
    replyTo: email,
    subject: 'New Message for Cavalucci.com',
    text,
    html: emailShell({ preheader: `New inquiry from ${name}`, bodyHtml }),
  });
}

// Auto-confirmation to the visitor, from the no-reply address. Replies route
// back to the business via replyTo.
function sendConfirmation(fields) {
  const { name, email, projectDetails } = fields;

  const text = [
    `Hi ${name},`,
    '',
    "Thank you for reaching out to Cavalucci Construction. We've received your message and a member of our team will be in touch shortly.",
    '',
    "Here's a copy of what you submitted:",
    projectDetails,
    '',
    'If you need to reach us sooner, call 201-391-3772.',
    '',
    '— The Cavalucci Construction Team',
  ].join('\n');

  const bodyHtml = `
    <h1 style="margin:0 0 18px; font-size:22px; color:${MAROON};">Thank you, ${escapeHtml(name)}!</h1>
    <p style="margin:0 0 18px; font-size:16px; color:${DARK}; line-height:1.7;">
      Thank you for reaching out to Cavalucci Construction. We&rsquo;ve received your message and a
      member of our team will be in touch shortly.
    </p>
    <p style="margin:0 0 10px; font-size:15px; color:${DARK};">Here&rsquo;s a copy of what you submitted:</p>
    <div style="background-color:#f7f7f7; border-left:4px solid ${MAROON}; padding:16px 18px; margin:0 0 24px;">
      <p style="margin:0; font-size:15px; color:${DARK}; line-height:1.7; white-space:pre-wrap;">${escapeHtml(projectDetails)}</p>
    </div>
    <p style="margin:0 0 24px; font-size:15px; color:${DARK}; line-height:1.7;">
      If you need to reach us sooner, call <a href="tel:+12013913772" style="color:${MAROON};">201-391-3772</a>.
    </p>
    <p style="margin:0; font-size:15px; color:${DARK};">&mdash; The Cavalucci Construction Team</p>
  `.trim();

  return send({
    from: process.env.CONFIRMATION_FROM_EMAIL,
    to: email,
    replyTo: process.env.RECIPIENT_EMAIL,
    subject: 'Thank you for contacting Cavalucci Construction',
    text,
    html: emailShell({ preheader: "We've received your message.", bodyHtml }),
  });
}

export async function sendMail(fields) {
  // The notification to the business is the critical send. If it fails, throw
  // so the route returns 500 and the visitor sees an error.
  const notification = await sendNotification(fields);

  // The visitor confirmation is best-effort: a failure here must not fail the
  // request or hide a successfully captured lead.
  try {
    await sendConfirmation(fields);
  } catch (err) {
    console.error(
      'Confirmation email to visitor failed (notification was still sent):',
      err.message
    );
  }

  return notification;
}

export default sendMail;
