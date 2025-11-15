const nodemailer = require('nodemailer');

/**
 * Create reusable transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send email verification email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.verificationUrl - Verification URL
 * @returns {Promise<Object>} - Send result
 */
exports.sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Attendance System" <${process.env.EMAIL_FROM}>`,
      to,
      subject: 'Verify Your Email - Attendance Management System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; 
              padding: 40px 20px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content { 
              padding: 40px 30px; 
              background-color: #ffffff; 
            }
            .content p {
              margin: 0 0 15px 0;
              font-size: 16px;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .verify-button { 
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white !important; 
              padding: 15px 40px; 
              text-decoration: none; 
              border-radius: 5px;
              font-weight: bold;
              font-size: 16px;
              transition: transform 0.2s;
            }
            .verify-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            .info-box { 
              background: #f8f9fa; 
              padding: 20px; 
              margin: 20px 0; 
              border-left: 4px solid #667eea;
              border-radius: 4px;
            }
            .footer { 
              text-align: center; 
              padding: 20px; 
              font-size: 12px; 
              color: #666;
              background: #f8f9fa;
            }
            .link-text {
              word-break: break-all;
              color: #667eea;
              font-size: 12px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✉️ Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${name}</strong>,</p>
              <p>Thank you for registering with the Attendance Management System!</p>
              <p>To complete your registration and activate your superadmin account, please verify your email address by clicking the button below:</p>
              
              <div class="button-container">
                <a href="${verificationUrl}" class="verify-button">Verify Email Address</a>
              </div>

              <div class="info-box">
                <p><strong>⚠️ Important:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This verification link is valid for <strong>24 hours</strong></li>
                  <li>After verification, you'll be able to log in immediately</li>
                  <li>If you didn't create this account, please ignore this email</li>
                </ul>
              </div>

              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p class="link-text">${verificationUrl}</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Attendance Management System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Verification email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Verification email sending error:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send email with QR code
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.eventName - Event name
 * @param {string} options.qrCode - QR code data URL
 * @returns {Promise<Object>} - Send result
 */
exports.sendQRCodeEmail = async ({ to, name, eventName, qrCode, eventDate, eventLocation }) => {
  try {
    const transporter = createTransporter();

    // Convert data URL to buffer for attachment
    const qrBuffer = Buffer.from(qrCode.split(',')[1], 'base64');

    const mailOptions = {
      from: `"Attendance System" <${process.env.EMAIL_FROM}>`,
      to,
      subject: `Registration Confirmed: ${eventName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; 
              padding: 30px 20px; 
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 { margin: 0; font-size: 26px; }
            .content { padding: 30px 20px; background-color: #f9f9f9; }
            .qr-container { text-align: center; margin: 20px 0; }
            .qr-image { 
              max-width: 300px; 
              border: 2px solid #ddd; 
              padding: 15px; 
              background: white;
              border-radius: 8px;
            }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            .info-box { 
              background: white; 
              padding: 20px; 
              margin: 15px 0; 
              border-left: 4px solid #667eea;
              border-radius: 4px;
            }
            .info-box h3 {
              margin-top: 0;
              color: #667eea;
            }
            ul {
              padding-left: 20px;
            }
            li {
              margin: 8px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1> Registration Successful!</h1>
            </div>
            <div class="content">
              <p>Dear <strong>${name}</strong>,</p>
              <p>Thank you for registering for <strong>${eventName}</strong>.</p>
              
              <div class="info-box">
                <h3>📅 Event Details:</h3>
                <p><strong>Event:</strong> ${eventName}</p>
                <p><strong>Date:</strong> ${new Date(eventDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Location:</strong> ${eventLocation}</p>
              </div>

              <p><strong>Your QR Code:</strong></p>
              <div class="qr-container">
                <img src="cid:qrcode" alt="QR Code" class="qr-image" />
              </div>
              
              <p><strong>⚠️ Important Instructions:</strong></p>
              <ul>
                <li>Save this QR code on your device or print it out</li>
                <li>Present this QR code at the event entrance for attendance marking</li>
                <li>Do not share your QR code with others</li>
                <li>Each QR code is unique to your registration</li>
              </ul>

              <p>We look forward to seeing you at the event! 🎊</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Attendance Management System</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrBuffer,
          cid: 'qrcode', // Referenced in HTML
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send admin approval notification
 * @param {Object} options - Email options
 */
exports.sendAdminApprovalEmail = async ({ to, name, status, notes }) => {
  try {
    const transporter = createTransporter();

    const isApproved = status === 'approved';
    const subject = isApproved ? 'Admin Access Approved' : 'Admin Access Request Update';

    const mailOptions = {
      from: `"Attendance System" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { 
              background: ${isApproved ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#FF9800'}; 
              color: white; 
              padding: 30px 20px; 
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content { padding: 30px 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${isApproved ? '✅ Access Approved!' : '📋 Request Update'}</h1>
            </div>
            <div class="content">
              <p>Dear <strong>${name}</strong>,</p>
              <p>Your admin access request has been <strong>${status}</strong>.</p>
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
              ${isApproved ? '<p>You can now log in and access admin features.</p>' : ''}
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Attendance Management System</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Admin approval email sent:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send approval email');
  }
};

/**
 * Send generic email
 * @param {Object} options - Email options
 */
exports.sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Attendance System" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};