const mongoose = require('mongoose');
require('./src/config/loadEnv');
const Exam = require('./src/models/Exam');
const User = require('./src/models/User');
const { startOrResumeSession } = require('./src/services/sessionService');
const fs = require('fs');

async function testStartExam() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/testforge');
        console.log('DB connected');

        const admin = await User.findOne({ role: 'admin' });
        const exam = await Exam.findOne();

        console.log('Attempting to start exam for:', admin._id, 'Exam:', exam._id);

        const result = await startOrResumeSession({
            exam,
            userId: admin._id,
            ownerId: admin._id
        });

        console.log('Success:', result.session._id);
    } catch (err) {
        fs.writeFileSync('error_out.txt', err.stack || err.message || String(err), 'utf-8');
    } finally {
        process.exit(0);
    }
}

testStartExam();
