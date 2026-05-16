const { getPool, sql } = require('../config/db');
const { ensureLessonProgressTable } = require('../services/progress.service');
const { createNotification } = require('../services/notification.service');

const RESULT_STATUSES = new Set(['not_marked', 'passed', 'failed']);

async function canInstructorMarkBooking(pool, user, bookingId) {
  if (user.role === 'Admin') {
    return true;
  }

  const result = await pool.request()
    .input('BookingId', sql.Int, bookingId)
    .input('UserId', sql.Int, user.id)
    .query(`
      SELECT b.Id
      FROM dbo.Bookings b
      INNER JOIN dbo.Lessons l ON l.Id = b.LessonId
      INNER JOIN dbo.Instructors i ON i.Id = l.InstructorId
      WHERE b.Id = @BookingId AND i.UserId = @UserId
    `);

  return result.recordset.length > 0;
}

async function markBookingProgress(req, res) {
  const bookingId = Number(req.params.id);
  const resultStatus = req.body.ResultStatus || req.body.resultStatus;
  const hoursCompleted = req.body.HoursCompleted ?? req.body.hoursCompleted ?? null;
  const comment = req.body.Comment ?? req.body.comment ?? null;

  if (!bookingId) {
    return res.status(400).json({ message: 'Некорректный Id записи' });
  }

  if (!RESULT_STATUSES.has(resultStatus)) {
    return res.status(400).json({ message: 'Укажите результат: not_marked, passed или failed' });
  }

  if (hoursCompleted !== null && Number(hoursCompleted) < 0) {
    return res.status(400).json({ message: 'Количество часов не может быть отрицательным' });
  }

  let transaction;

  try {
    const pool = await getPool();
    await ensureLessonProgressTable(pool);

    const allowed = await canInstructorMarkBooking(pool, req.user, bookingId);
    if (!allowed) {
      return res.status(403).json({ message: 'Можно отмечать только свои занятия' });
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const bookingResult = await new sql.Request(transaction)
      .input('BookingId', sql.Int, bookingId)
      .query(`
        SELECT
          b.Id,
          b.StudentId,
          l.Title AS LessonTitle
        FROM dbo.Bookings b
        INNER JOIN dbo.Lessons l ON l.Id = b.LessonId
        WHERE b.Id = @BookingId
      `);

    if (bookingResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    const progressResult = await new sql.Request(transaction)
      .input('BookingId', sql.Int, bookingId)
      .input('ResultStatus', sql.NVarChar(50), resultStatus)
      .input('HoursCompleted', sql.Decimal(5, 2), hoursCompleted === null || hoursCompleted === '' ? null : Number(hoursCompleted))
      .input('Comment', sql.NVarChar(1000), comment || null)
      .input('MarkedByUserId', sql.Int, req.user.id)
      .query(`
        MERGE dbo.LessonProgress AS target
        USING (SELECT @BookingId AS BookingId) AS source
        ON target.BookingId = source.BookingId
        WHEN MATCHED THEN
          UPDATE SET
            ResultStatus = @ResultStatus,
            HoursCompleted = @HoursCompleted,
            Comment = @Comment,
            MarkedByUserId = @MarkedByUserId,
            MarkedAt = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (BookingId, ResultStatus, HoursCompleted, Comment, MarkedByUserId, MarkedAt)
          VALUES (@BookingId, @ResultStatus, @HoursCompleted, @Comment, @MarkedByUserId, SYSDATETIME())
        OUTPUT INSERTED.*;
      `);

    const booking = bookingResult.recordset[0];
    const label = resultStatus === 'passed' ? 'прошел' : resultStatus === 'failed' ? 'не прошел' : 'не отмечено';

    await createNotification(
      { transaction },
      {
        userId: booking.StudentId,
        title: 'Обновлен результат занятия',
        message: `По занятию "${booking.LessonTitle}" указан результат: ${label}.`,
        channel: 'site'
      }
    );

    await transaction.commit();
    return res.json(progressResult.recordset[0]);
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => {});
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось сохранить результат занятия' });
  }
}

module.exports = {
  markBookingProgress
};
