import { env } from '../config/env.js';

/**
 * Send notification email when a stream is created
 */
export async function sendStreamNotificationEmail(
  recipientEmail: string,
  amount: string,
  claimUrl: string
): Promise<void> {
  // In production, implement with SendGrid, Resend, or similar
  console.log(`[EMAIL] Stream notification to ${recipientEmail}`);
  console.log(`  Amount: ${amount} MOVE`);
  console.log(`  Claim URL: ${claimUrl}`);
  
  // Stub implementation
  if (!env.SENDGRID_API_KEY) {
    console.log('  (Email not sent - SENDGRID_API_KEY not configured)');
    return;
  }

  // TODO: Implement actual email sending
  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: recipientEmail,
  //   from: env.EMAIL_FROM,
  //   subject: 'You received a StreamGift! 🎁',
  //   html: `
  //     <h1>Someone sent you a token stream!</h1>
  //     <p>You're receiving ${amount} MOVE tokens over time.</p>
  //     <a href="${claimUrl}">Claim your tokens</a>
  //   `
  // });
}

/**
 * Send confirmation email after claiming
 */
export async function sendClaimConfirmationEmail(
  recipientEmail: string,
  claimedAmount: string,
  remainingAmount: string,
  streamUrl: string
): Promise<void> {
  console.log(`[EMAIL] Claim confirmation to ${recipientEmail}`);
  console.log(`  Claimed: ${claimedAmount} MOVE`);
  console.log(`  Remaining: ${remainingAmount} MOVE`);
  console.log(`  Stream URL: ${streamUrl}`);

  if (!env.SENDGRID_API_KEY) {
    console.log('  (Email not sent - SENDGRID_API_KEY not configured)');
    return;
  }

  // TODO: Implement actual email sending
}




