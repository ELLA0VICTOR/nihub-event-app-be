const nodemailer = require('nodemailer');
require('dotenv').config();
console.log('Loaded EMAIL_HOST:', process.env.EMAIL_HOST);


async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_USER, // Send to yourself for testing
      subject: 'Test Email - Attendance System',
      text: 'If you receive this, your email setup is working! ✅',
    });
    
    console.log('✅ SUCCESS! Email sent:', info.messageId);
    console.log('Check your inbox:', process.env.EMAIL_USER);
  } catch (error) {
    console.error('❌ FAILED:', error.message);
  }
}

testEmail();