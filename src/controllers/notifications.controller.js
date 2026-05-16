const { getPool, sql } = require('../config/db');
const { createNotification: createSiteNotification, normalizeChannel } = require('../services/notification.service');

async function getMyNotifications(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.Int, req.user.id)
      .query(`
        SELECT Id, UserId, Title, Message, Channel, IsRead, CreatedAt
        FROM dbo.Notifications
        WHERE UserId = @UserId
        ORDER BY CreatedAt DESC
      `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить уведомления' });
  }
}

async function markNotificationRead(req, res) {
  try {
    const notificationId = Number(req.params.id);
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.Int, notificationId)
      .input('UserId', sql.Int, req.user.id)
      .query(`
        UPDATE dbo.Notifications
        SET IsRead = 1
        OUTPUT INSERTED.*
        WHERE Id = @Id AND UserId = @UserId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Уведомление не найдено' });
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось отметить уведомление прочитанным' });
  }
}

async function createNotification(req, res) {
  try {
    const userId = Number(req.body.UserId || req.body.userId);
    const title = req.body.Title || req.body.title;
    const message = req.body.Message || req.body.message;
    const channel = normalizeChannel(req.body.Channel || req.body.channel || 'site');

    if (!userId || !title || !message) {
      return res.status(400).json({ message: 'Укажите пользователя, заголовок и текст уведомления' });
    }

    const pool = await getPool();
    const notification = await createSiteNotification(
      { pool },
      {
        userId,
        title,
        message,
        channel
      }
    );

    return res.status(201).json(notification);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось отправить уведомление' });
  }
}

module.exports = {
  getMyNotifications,
  markNotificationRead,
  createNotification
};
