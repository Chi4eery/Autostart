require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { getPool } = require('./src/config/db');
const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const instructorsRoutes = require('./src/routes/instructors.routes');
const coursesRoutes = require('./src/routes/courses.routes');
const lessonsRoutes = require('./src/routes/lessons.routes');
const bookingsRoutes = require('./src/routes/bookings.routes');
const materialsRoutes = require('./src/routes/materials.routes');
const notificationsRoutes = require('./src/routes/notifications.routes');
const enrollmentRequestsRoutes = require('./src/routes/enrollmentRequests.routes');
const progressRoutes = require('./src/routes/progress.routes');
const theoryTopicsRoutes = require('./src/routes/theoryTopics.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (req, res) => {
  try {
    await getPool();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'unavailable', message: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/instructors', instructorsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/enrollment-requests', enrollmentRequestsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/theory-topics', theoryTopicsRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Маршрут API не найден' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`AutoSchool app is running on http://localhost:${PORT}`);
});

getPool()
  .then(() => console.log('SQL Server connection is ready'))
  .catch((error) => {
    console.warn('SQL Server is not connected yet:', error.message);
    console.warn('Create AutoSchoolDB and fill .env before using API endpoints.');
  });
