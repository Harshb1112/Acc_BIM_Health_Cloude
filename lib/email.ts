import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendOTPEmail = async (email: string, otp: string, name: string) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'BIM Health Report <noreply@bimhealth.com>',
    to: email,
    subject: 'Verify Your Email - BIM Health Report',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; margin: 20px 0; border-radius: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏗️ BIM Health Report</h1>
            <p>Email Verification</p>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for registering with BIM Health Report. Please use the following OTP to verify your email address:</p>
            <div class="otp-box">${otp}</div>
            <p><strong>This OTP will expire in 10 minutes.</strong></p>
            <p>If you didn't request this verification, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 BIM Health Report. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendWelcomeEmail = async (email: string, name: string) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'BIM Health Report <noreply@bimhealth.com>',
    to: email,
    subject: 'Welcome to BIM Health Report!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to BIM Health Report!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Your email has been successfully verified. You can now access all features of BIM Health Report.</p>
            <p>Start analyzing your Revit models and generate comprehensive health reports.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" class="button">Go to Dashboard</a>
          </div>
          <div class="footer">
            <p>© 2024 BIM Health Report. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// ─────────────────────────────────────────────
// PAYMENT EMAILS
// ─────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  '1_month':   '1 Month  — $10',
  '12_months': '1 Year   — $100',
};

const PLAN_DURATION: Record<string, number> = {
  '1_month':   30,
  '12_months': 365,
};

/** Notify admin that a new payment screenshot was submitted */
export const sendPaymentRequestToAdmin = async (opts: {
  requestId: number;
  userName: string;
  userEmail: string;
  plan: string;
  amount: number;
  screenshotUrl: string;
  transactionNote?: string;
  adminEmail: string;
}) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const planLabel = PLAN_LABELS[opts.plan] ?? opts.plan;
  const approveUrl = `${appUrl}/api/admin/quick-action?action=approve&id=${opts.requestId}&token=${process.env.ADMIN_SECRET_TOKEN || 'bimboss-admin-2026'}`;
  const rejectUrl  = `${appUrl}/api/admin/quick-action?action=reject&id=${opts.requestId}&token=${process.env.ADMIN_SECRET_TOKEN || 'bimboss-admin-2026'}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'BIM Health Report <noreply@bimhealth.com>',
    to: opts.adminEmail,
    subject: `💰 New Payment Request #${opts.requestId} — ${opts.userName}`,
    html: `
      <!DOCTYPE html><html><head>
      <style>
        body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
        .wrap{max-width:640px;margin:0 auto;padding:20px}
        .hdr{background:linear-gradient(135deg,#1e40af,#7c3aed);color:#fff;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center}
        .body{background:#f8fafc;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0}
        .info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0}
        .label{color:#64748b;font-size:13px}
        .value{font-weight:600;color:#1e293b}
        .note{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;color:#92400e}
        .img-box{text-align:center;margin:20px 0}
        .img-box img{max-width:100%;border-radius:10px;border:2px solid #cbd5e1;box-shadow:0 4px 12px rgba(0,0,0,.1)}
        .btn{display:inline-block;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin:6px}
        .approve{background:#16a34a;color:#fff}
        .reject{background:#dc2626;color:#fff}
        .btn-row{text-align:center;margin:24px 0}
        .footer{text-align:center;color:#94a3b8;font-size:12px;margin-top:16px}
      </style>
      </head><body>
      <div class="wrap">
        <div class="hdr">
          <h2 style="margin:0">🏗️ BIM Health Report</h2>
          <p style="margin:6px 0 0;opacity:.85">New Payment Verification Request</p>
        </div>
        <div class="body">
          <h3 style="margin-top:0">Payment Request #${opts.requestId}</h3>

          <div class="info-row"><span class="label">👤 Customer</span><span class="value">${opts.userName}</span></div>
          <div class="info-row"><span class="label">📧 Email</span><span class="value">${opts.userEmail}</span></div>
          <div class="info-row"><span class="label">📦 Plan</span><span class="value">${planLabel}</span></div>
          <div class="info-row"><span class="label">💵 Amount</span><span class="value">$${opts.amount} USD</span></div>
          <div class="info-row"><span class="label">🕐 Submitted</span><span class="value">${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</span></div>

          ${opts.transactionNote ? `<div class="note">📝 Customer Note: ${opts.transactionNote}</div>` : ''}

          <h4>📸 Payment Screenshot</h4>
          <div class="img-box">
            <img src="${appUrl}${opts.screenshotUrl}" alt="Payment Screenshot" />
          </div>

          <div class="btn-row">
            <a href="${approveUrl}" class="btn approve">✅ Approve & Activate</a>
            <a href="${rejectUrl}"  class="btn reject">❌ Reject</a>
          </div>

          <p style="font-size:13px;color:#64748b;text-align:center">
            Or visit the <a href="${appUrl}/admin/payments">Admin Panel</a> to review all pending requests.
          </p>
        </div>
        <div class="footer">© 2026 BIM Health Report · BIMBOSS CONSULTANTS</div>
      </div>
      </body></html>
    `,
  });
};

/** Tell user: payment approved, subscription activated */
export const sendPaymentApprovedEmail = async (opts: {
  userEmail: string;
  userName: string;
  plan: string;
  endDate: Date;
}) => {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const planLabel = PLAN_LABELS[opts.plan] ?? opts.plan;
  const days = PLAN_DURATION[opts.plan] ?? 30;
  const endStr = opts.endDate.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'BIM Health Report <noreply@bimhealth.com>',
    to: opts.userEmail,
    subject: '🎉 Payment Approved — Your Subscription is Active!',
    html: `
      <!DOCTYPE html><html><head>
      <style>
        body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
        .wrap{max-width:600px;margin:0 auto;padding:20px}
        .hdr{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center}
        .body{background:#f0fdf4;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #bbf7d0}
        .info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #d1fae5}
        .label{color:#64748b;font-size:13px}
        .value{font-weight:600;color:#1e293b}
        .badge{display:inline-block;background:#16a34a;color:#fff;padding:6px 20px;border-radius:20px;font-weight:700;font-size:14px}
        .btn{display:inline-block;background:#1d4ed8;color:#fff;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-top:20px}
        .footer{text-align:center;color:#94a3b8;font-size:12px;margin-top:16px}
      </style>
      </head><body>
      <div class="wrap">
        <div class="hdr">
          <div style="font-size:48px">🎉</div>
          <h2 style="margin:8px 0">Payment Approved!</h2>
          <p style="margin:0;opacity:.9">Your BIM Health Report subscription is now active</p>
        </div>
        <div class="body">
          <h3 style="margin-top:0">Hello ${opts.userName}!</h3>
          <p>Great news — your payment has been verified and your subscription has been activated.</p>

          <div class="info-row"><span class="label">📦 Plan</span><span class="value">${planLabel}</span></div>
          <div class="info-row"><span class="label">📅 Duration</span><span class="value">${days} days</span></div>
          <div class="info-row"><span class="label">🗓️ Valid Until</span><span class="value">${endStr}</span></div>
          <div class="info-row"><span class="label">✅ Status</span><span class="value"><span class="badge">ACTIVE</span></span></div>

          <p style="margin-top:20px">You now have full access to all BIM Health Report features including unlimited reports, advanced analytics, and priority support.</p>

          <div style="text-align:center">
            <a href="${appUrl}/dashboard" class="btn">Go to Dashboard →</a>
          </div>
        </div>
        <div class="footer">© 2026 BIM Health Report · BIMBOSS CONSULTANTS</div>
      </div>
      </body></html>
    `,
  });
};

/** Tell user: payment rejected with reason */
export const sendPaymentRejectedEmail = async (opts: {
  userEmail: string;
  userName: string;
  plan: string;
  adminNote: string;
}) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const planLabel = PLAN_LABELS[opts.plan] ?? opts.plan;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'BIM Health Report <noreply@bimhealth.com>',
    to: opts.userEmail,
    subject: '⚠️ Payment Verification Failed — Action Required',
    html: `
      <!DOCTYPE html><html><head>
      <style>
        body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
        .wrap{max-width:600px;margin:0 auto;padding:20px}
        .hdr{background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center}
        .body{background:#fff5f5;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #fecaca}
        .reason{background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;font-style:italic;color:#7f1d1d}
        .btn{display:inline-block;background:#1d4ed8;color:#fff;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-top:20px}
        .footer{text-align:center;color:#94a3b8;font-size:12px;margin-top:16px}
      </style>
      </head><body>
      <div class="wrap">
        <div class="hdr">
          <div style="font-size:48px">⚠️</div>
          <h2 style="margin:8px 0">Payment Not Verified</h2>
          <p style="margin:0;opacity:.9">Your payment screenshot could not be verified</p>
        </div>
        <div class="body">
          <h3 style="margin-top:0">Hello ${opts.userName},</h3>
          <p>Unfortunately we could not verify your payment for the <strong>${planLabel}</strong> plan.</p>

          <p><strong>Reason from admin:</strong></p>
          <div class="reason">${opts.adminNote || 'Screenshot unclear or payment not received.'}</div>

          <p>Please try again:</p>
          <ol>
            <li>Make the PayPal payment to <strong>psoni@bimboss.com</strong></li>
            <li>Take a clear screenshot of the PayPal confirmation</li>
            <li>Upload it on the Billing page</li>
          </ol>

          <div style="text-align:center">
            <a href="${appUrl}/billing" class="btn">Try Again →</a>
          </div>
        </div>
        <div class="footer">© 2026 BIM Health Report · BIMBOSS CONSULTANTS<br>
          Questions? Email us at support@bimboss.com</div>
      </div>
      </body></html>
    `,
  });
};

// ─────────────────────────────────────────────
// ADMIN — NEW USER REGISTRATION NOTIFICATION
// ─────────────────────────────────────────────

/** Notify admin when a new user registers */
export const sendNewUserNotificationToAdmin = async (opts: {
  adminEmail: string;
  userName: string;
  userEmail: string;
  phone?: string;
  region?: string;
  userId: number;
}) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const adminUrl = `${appUrl}/admin`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'BIM Health Report <noreply@bimhealth.com>',
    to: opts.adminEmail,
    subject: `👤 New User Registered — ${opts.userName}`,
    html: `
      <!DOCTYPE html><html><head>
      <style>
        body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
        .wrap{max-width:600px;margin:0 auto;padding:20px}
        .hdr{background:linear-gradient(135deg,#1e40af,#7c3aed);color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center}
        .body{background:#f8fafc;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0}
        .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0}
        .lbl{color:#64748b;font-size:13px}
        .val{font-weight:600;color:#1e293b}
        .btn{display:inline-block;background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:20px}
        .footer{text-align:center;color:#94a3b8;font-size:12px;margin-top:16px}
      </style>
      </head><body>
      <div class="wrap">
        <div class="hdr">
          <div style="font-size:36px">👤</div>
          <h2 style="margin:8px 0">New User Registered!</h2>
          <p style="margin:0;opacity:.85">BIM Health Report Platform</p>
        </div>
        <div class="body">
          <h3 style="margin-top:0">User Details</h3>
          <div class="row"><span class="lbl">🆔 User ID</span><span class="val">#${opts.userId}</span></div>
          <div class="row"><span class="lbl">👤 Name</span><span class="val">${opts.userName}</span></div>
          <div class="row"><span class="lbl">📧 Email</span><span class="val">${opts.userEmail}</span></div>
          <div class="row"><span class="lbl">📱 Phone</span><span class="val">${opts.phone || '—'}</span></div>
          <div class="row"><span class="lbl">🌍 Region</span><span class="val">${opts.region || '—'}</span></div>
          <div class="row"><span class="lbl">🕐 Registered</span><span class="val">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
          <div style="text-align:center">
            <a href="${adminUrl}" class="btn">View in Admin Panel →</a>
          </div>
        </div>
        <div class="footer">© 2026 BIM Health Report · BIMBOSS CONSULTANTS</div>
      </div>
      </body></html>
    `,
  });
};
