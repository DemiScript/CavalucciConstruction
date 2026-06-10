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

// Escape user-supplied values before interpolating them into the HTML body.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendMail(fields) {
  const { name, phone, email, address, projectDetails } = fields;
  const { line1, line2, city, state, zip } = address;

  // Drop empty line2 so it doesn't render as a blank address line.
  const addressLines = [line1, line2, `${city}, ${state} ${zip}`].filter(Boolean);

  const text = [
    `From:    ${name} <${email}>`,
    `Phone:   ${phone}`,
    '',
    'Address:',
    ...addressLines.map((line) => `  ${line}`),
    '',
    'Project Details:',
    projectDetails,
  ].join('\n');

  const html = `
    <table style="font-family: Arial, sans-serif; font-size: 14px; border-collapse: collapse;">
      <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">From</td><td>${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Phone</td><td>${escapeHtml(phone)}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; font-weight: bold; vertical-align: top;">Address</td><td>${addressLines.map(escapeHtml).join('<br>')}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; font-weight: bold; vertical-align: top;">Project Details</td><td><pre style="margin: 0; font-family: inherit; white-space: pre-wrap;">${escapeHtml(projectDetails)}</pre></td></tr>
    </table>
  `.trim();

  const { data, error } = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: process.env.RECIPIENT_EMAIL,
    replyTo: email,
    subject: `New Contact Form Submission from ${name}`,
    text,
    html,
  });

  // The Resend SDK returns errors in the response object rather than throwing;
  // surface them so the route's error handler responds with a 500.
  if (error) {
    throw new Error(error.message || 'Resend failed to send the email.');
  }

  return data;
}

export default sendMail;
