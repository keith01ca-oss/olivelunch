import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';
import { getOrResolveOrgId } from '@/lib/auth';

const resend = new Resend(process.env.RESEND_API_KEY!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust this to specific domains in production if needed
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let orgId = null;
    try {
      orgId = await getOrResolveOrgId();
    } catch (e) {
      console.warn('Could not resolve org ID for contact form:', e);
    }

    // Insert into Supabase
    const { error: dbError } = await supabaseAdmin
      .from('contact_messages')
      .insert([
        {
          org_id: orgId === '00000000-0000-0000-0000-000000000000' ? null : orgId,
          name,
          email,
          subject,
          message,
          status: 'unread',
        },
      ]);

    if (dbError && dbError.code !== '42P01') { 
      // 42P01 is undefined_table, in case the migration hasn't been run yet
      console.error('Error saving contact message to db:', dbError);
      // We continue to send the email even if DB insert fails
    }

    // Send Email via Resend
    try {
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
          <h2 style="color: #0f172a; border-b: 1px solid #e2e8f0; padding-bottom: 10px;">New Inquiry</h2>
          <p><strong>From:</strong> ${name} (<a href="mailto:${email}">${email}</a>)</p>
          ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
          <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #4f46e5; background: #f8fafc; border-radius: 4px; white-space: pre-wrap;">${message}</div>
          <p style="font-size: 12px; color: #64748b; margin-top: 30px; border-t: 1px solid #e2e8f0; padding-top: 10px;">
            Submitted from Olive Lunch Contact Form.
          </p>
        </div>
      `;

      await resend.emails.send({
        from: 'Olive Lunch Contact <orders@olivelunch.com>',
        to: 'info@olivelunch.com',
        replyTo: email,
        subject: `New Contact Form Submission: ${subject || 'No Subject'}`,
        html,
      });
    } catch (emailError) {
      console.error('Error sending contact email:', emailError);
      // We might still want to return success if DB saved, but if both fail it's an issue.
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Contact form error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
