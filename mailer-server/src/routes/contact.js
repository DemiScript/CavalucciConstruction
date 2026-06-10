import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { contactSchema } from '../validators/contactSchema.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

// Limit each IP to 10 contact submissions per 15-minute window.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

router.post('/', contactLimiter, async (req, res, next) => {
  try {
    const { error, value } = contactSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((detail) => detail.message).join('; '),
      });
    }

    await sendMail(value);

    return res.status(200).json({
      success: true,
      message: 'Your message has been sent.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
