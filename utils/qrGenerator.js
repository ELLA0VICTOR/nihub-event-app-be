const QRCode = require('qrcode');

/**
 * Generate QR code as Data URL
 * @param {string} participantId - The participant ID to encode
 * @returns {Promise<string>} - Data URL of the QR code
 */
exports.generateQRCode = async (participantId) => {
  try {
    // Create QR code data URL
    const qrDataURL = await QRCode.toDataURL(participantId, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 300,
    });

    return qrDataURL;
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate QR code as buffer
 * @param {string} participantId - The participant ID to encode
 * @returns {Promise<Buffer>} - Buffer of the QR code
 */
exports.generateQRCodeBuffer = async (participantId) => {
  try {
    const qrBuffer = await QRCode.toBuffer(participantId, {
      errorCorrectionLevel: 'H',
      type: 'png',
      quality: 0.92,
      margin: 1,
      width: 300,
    });

    return qrBuffer;
  } catch (error) {
    console.error('QR Code buffer generation error:', error);
    throw new Error('Failed to generate QR code buffer');
  }
};

/**
 * Validate QR code data
 * @param {string} data - Data to validate
 * @returns {boolean} - Whether the data is valid
 */
exports.validateQRData = (data) => {
  // Check if data is a valid MongoDB ObjectId
  return /^[0-9a-fA-F]{24}$/.test(data);
};