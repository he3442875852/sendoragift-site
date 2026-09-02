# Resend Setup

## Resend

1. Log in to Resend.
2. Add and verify the domain `sendoragift.com`.
3. Add the SPF, DKIM, and any other DNS records shown in the Resend dashboard to Cloudflare DNS.
4. Use the exact DNS values displayed by Resend. Do not guess or reuse placeholder values.
5. Create a Resend API key.

Codex cannot create the Resend API key, and DNS record values must come from the live Resend dashboard.

## Vercel Environment Variables

Add these variables to the Vercel project:

```text
RESEND_API_KEY=fill in the Resend API key in Vercel
INQUIRY_TO_EMAIL=mcpatch@188.com
INQUIRY_FROM_EMAIL=inquiry@sendoragift.com
```

Apply the variables to Production. Applying them to Preview is also recommended so test deployments can send mail through the same code path.

Do not commit API keys, mailbox passwords, or other secrets to GitHub.

## Deployment And Testing

1. Save the Vercel environment variables.
2. Redeploy the Vercel project.
3. Wait for Resend domain verification to succeed before testing production email delivery.
4. Submit one inquiry without an attachment.
5. Submit one inquiry with a PNG or PDF attachment.
6. Check the inbox and spam folder for `mcpatch@188.com`.
7. Confirm the Reply button replies to the customer email address from the form.
8. After Resend is confirmed working, remove the old legacy forwarding URL variable from Vercel.

`inquiry@sendoragift.com` is used as the verified sender address. It does not necessarily need to exist as a real receiving mailbox, depending on Resend domain verification rules. The actual inquiry recipient is `mcpatch@188.com`.
