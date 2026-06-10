import Joi from 'joi';

// Validation + sanitization schema for the contact form payload.
// `stripUnknown` silently drops any field not declared here.
export const contactSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),

  phone: Joi.string()
    .trim()
    .pattern(/^[0-9\s\-\+\(\)]{7,20}$/)
    .required()
    .messages({
      'string.pattern.base':
        'Phone must be 7–20 characters and may contain digits, spaces, dashes, plus signs, or parentheses.',
    }),

  email: Joi.string().trim().lowercase().email().required(),

  address: Joi.object({
    line1: Joi.string().trim().min(1).max(100).required(),
    line2: Joi.string().trim().max(100).allow('').optional(),
    city: Joi.string().trim().min(1).max(100).required(),
    state: Joi.string().trim().min(2).max(50).required(),
    zip: Joi.string()
      .trim()
      .pattern(/^\d{5}(-\d{4})?$/)
      .required()
      .messages({
        'string.pattern.base': 'ZIP must be in the format 12345 or 12345-6789.',
      }),
  }).required(),

  projectDetails: Joi.string().trim().min(10).max(2000).required(),
}).options({ stripUnknown: true });

export default contactSchema;
