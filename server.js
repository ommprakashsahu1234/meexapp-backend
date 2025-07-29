const express = require('express');
require('dotenv').config();
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io');
const messageSocket = require('./sockets/messageSocket');


const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const UserRoute = require('./router/user-router');
const PostRoute = require('./router/post-router');
const MessageRoute = require('./router/message-router');
const ActivityRoute = require('./router/activity-router')
const AdminRoute = require('./router/admin-router')

app.use('/api/user', UserRoute);
app.use("/api/post", PostRoute);
app.use("/api/messages", MessageRoute);
app.use("/api/admin", AdminRoute);
app.use("/api/", ActivityRoute);


const conn = require('./conn/conn');

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  }
});


messageSocket(io);

conn().then(() => {
  server.listen(PORT,'0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
});
