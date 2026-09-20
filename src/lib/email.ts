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

/**
 * Resolves notification email and whatsapp settings from the organization
 */
export async function getAdminNotificationConfig(orgId?: string) {
  try {
    let targetOrgId = orgId;
    const defaultAdminEmail = 'olivelunch.com@gmail.com, keith01.ca@gmail.com';
    if (!targetOrgId) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, settings')
        .in('slug', ['olive-lunch', 'olivelunch'])
        .limit(1)
        .maybeSingle();
      if (org) {
        return {
          orgId: org.id,
          email: org.settings?.order_notification_email || defaultAdminEmail,
          whatsapp: org.settings?.order_notification_whatsapp || ''
        };
      }

      const { data: anyOrg } = await supabaseAdmin
        .from('organizations')
        .select('id, settings')
        .limit(1)
        .single();
      if (anyOrg) {
        return {
          orgId: anyOrg.id,
          email: anyOrg.settings?.order_notification_email || defaultAdminEmail,
          whatsapp: anyOrg.settings?.order_notification_whatsapp || ''
        };
      }

      return {
        orgId: null,
        email: defaultAdminEmail,
        whatsapp: ''
      };
    }

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, settings')
      .eq('id', targetOrgId)
      .single();

    return {
      orgId: targetOrgId,
      email: org?.settings?.order_notification_email || defaultAdminEmail,
      whatsapp: org?.settings?.order_notification_whatsapp || ''
    };
  } catch (e) {
    console.warn('Failed to load admin notification config, using defaults:', e);
    return {
      orgId: null,
      email: 'olivelunch.com@gmail.com, keith01.ca@gmail.com',
      whatsapp: ''
    };
  }
}

/**
 * Sends an instant email notification to the admin when a new order is placed
 */
export async function sendAdminNewOrderNotification(orderIds: string[], orgId?: string) {
  try {
    if (!orderIds || orderIds.length === 0) return;

    // Fetch order details including parent and items
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_date, total_amount, credit_used, gross_amount, status, created_at, org_id,
        parents ( id, name, email, phone ),
        children (
          name, division, delivery_location,
          schools ( name )
        ),
        order_items (
          quantity, unit_price, total_price, is_large,
          dishes ( name, large_name )
        )
      `)
      .in('id', orderIds)
      .order('order_date', { ascending: true });

    if (error || !orders || orders.length === 0) {
      console.warn('sendAdminNewOrderNotification: No orders found for IDs', orderIds);
      return;
    }

    const firstOrder = orders[0];
    const parent = (firstOrder.parents as any);
    const parentName = parent?.name || 'Customer';
    const parentEmail = parent?.email || 'N/A';
    const parentPhone = parent?.phone || '';
    const cleanPhone = parentPhone.replace(/[^0-9]/g, '');
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

    const resolvedOrgId = orgId || firstOrder.org_id;
    const config = await getAdminNotificationConfig(resolvedOrgId);

    const totalCharged = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const totalCredit = orders.reduce((sum, o) => sum + Number(o.credit_used || 0), 0);
    const totalGross = orders.reduce((sum, o) => sum + Number(o.gross_amount || 0), 0);

    let itemsHtml = '';
    for (const order of orders) {
      const child = (order.children as any);
      const childName = child?.name || 'Student';
      const division = child?.division || '';
      const schoolName = child?.schools?.name || '';
      const orderDate = new Date(order.order_date + 'T00:00:00');
      const formattedDate = format(orderDate, 'EEEE, MMM d, yyyy');

      itemsHtml += `
        <div style="margin-bottom: 16px; padding: 12px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-weight: bold; color: #0f172a; margin-bottom: 4px;">
            ${childName} ${division ? `(Div: ${division})` : ''} - ${schoolName}
          </div>
          <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Date: <strong>${formattedDate}</strong></div>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      `;

      for (const item of (order.order_items || [])) {
        const dish = (item.dishes as any);
        const dishName = item.is_large && dish?.large_name ? dish.large_name : dish?.name;
        itemsHtml += `
          <tr>
            <td style="padding: 4px 0; color: #334155;"><strong>${item.quantity}x</strong> ${dishName}</td>
            <td style="padding: 4px 0; text-align: right; color: #64748b;">$${Number(item.total_price || 0).toFixed(2)}</td>
          </tr>
        `;
      }

      itemsHtml += `</table></div>`;
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #f8fafc; padding: 24px; border-radius: 12px;">
        <div style="background: #15803d; color: white; padding: 14px 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: bold;">🔔 New Order Received</h2>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Total Amount: <strong>$${totalCharged.toFixed(2)}</strong></div>
        </div>

        <div style="background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
          <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Customer Details</h3>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Parent:</strong> ${parentName}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> <a href="mailto:${parentEmail}" style="color: #2563eb;">${parentEmail}</a></p>
          <p style="margin: 4px 0; font-size: 14px;">
            <strong>Phone:</strong> ${parentPhone || 'Not provided'}
            ${waLink ? ` &bull; <a href="${waLink}" style="display: inline-block; background: #25D366; color: white; padding: 2px 8px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: bold; margin-left: 6px;">WhatsApp Parent</a>` : ''}
          </p>
        </div>

        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Meals Ordered</h3>
        ${itemsHtml}

        <div style="background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 16px;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 3px 0; color: #64748b;">Subtotal:</td>
              <td style="padding: 3px 0; text-align: right; font-weight: bold;">$${totalGross.toFixed(2)}</td>
            </tr>
            ${totalCredit > 0 ? `
              <tr>
                <td style="padding: 3px 0; color: #16a34a;">Store Credit:</td>
                <td style="padding: 3px 0; text-align: right; color: #16a34a; font-weight: bold;">-$${totalCredit.toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 8px 0 0 0; font-weight: bold; font-size: 16px; color: #0f172a;">Total Paid:</td>
              <td style="padding: 8px 0 0 0; text-align: right; font-weight: bold; font-size: 16px; color: #15803d;">$${totalCharged.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
          Sent automatically to admin notification recipients &bull; Olive Lunch System
        </p>
      </div>
    `;

    const recipients: string[] = (config.email || 'olivelunch.com@gmail.com')
      .split(/[,;]/)
      .map((e: string) => e.trim())
      .filter(Boolean);

    await resend.emails.send({
      from: 'Olive Lunch <orders@olivelunch.com>',
      to: recipients.length > 0 ? recipients : ['olivelunch.com@gmail.com'],
      subject: `🔔 New Order Placed: ${parentName} ($${totalCharged.toFixed(2)})`,
      html
    });
  } catch (error) {
    console.error('Failed to send admin new order notification email:', error);
  }
}

/**
 * Calculates the target order date for the daily summary based on the kitchen schedule:
 * - 12:00 AM midnight = night right after 11:59 PM (e.g. Friday 12am = Thursday late night after 11:59pm entering Friday)
 * - Sunday 12am -> Tuesday orders (offset +2)
 * - Monday 12am -> Wednesday orders (offset +2)
 * - Tuesday 12am -> Thursday orders (offset +2)
 * - Wednesday 12am -> Friday orders (offset +2)
 * - Thursday 12am -> Skipped (no school meal on Saturday)
 * - Friday 12am -> Monday orders (offset +3)
 * - Saturday 12am -> Skipped (no school meal on Sunday)
 */
export function calculateSummaryTargetDate(now: Date = new Date()): { targetDateStr: string; skipped: boolean; reason?: string } {
  const vancouverDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }); // YYYY-MM-DD
  const vancouverTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour12: false }); // HH:MM:SS
  const [y, m, d] = vancouverDateStr.split('-').map(Number);
  const hour = parseInt(vancouverTimeStr.split(':')[0], 10);

  const localD = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = localD.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat

  let offsetDays = 0;
  let skip = false;

  // At midnight cron execution (hour < 12)
  if (hour < 12) {
    if (dayOfWeek === 0) offsetDays = 2; // Sun 12am (Sat night) -> Tue
    else if (dayOfWeek === 1) offsetDays = 2; // Mon 12am (Sun night) -> Wed
    else if (dayOfWeek === 2) offsetDays = 2; // Tue 12am (Mon night) -> Thu
    else if (dayOfWeek === 3) offsetDays = 2; // Wed 12am (Tue night) -> Fri
    else if (dayOfWeek === 4) skip = true;   // Thu 12am (Wed night) -> Skip (no Sat meals)
    else if (dayOfWeek === 5) offsetDays = 3; // Fri 12am (Thu night) -> Mon
    else if (dayOfWeek === 6) skip = true;   // Sat 12am (Fri night) -> Skip (no Sun meals)
  } else {
    // Afternoon / evening execution (e.g. testing from admin panel for upcoming midnight run)
    if (dayOfWeek === 0) offsetDays = 3; // Sun PM -> upcoming Mon 12am -> Wed
    else if (dayOfWeek === 1) offsetDays = 3; // Mon PM -> upcoming Tue 12am -> Thu
    else if (dayOfWeek === 2) offsetDays = 3; // Tue PM -> upcoming Wed 12am -> Fri
    else if (dayOfWeek === 3) skip = true;   // Wed PM -> upcoming Thu 12am -> Skip
    else if (dayOfWeek === 4) offsetDays = 4; // Thu PM -> upcoming Fri 12am -> Mon
    else if (dayOfWeek === 5) skip = true;   // Fri PM -> upcoming Sat 12am -> Skip
    else if (dayOfWeek === 6) offsetDays = 3; // Sat PM -> upcoming Sun 12am -> Tue
  }

  if (skip) {
    return {
      targetDateStr: vancouverDateStr,
      skipped: true,
      reason: 'No summary scheduled for this day (no school meals on weekends)'
    };
  }

  localD.setUTCDate(localD.getUTCDate() + offsetDays);
  return {
    targetDateStr: localD.toISOString().slice(0, 10),
    skipped: false
  };
}

/**
 * Sends a summary of meal quantities for target date.
 * Kitchen Schedule:
 * - Sunday 12am sends Tuesday
 * - Monday 12am sends Wednesday
 * - Tuesday 12am sends Thursday
 * - Wednesday 12am sends Friday
 * - Thursday 12am skipped
 * - Friday 12am sends Monday
 * - Saturday 12am skipped
 * Rules:
 * - Zero orders sends '[date] no order'
 * - Subject: e.g. "sept 23 order summary"
 * - Body: exact item quantities, e.g.:
 *     2 x chicken nugget
 *     1 x spring roll
 */
export async function sendDailyOrderSummaryEmail(options?: { targetDate?: string; orgId?: string; force?: boolean }) {
  try {
    const config = await getAdminNotificationConfig(options?.orgId);

    // Determine target date using schedule if not explicitly provided
    let targetDateStr = options?.targetDate;
    if (!targetDateStr) {
      const targetInfo = calculateSummaryTargetDate();
      if (targetInfo.skipped && !options?.force) {
        console.log(`Daily order summary: ${targetInfo.reason}. Skipping.`);
        return {
          success: true,
          skipped: true,
          targetDate: targetInfo.targetDateStr,
          reason: targetInfo.reason
        };
      }
      targetDateStr = targetInfo.targetDateStr;
    }

    // Check day of the week
    const [tY, tM, tD] = targetDateStr.split('-').map(Number);
    const targetD = new Date(Date.UTC(tY, tM - 1, tD));
    const dayOfWeek = targetD.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Rule: Mon-Fri orders only (weekend no need)
    if (isWeekend && !options?.force) {
      console.log(`Daily order summary: Target date ${targetDateStr} is weekend (day ${dayOfWeek}). Skipping summary.`);
      return {
        success: true,
        skipped: true,
        targetDate: targetDateStr,
        reason: `Target date ${targetDateStr} is a weekend (Mon-Fri only)`
      };
    }

    // Query paid orders for target date
    let query = supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_items (
          quantity,
          is_large,
          dishes ( name, large_name )
        )
      `)
      .eq('order_date', targetDateStr)
      .eq('status', 'paid');

    if (config.orgId) {
      query = query.eq('org_id', config.orgId);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    // Aggregate dish quantities
    const itemCounts: Record<string, number> = {};
    let totalItemsCount = 0;

    for (const order of orders || []) {
      for (const item of (order.order_items || [])) {
        const dish = (item.dishes as any);
        const dishName = item.is_large && dish?.large_name ? dish.large_name : (dish?.name || 'Unknown Item');
        const qty = Number(item.quantity) || 1;
        itemCounts[dishName] = (itemCounts[dishName] || 0) + qty;
        totalItemsCount += qty;
      }
    }

    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];
    const hasOrders = totalItemsCount > 0;
    const subject = hasOrders 
      ? `${monthNames[tM - 1]} ${tD} order summary` 
      : `${monthNames[tM - 1]} ${tD} no order`;

    // Format plain text lines:
    // e.g.:
    // 2 x chicken nugget
    // 1 x spring roll
    // or: "no order"
    const lines = hasOrders
      ? Object.entries(itemCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => `${count} x ${name}`)
      : ['no order'];

    const plainText = lines.join('\n');

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a; text-transform: capitalize;">${subject}</h2>
        <div style="font-family: Consolas, 'Courier New', monospace; font-size: 16px; line-height: 1.8; background: #f8fafc; padding: 18px; border-radius: 8px; border: 1px solid #e2e8f0; color: #0f172a;">
          ${lines.map(l => `<div>${l}</div>`).join('')}
        </div>
        <p style="margin-top: 18px; font-size: 13px; color: #64748b;">
          Total Items: <strong>${totalItemsCount}</strong> &bull; Total Orders: <strong>${orders?.length || 0}</strong>
        </p>
      </div>
    `;

    const recipients: string[] = (config.email || 'olivelunch.com@gmail.com')
      .split(/[,;]/)
      .map((e: string) => e.trim())
      .filter(Boolean);

    await resend.emails.send({
      from: 'Olive Lunch <orders@olivelunch.com>',
      to: recipients.length > 0 ? recipients : ['olivelunch.com@gmail.com'],
      subject,
      text: plainText,
      html: htmlBody
    });

    console.log(`Daily order summary sent for ${targetDateStr}: ${totalItemsCount} items to ${recipients.join(', ')}`);

    return {
      success: true,
      skipped: false,
      targetDate: targetDateStr,
      totalItems: totalItemsCount,
      summary: plainText,
      recipients
    };
  } catch (error: any) {
    console.error('Failed to send daily order summary email:', error);
    return { success: false, error: error.message };
  }
}

