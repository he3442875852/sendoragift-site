"use strict";

// Used by both the submission API and its public form configuration.
const MAX_BODY_BYTES = Math.min(Number(process.env.QUOTE_FORM_MAX_BODY_BYTES || 4 * 1024 * 1024), 4 * 1024 * 1024);
const MAX_ATTACHMENT_BYTES = Math.min(Number(process.env.QUOTE_FORM_MAX_ATTACHMENT_BYTES || MAX_BODY_BYTES), MAX_BODY_BYTES);

module.exports = { MAX_BODY_BYTES, MAX_ATTACHMENT_BYTES };
