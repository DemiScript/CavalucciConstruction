import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { contactSchema } from '../validators/contactSchema.js';
import { sendMail } from '../services/mailer.js';
import { verifyTurnstile } from '../services/turnstile.js';

const router = Router();

// Limit each IP to a handful of submissions per window. Tunable via env while
// we watch legitimate traffic. The in-memory store is fine on a single Render
// instance; use a shared store if the service ever scales out.
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.CONTACT_RATE_MAX) || 5,
  message: {
    success: false,
    message: 'Too many submissions. Please try again later.',
  },
});

// Log rejections without retaining personal information: only the reason, the
// names of failing fields, the IP and a timestamp — never submitted values.
function logRejection(req, reason, fields = []) {
  console.warn(
    JSON.stringify({
      event: 'contact_rejected',
      reason,
      fields,
      ip: req.ip,
      ts: new Date().toISOString(),
    })
  );
}

router.post('/', contactLimiter, async (req, res, next) => {
  try {
    // 1. Structure + field validation (unknown fields are rejected).
    const { error, value } = contactSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      logRejection(req, 'validation', [
        ...new Set(error.details.map((detail) => detail.path.join('.'))),
      ]);
      return res.status(400).json({
        success: false,
        message: error.details.map((detail) => detail.message).join('; '),
      });
    }

    // 2. Honeypot — inspected here, never trusted from a client-side flag.
    const { _honey: honey, turnstileToken, ...fields } = value;
    if (honey) {
      logRejection(req, 'honeypot');
      return res.status(400).json({
        success: false,
        message: "We couldn't process your submission.",
      });
    }

    // 3. Bot check — Cloudflare must confirm the token before we send anything.
    if (!(await verifyTurnstile(turnstileToken, req.ip))) {
      logRejection(req, 'turnstile');
      return res.status(400).json({
        success: false,
        message: 'Verification failed. Please refresh the page and try again.',
      });
    }

    // 4. Only fully validated requests reach Resend.
    await sendMail(fields);

    return res.status(200).json({
      success: true,
      message: 'Your message has been sent.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
