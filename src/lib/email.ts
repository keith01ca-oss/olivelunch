import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendOrderConfirmationEmail(email: string, name: string, orderIds: string[]) {
  try {
    if (!orderIds || orderIds.length === 0) return;

    // Fetch orders with children and items
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_date, total_amount, credit_used, gross_amount,
        children ( name ),
        order_items (
          quantity, unit_price, total_price, is_large,
          dishes ( name, large_name )
        )
      `)
      .in('id', orderIds)
      .order('order_date', { ascending: true });

    if (!orders || orders.length === 0) return;

    const totalCharged = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const totalCredit = orders.reduce((sum, o) => sum + Number(o.credit_used || 0), 0);
    const totalGross = orders.reduce((sum, o) => sum + Number(o.gross_amount || 0), 0);
    const totalItems = orders.reduce((sum, o) => sum + o.order_items.length, 0);
    const totalDays = new Set(orders.map(o => o.order_date)).size;

    let itemsHtml = '';
    
    for (const order of orders) {
      const childName = (order.children as any)?.name || 'Child';
      // Use parseISO or ensure it's a valid date string. The dates are usually 'YYYY-MM-DD'
      const orderDate = new Date(order.order_date + 'T00:00:00'); // append time to avoid timezone shift
      const formattedDate = format(orderDate, 'EEEE, MMM d, yyyy');
      
      itemsHtml += `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a;">${childName} - ${formattedDate}</h4>
          <table style="width: 100%; border-collapse: collapse;">
      `;

      for (const item of order.order_items) {
        const dish = (item.dishes as any);
        const dishName = item.is_large && dish?.large_name ? dish.large_name : dish?.name;
        itemsHtml += `
            <tr>
              <td style="padding: 5px 0; color: #334155;">${item.quantity}x ${dishName}</td>
              <td style="padding: 5px 0; text-align: right; color: #334155;">$${Number(item.total_price).toFixed(2)}</td>
            </tr>
        `;
      }
      itemsHtml += `</table></div>`;
    }

    const summaryHtml = `
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px;">
        <h3 style="margin-top: 0; color: #0f172a;">Order Summary</h3>
        <p style="margin: 5px 0;">Total Days: ${totalDays}</p>
        <p style="margin: 5px 0;">Total Items: ${totalItems}</p>
        <p style="margin: 5px 0;">Subtotal: $${totalGross.toFixed(2)}</p>
        ${totalCredit > 0 ? `<p style="margin: 5px 0; color: #16a34a;">Store Credit Applied: -$${totalCredit.toFixed(2)}</p>` : ''}
        <h3 style="margin-top: 15px; margin-bottom: 0;">Final Total Paid: $${totalCharged.toFixed(2)}</h3>
      </div>
    `;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #0f172a;">Hi ${name},</h2>
        <p style="margin-bottom: 20px;">Thank you for your order! Here is a summary of what you purchased:</p>
        ${itemsHtml}
        ${summaryHtml}
        <p style="margin-top: 30px; font-size: 14px; color: #64748b;">If you need to make changes, please visit your <a href="https://app.olivelunch.com/dashboard" style="color: #4f46e5;">dashboard</a>.</p>
      </div>
    `;

    await resend.emails.send({
      from: 'Olive Lunch <orders@olivelunch.com>',
      to: email,
      subject: 'Olive Lunch - Order Confirmation',
      html
    });
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
  }
}

export async function sendAdminCancellationEmail(email: string, name: string, date: string, dishName: string, quantity: number, refundAmount: number) {
  try {
    const orderDate = new Date(date + 'T00:00:00');
    const formattedDate = format(orderDate, 'EEEE, MMM d, yyyy');
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #0f172a;">Hi ${name},</h2>
        <p>We are writing to let you know that one of your ordered items has been cancelled by our administration (e.g. due to being out of stock).</p>
        
        <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #f59e0b; background: #fffbeb; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${formattedDate}</p>
          <p style="margin: 0 0 10px 0;"><strong>Item:</strong> ${quantity}x ${dishName}</p>
          <p style="margin: 0; color: #16a34a;"><strong>Refunded:</strong> $${refundAmount.toFixed(2)} Store Credit</p>
        </div>

        <p>The refund amount has been automatically added to your store credit balance, which will be applied to your next checkout.</p>
        <p>You can use this credit to order an alternative meal for that month by visiting the menu:</p>
        <p style="margin-top: 25px;"><a href="https://app.olivelunch.com/menu" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Order Another Meal</a></p>
        <br>
        <p style="margin-top: 30px; font-size: 14px; color: #64748b;">We apologize for any inconvenience!</p>
      </div>
    `;

    await resend.emails.send({
      from: 'Olive Lunch <orders@olivelunch.com>',
      to: email,
      subject: 'Olive Lunch - Order Item Cancelled',
      html
    });
  } catch (error) {
    console.error('Failed to send admin cancellation email:', error);
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
