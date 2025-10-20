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
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .qr-container { text-align: center; margin: 20px 0; }
            .qr-image { max-width: 300px; border: 2px solid #ddd; padding: 10px; background: white; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Registration Successful!</h1>
            </div>
            <div class="content">
              <p>Dear ${name},</p>
              <p>Thank you for registering for <strong>${eventName}</strong>.</p>
              
              <div class="info-box">
                <h3>Event Details:</h3>
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
              
              <p><strong>Important Instructions:</strong></p>
              <ul>
                <li>Save this QR code on your device or print it out</li>
                <li>Present this QR code at the event entrance for attendance marking</li>
                <li>Do not share your QR code with others</li>
                <li>Each QR code is unique to your registration</li>
              </ul>

              <p>We look forward to seeing you at the event!</p>
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
            .header { background-color: ${isApproved ? '#4CAF50' : '#FF9800'}; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${isApproved ? 'Access Approved!' : 'Request Update'}</h1>
            </div>
            <div class="content">
              <p>Dear ${name},</p>
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