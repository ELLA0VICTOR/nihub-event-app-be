const cron = require('node-cron');
const Event = require('../models/Event');

/**
 * Schedule job to auto-terminate expired events
 * Runs every hour
 */
exports.scheduleEventTermination = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('Running auto-termination check...');
      const result = await Event.terminateExpiredEvents();
      if (result.modifiedCount > 0) {
        console.log(`Auto-terminated ${result.modifiedCount} expired events`);
      }
    } catch (error) {
      console.error('Error in auto-termination cron job:', error);
    }
  });

  console.log('Event auto-termination cron job scheduled (runs hourly)');
};