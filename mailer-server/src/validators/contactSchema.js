import Joi from 'joi';
import {
  ALLOWED_STATES,
  isPlausibleCity,
  isPlausibleName,
  isPlausibleStreet,
  normalizePhone,
  zipMatchesState,
} from './plausibility.js';

// Build a `.custom()` rule that fails with a friendly message.
const check = (predicate, message) => (value, helpers) =>
  predicate(value) ? value : helpers.message(message);

// Validation + sanitization schema for the contact form payload.
// Unknown fields are rejected (not stripped) so malformed requests fail loudly.
export const contactSchema = Joi.object({
  name: Joi.string()
    .trim()
    .max(100)
    .required()
    .custom(check(isPlausibleName, 'Please enter your first and last name.')),

  phone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      const normalized = normalizePhone(value);
      return normalized ?? helpers.message('Please enter a valid 10-digit phone number.');
    }),

  email: Joi.string().trim().lowercase().max(254).email().required(),

  address: Joi.object({
    line1: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .custom(check(isPlausibleStreet, 'Please enter a valid street address (e.g. 123 Main St).')),
    line2: Joi.string().trim().max(100).allow('').optional(),
    city: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .custom(check(isPlausibleCity, 'Please enter a valid city or town.')),
    state: Joi.string()
      .trim()
      .uppercase()
      .valid(...ALLOWED_STATES)
      .required()
      .messages({
        'any.only': `State must be one of: ${ALLOWED_STATES.join(', ')}.`,
      }),
    zip: Joi.string()
      .trim()
      .pattern(/^\d{5}(-\d{4})?$/)
      .required()
      .messages({
        'string.pattern.base': 'ZIP must be in the format 12345 or 12345-6789.',
      }),
  })
    .required()
    .custom((address, helpers) =>
      typeof address.zip !== 'string' || zipMatchesState(address.zip, address.state)
        ? address
        : helpers.message('ZIP code does not match the selected state.')
    ),

  projectDetails: Joi.string()
    .trim()
    .min(10)
    .max(2000)
    .required()
    .custom((value, helpers) => {
      const urlCount = (value.match(/https?:\/\/|www\./gi) || []).length;
      if (urlCount > 2 || /(.)\1{9,}/.test(value)) {
        return helpers.message('Please describe your project without links or repeated characters.');
      }
      return value;
    }),

  // Honeypot: must be empty. Declared so it passes schema validation and the
  // route can inspect it itself.
  _honey: Joi.string().allow('').max(200).optional(),

  // Cloudflare Turnstile token; verified server-side in the route, then dropped.
  turnstileToken: Joi.string().allow('').max(2048).optional(),
}).options({ stripUnknown: false });

export default contactSchema;
