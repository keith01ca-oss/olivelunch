import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendOrderConfirmationEmail(email: string, name: string, totalAmount: number) {
  try {
    await resend.emails.send({
      from: 'Olive Lunch <orders@olivelunch.com>',
      to: email,
      subject: 'Olive Lunch - Order Confirmation',
      html: `<p>Hi ${name},</p><p>Thank you for your order! Your total was $${totalAmount.toFixed(2)}.</p>`
    });
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
  }
}

export async function sendVipActivationEmail(email: string, name: string, prorationCredit: number) {
  try {
    const creditMsg = prorationCredit > 0 
      ? `<p>Since you joined after September, we have added a one-time <strong>$${prorationCredit.toFixed(2)} credit</strong> to your account for the missed months!</p>` 
      : '';

    await resend.emails.send({
      from: 'Olive Lunch <vip@olivelunch.com>',
      to: email,
      subject: 'Welcome to Olive Lunch VIP!',
      html: `<p>Hi ${name},</p><p>Your VIP subscription is active! You now get discounted pricing on all meals.</p>${creditMsg}`
    });
  } catch (error) {
    console.error('Failed to send VIP activation email:', error);
  }
}

export async function sendVipCancellationEmail(email: string, name: string) {
  try {
    await resend.emails.send({
      from: 'Olive Lunch <vip@olivelunch.com>',
      to: email,
      subject: 'Olive Lunch VIP Cancelled',
      html: `<p>Hi ${name},</p><p>Your VIP subscription has been successfully cancelled. You will return to regular pricing.</p>`
    });
  } catch (error) {
    console.error('Failed to send VIP cancellation email:', error);
  }
}
export async function sendReferralRewardEmail(email: string, name: string, referredName: string) {
  try {
    const res = await resend.emails.send({
      from: 'Olive Lunch <hello@olivelunch.com>',
      to: email,
      subject: 'You earned a $5 store credit! 🥳',
      html: `<p>Hi ${name},</p><p>Great news! <strong>${referredName}</strong> just joined VIP using your referral link.</p><p>We have added a <strong>$5.00 store credit</strong> to your account, which will be automatically applied to your next checkout.</p><p>Thank you for spreading the word about Olive Lunch!</p>`
    });
    if (res.error) throw new Error(res.error.message);
  } catch (error) {
    console.error('Failed to send referral reward email:', error);
  }
}
