const { sql } = require('../config/db');

const SUPPORTED_CHANNELS = new Set(['site', 'email', 'vk']);

function normalizeChannel(channel) {
  return SUPPORTED_CHANNELS.has(channel) ? channel : 'site';
}

function createRequest(context) {
  if (context.transaction) {
    return new sql.Request(context.transaction);
  }

  return context.pool.request();
}

async function createNotification(context, { userId, title, message, channel = 'site' }) {
  const result = await createRequest(context)
    .input('UserId', sql.Int, userId)
    .input('Title', sql.NVarChar(150), title)
    .input('Message', sql.NVarChar(1000), message)
    .input('Channel', sql.NVarChar(50), normalizeChannel(channel))
    .query(`
      INSERT INTO dbo.Notifications (UserId, Title, Message, Channel)
      OUTPUT INSERTED.*
      VALUES (@UserId, @Title, @Message, @Channel)
    `);

  return result.recordset[0];
}

async function notifyLessonStudents(context, lessonId, title, message) {
  const usersResult = await createRequest(context)
    .input('LessonId', sql.Int, lessonId)
    .query(`
      SELECT DISTINCT StudentId
      FROM dbo.Bookings
      WHERE LessonId = @LessonId AND Status = 'active'
    `);

  for (const row of usersResult.recordset) {
    await createNotification(context, {
      userId: row.StudentId,
      title,
      message,
      channel: 'site'
    });
  }
}

module.exports = {
  createNotification,
  notifyLessonStudents,
  normalizeChannel
};
