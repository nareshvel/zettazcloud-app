/**
 * Email Service for Public Signup
 * Handles email verification, welcome emails, and notifications
 * Uses shared hosting SMTP configuration
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize SMTP transporter with shared hosting configuration
   */
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.yourdomain.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || 'noreply@yourdomain.com',
          pass: process.env.SMTP_PASS || ''
        },
        tls: {
          rejectUnauthorized: false // For shared hosting compatibility
        }
      });

      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  /**
   * Generate secure verification token
   * @returns {string} - 32-character hex token
   */
  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate verification expiry date (24 hours from now)
   * @returns {Date} - Expiry date
   */
  generateVerificationExpiry() {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24); // 24 hours from now
    return expiry;
  }

  /**
   * Send email verification email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} token - Verification token
   * @returns {Promise<boolean>} - Success status
   */
  async sendVerificationEmail(email, name, token) {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
      
      const mailOptions = {
        from: {
          name: 'Zettaz Cloud POS',
          address: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@yourdomain.com'
        },
        to: email,
        subject: 'Verify Your Email - Welcome to Zettaz Cloud POS!',
        html: this.getVerificationEmailTemplate(name, verificationUrl),
        text: this.getVerificationEmailText(name, verificationUrl)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${email}:`, result.messageId);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send verification email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Send welcome email after successful verification
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} tenantName - Tenant/business name
   * @returns {Promise<boolean>} - Success status
   */
  async sendWelcomeEmail(email, name, tenantName) {
    try {
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
      
      const mailOptions = {
        from: {
          name: 'Zettaz Cloud POS',
          address: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@yourdomain.com'
        },
        to: email,
        subject: 'Welcome to Zettaz Cloud POS - Your 14-Day Trial Starts Now!',
        html: this.getWelcomeEmailTemplate(name, tenantName, loginUrl),
        text: this.getWelcomeEmailText(name, tenantName, loginUrl)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}:`, result.messageId);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send welcome email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Send password reset email (for future use)
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} resetToken - Reset token
   * @returns {Promise<boolean>} - Success status
   */
  async sendPasswordResetEmail(email, name, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: {
          name: 'Zettaz Cloud POS',
          address: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@yourdomain.com'
        },
        to: email,
        subject: 'Reset Your Password - Zettaz Cloud POS',
        html: this.getPasswordResetEmailTemplate(name, resetUrl),
        text: this.getPasswordResetEmailText(name, resetUrl)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}:`, result.messageId);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send password reset email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Test email configuration
   * @returns {Promise<boolean>} - Connection status
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      return false;
    }
  }

  /**
   * Shared table-based email layout. One header, one footer, one accent color,
   * used by all transactional emails so they read as a single coherent brand
   * instead of each having its own palette. Table markup (not divs) for
   * reliable rendering in Outlook and other clients with limited CSS support.
   *
   * @param {Object} opts
   * @param {string} opts.preheader - Hidden preview text shown in inbox lists
   * @param {string} opts.heading - Main heading shown in the header band
   * @param {string} opts.bodyHtml - Inner content, already table/paragraph markup
   */
  renderEmailLayout({ preheader = '', heading, bodyHtml }) {
    const NAVY = '#16283f';
    const BORDER = '#e2e5ea';
    const TEXT = '#33383f';
    const MUTED = '#6b7280';

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <title>${heading}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif;">
      <span style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${preheader}</span>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6; padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff; border:1px solid ${BORDER}; border-radius:8px; overflow:hidden;">
              <tr>
                <td style="background-color:${NAVY}; padding:28px 32px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="color:#ffffff; font-size:18px; font-weight:bold;">Zettaz Cloud POS</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:32px; color:${TEXT}; font-size:15px; line-height:1.6;">
                  <h1 style="margin:0 0 16px; font-size:20px; color:${NAVY};">${heading}</h1>
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px; border-top:1px solid ${BORDER}; color:${MUTED}; font-size:12px; text-align:center;">
                  <p style="margin:0 0 4px;">&copy; ${new Date().getFullYear()} Zettaz Cloud POS. All rights reserved.</p>
                  <p style="margin:0;">Need help? Contact us at <a href="mailto:support@zettaz.com" style="color:${NAVY}; text-decoration:none;">support@zettaz.com</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
  }

  /**
   * Renders a button used inside the shared layout above. Table-based for
   * Outlook compatibility rather than a styled <a>.
   *
   * Button color is the same dark navy blue (#16283f) used in the email
   * header band, so the entire email reads as a single coherent brand
   * rather than a navy header with a jarring bright-blue button.
   */
  renderEmailButton(url, label) {
    const NAVY = '#16283f';
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto;">
      <tr>
        <td align="center" style="border-radius:6px; background-color:${NAVY};">
          <a href="${url}" style="display:inline-block; padding:12px 28px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:6px;">${label}</a>
        </td>
      </tr>
    </table>
    `;
  }

  /**
   * HTML template for email verification
   */
  getVerificationEmailTemplate(name, verificationUrl) {
    const bodyHtml = `
        <p>Hi ${name},</p>
        <p>Thank you for signing up for Zettaz Cloud POS. To get started with your <strong>14-day free trial</strong>, please verify your email address.</p>
        ${this.renderEmailButton(verificationUrl, 'Verify Email Address')}
        <p style="font-size:13px; color:#6b7280;">Or copy and paste this link into your browser:</p>
        <p style="word-break:break-all; background:#f3f4f6; padding:10px 12px; border-radius:4px; font-size:13px;">${verificationUrl}</p>
        <p style="margin-top:24px;"><strong>What's next:</strong></p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
          <tr><td style="padding:4px 0;">1. Verify your email (this step)</td></tr>
          <tr><td style="padding:4px 0;">2. Set up your store information</td></tr>
          <tr><td style="padding:4px 0;">3. Add your first products</td></tr>
          <tr><td style="padding:4px 0;">4. Start processing sales</td></tr>
        </table>
        <p style="margin-top:24px; font-size:13px; color:#6b7280;">This verification link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
    `;
    return this.renderEmailLayout({
      preheader: 'Verify your email to activate your 14-day free trial.',
      heading: 'Verify your email address',
      bodyHtml
    });
  }

  /**
   * Plain text version of verification email
   */
  getVerificationEmailText(name, verificationUrl) {
    return `
Hi ${name},

Welcome to Zettaz Cloud POS!

Thank you for signing up! To get started with your 14-day free trial, please verify your email address by visiting:

${verificationUrl}

What's next?
- Verify your email (this step)
- Set up your store information
- Add your first products
- Start processing sales

This verification link will expire in 24 hours for security reasons.

If you didn't create this account, please ignore this email.

© 2025 Zettaz Cloud POS. All rights reserved.
Need help? Contact us at support@zettaz.com
    `;
  }

  /**
   * HTML template for welcome email
   */
  getWelcomeEmailTemplate(name, tenantName, loginUrl) {
    const rowStyle = 'padding:12px 0; border-bottom:1px solid #e2e5ea;';
    const bodyHtml = `
        <p>Hi ${name},</p>
        <p>Your email has been verified and your <strong>14-day free trial</strong> for <strong>${tenantName}</strong> is now active.</p>
        ${this.renderEmailButton(loginUrl, 'Access Your Dashboard')}
        <h2 style="font-size:16px; color:#16283f; margin:28px 0 8px;">Get started with these features</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
          <tr>
            <td style="${rowStyle}">
              <strong>Sales Dashboard</strong><br>
              <span style="color:#6b7280;">Track daily sales, revenue, and performance metrics in real time.</span>
            </td>
          </tr>
          <tr>
            <td style="${rowStyle}">
              <strong>Inventory Management</strong><br>
              <span style="color:#6b7280;">Add products, manage stock levels, and set up categories.</span>
            </td>
          </tr>
          <tr>
            <td style="${rowStyle}">
              <strong>Customer Management</strong><br>
              <span style="color:#6b7280;">Build customer profiles and track purchase history.</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;">
              <strong>Payment Processing</strong><br>
              <span style="color:#6b7280;">Accept multiple payment methods and generate receipts.</span>
            </td>
          </tr>
        </table>
        <p style="margin-top:24px;"><strong>Your trial includes:</strong> full access to all POS features, unlimited products and transactions, customer support, and data export capabilities.</p>
        <p style="font-size:13px; color:#6b7280;">Need help getting started? See our <a href="${process.env.FRONTEND_URL}/help" style="color:#16283f;">Getting Started Guide</a> or contact our support team.</p>
    `;
    return this.renderEmailLayout({
      preheader: `Your 14-day trial for ${tenantName} is now active.`,
      heading: 'Welcome — your trial is active',
      bodyHtml
    });
  }

  /**
   * Plain text version of welcome email
   */
  getWelcomeEmailText(name, tenantName, loginUrl) {
    return `
Hi ${name},

Congratulations! Your email has been verified and your 14-day free trial for ${tenantName} is now active.

Access your dashboard: ${loginUrl}

Get Started with These Features:
- Sales Dashboard: Track your daily sales and performance metrics
- Inventory Management: Add products and manage stock levels
- Customer Management: Build customer profiles and track history
- Payment Processing: Accept payments and generate receipts

Your trial includes:
- Full access to all POS features
- Unlimited products and transactions
- Customer support
- Data export capabilities

Need help getting started? Visit ${process.env.FRONTEND_URL}/help or contact support@zettaz.com

© 2025 Zettaz Cloud POS. All rights reserved.
    `;
  }

  /**
   * HTML template for password reset email
   */
  getPasswordResetEmailTemplate(name, resetUrl) {
    const bodyHtml = `
        <p>Hi ${name},</p>
        <p>We received a request to reset the password for your Zettaz Cloud POS account.</p>
        ${this.renderEmailButton(resetUrl, 'Reset Password')}
        <p style="font-size:13px; color:#6b7280;">Or copy and paste this link into your browser:</p>
        <p style="word-break:break-all; background:#f3f4f6; padding:10px 12px; border-radius:4px; font-size:13px;">${resetUrl}</p>
        <p style="margin-top:24px; font-size:13px; color:#6b7280;">This link expires in 1 hour. If you didn't request a password reset, no action is needed — your password will remain unchanged.</p>
    `;
    return this.renderEmailLayout({
      preheader: 'Reset the password for your Zettaz Cloud POS account.',
      heading: 'Reset your password',
      bodyHtml
    });
  }

  /**
   * Plain text version of password reset email
   */
  getPasswordResetEmailText(name, resetUrl) {
    return `
Hi ${name},

We received a request to reset your password for your Zettaz Cloud POS account.

Reset your password by visiting: ${resetUrl}

Important: This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

© 2025 Zettaz Cloud POS. All rights reserved.
Need help? Contact us at support@zettaz.com
    `;
  }

  // ---------------------------------------------------------------------
  // Billing emails (Stripe Billing Module — dunning notifications)
  // ---------------------------------------------------------------------

  /**
   * HTML template for a failed payment attempt (attempts 1-2; attempt 3
   * triggers the grace-period email instead).
   */
  getPaymentFailedEmailTemplate(name, tenantName, attemptNumber) {
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/billing`;
    const bodyHtml = `
        <p>Hi ${name},</p>
        <p>We were unable to process the latest payment for <strong>${tenantName}</strong>'s Zettaz Cloud POS subscription (attempt ${attemptNumber} of 3).</p>
        <p>Your account remains active for now. Please check that your card details are up to date to avoid any interruption.</p>
        ${this.renderEmailButton(billingUrl, 'Update Payment Method')}
        <p style="margin-top:24px; font-size:13px; color:#6b7280;">If this keeps happening after updating your card, please contact your bank or reach out to us for help.</p>
    `;
    return this.renderEmailLayout({
      preheader: `We couldn't process your latest payment for ${tenantName}.`,
      heading: 'A payment attempt failed',
      bodyHtml
    });
  }

  getPaymentFailedEmailText(name, tenantName, attemptNumber) {
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/billing`;
    return `
Hi ${name},

We were unable to process the latest payment for ${tenantName}'s Zettaz Cloud POS subscription (attempt ${attemptNumber} of 3).

Your account remains active for now. Please update your payment method to avoid any interruption:
${billingUrl}

If this keeps happening after updating your card, please contact your bank or reach out to us for help.

© ${new Date().getFullYear()} Zettaz Cloud POS. All rights reserved.
Need help? Contact us at support@zettaz.com
    `;
  }

  /**
   * HTML template for the grace-period-started notice (sent after the 3rd
   * consecutive failed payment attempt).
   */
  getGracePeriodStartedEmailTemplate(name, tenantName, graceEndDate) {
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/billing`;
    const bodyHtml = `
        <p>Hi ${name},</p>
        <p>We've tried a few times now and still can't process payment for <strong>${tenantName}</strong>'s Zettaz Cloud POS subscription.</p>
        <p>To give you time to sort this out, your account will stay active until <strong>${graceEndDate}</strong>. After that date, access may be limited until payment succeeds.</p>
        ${this.renderEmailButton(billingUrl, 'Update Payment Method')}
        <p style="margin-top:24px; font-size:13px; color:#6b7280;">Updating your card and completing a successful charge will restore your account to normal immediately.</p>
    `;
    return this.renderEmailLayout({
      preheader: `Your account for ${tenantName} needs a payment update by ${graceEndDate}.`,
      heading: 'Please update your payment method',
      bodyHtml
    });
  }

  getGracePeriodStartedEmailText(name, tenantName, graceEndDate) {
    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/billing`;
    return `
Hi ${name},

We've tried a few times now and still can't process payment for ${tenantName}'s Zettaz Cloud POS subscription.

To give you time to sort this out, your account will stay active until ${graceEndDate}. After that date, access may be limited until payment succeeds.

Update your payment method here: ${billingUrl}

Updating your card and completing a successful charge will restore your account to normal immediately.

© ${new Date().getFullYear()} Zettaz Cloud POS. All rights reserved.
Need help? Contact us at support@zettaz.com
    `;
  }

  /**
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} tenantName - Tenant/business name
   * @param {number} attemptNumber - Which failed attempt this is (1-based)
   * @returns {Promise<boolean>}
   */
  async sendPaymentFailedEmail(email, name, tenantName, attemptNumber) {
    try {
      const mailOptions = {
        from: {
          name: 'Zettaz Cloud POS',
          address: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@yourdomain.com'
        },
        to: email,
        subject: 'Payment failed for your Zettaz Cloud POS subscription',
        html: this.getPaymentFailedEmailTemplate(name, tenantName, attemptNumber),
        text: this.getPaymentFailedEmailText(name, tenantName, attemptNumber)
      };
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Payment-failed email sent to ${email}:`, result.messageId);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send payment-failed email to ${email}:`, error);
      return false;
    }
  }

  /**
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} tenantName - Tenant/business name
   * @param {string} graceEndDate - ISO date string the grace period ends
   * @returns {Promise<boolean>}
   */
  async sendGracePeriodStartedEmail(email, name, tenantName, graceEndDate) {
    try {
      const mailOptions = {
        from: {
          name: 'Zettaz Cloud POS',
          address: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@yourdomain.com'
        },
        to: email,
        subject: 'Action needed: update your payment method',
        html: this.getGracePeriodStartedEmailTemplate(name, tenantName, graceEndDate),
        text: this.getGracePeriodStartedEmailText(name, tenantName, graceEndDate)
      };
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Grace-period email sent to ${email}:`, result.messageId);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send grace-period email to ${email}:`, error);
      return false;
    }
  }
}

module.exports = new EmailService();
