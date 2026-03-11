const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const trainRoutes = require('./routes/trains');
const bookingRoutes = require('./routes/bookings');
const aiRoutes = require('./routes/ai');
const realtimeRoutes = require('./routes/realtime');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', trainRoutes);
app.use('/api', bookingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/realtime', realtimeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RailAI API is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
