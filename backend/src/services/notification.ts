import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

interface StreamNotificationData {
  streamId: string;
  senderName: string;
  amount: string;
  duration: string;
  message?: string;
  claimUrl: string;
}

export async function sendStreamCreatedEmail(
  recipientEmail: string,
  data: StreamNotificationData
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: 'StreamGift <notifications@streamgift.xyz>',
      to: recipientEmail,
      subject: `${data.senderName} is streaming you money!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .amount { font-size: 48px; font-weight: bold; color: #7C3AED; text-align: center; }
              .details { background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 20px 0; }
              .button { display: inline-block; background: #7C3AED; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
              .button-container { text-align: center; margin: 30px 0; }
              .message { background: #FEF3C7; border-radius: 8px; padding: 16px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>You've received a StreamGift!</h1>
              </div>
              
              <div class="amount">${data.amount} MOVE</div>
              
              <div class="details">
                <p><strong>From:</strong> ${data.senderName}</p>
                <p><strong>Duration:</strong> ${data.duration}</p>
                <p>Your balance grows every second. Claim anytime!</p>
              </div>
              
              ${data.message ? `
              <div class="message">
                <p><strong>Message:</strong></p>
                <p>${data.message}</p>
              </div>
              ` : ''}
              
              <div class="button-container">
                <a href="${data.claimUrl}" class="button">Claim Your StreamGift</a>
              </div>
              
              <p style="color: #6B7280; font-size: 14px; text-align: center;">
                No wallet needed. Sign in with your email to claim.
              </p>
            </div>
          </body>
        </html>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendClaimConfirmationEmail(
  recipientEmail: string,
  amountClaimed: string,
  remainingAmount: string,
  streamUrl: string
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: 'StreamGift <notifications@streamgift.xyz>',
      to: recipientEmail,
      subject: `You claimed ${amountClaimed} MOVE!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .success { color: #059669; font-size: 24px; text-align: center; }
              .amount { font-size: 36px; font-weight: bold; color: #7C3AED; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <p class="success">Claim Successful!</p>
              <p class="amount">${amountClaimed} MOVE</p>
              <p style="text-align: center;">
                ${parseFloat(remainingAmount) > 0 
                  ? `You still have ${remainingAmount} MOVE streaming. Come back later to claim more!`
                  : 'Your stream is complete. Thanks for using StreamGift!'}
              </p>
              <p style="text-align: center;">
                <a href="${streamUrl}">View Stream Details</a>
              </p>
            </div>
          </body>
        </html>
      `,
    });
    return true;
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    return false;
  }
}