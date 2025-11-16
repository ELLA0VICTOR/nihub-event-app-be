const mongoose = require('mongoose');
require('dotenv').config();

const fixIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('attendances');
    
    // Drop old index
    try {
      await collection.dropIndex('participantId_1_eventId_1');
      console.log('✅ Old index dropped');
    } catch (err) {
      console.log('Old index already removed or does not exist');
    }
    
    // Create new index
    await collection.createIndex(
      { participantId: 1, eventId: 1, attendanceDate: 1 },
      { unique: true }
    );
    console.log('✅ New compound index created');
    
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    console.log(indexes);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixIndexes();