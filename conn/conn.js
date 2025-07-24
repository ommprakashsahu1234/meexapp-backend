const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
// dotenv.config({quiet:true});

mongoose.set('strictQuery', false);

const conn = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 20000
    });
    console.log('Database Connection Successfull ✅');
  } catch (err) {
    console.error('Database Not Connected ❌', err.message);
    process.exit(1);
  }
};

module.exports = conn;

// mongodb+srv://opsomm:opsomm1234@cluster0.xfnpvaa.mongodb.net/MeetX?retryWrites=true&w=majority&appName=Cluster0