const { getPool, sql } = require('../config/db');
const { createNotification } = require('../services/notification.service');
const { ensureLessonProgressTable } = require('../services/progress.service');
const { ensureTheoryTopicsTable } = require('../services/theoryTopics.service');
const { ensureCoursesTrainingFields } = require('../services/coursesSchema.service');

async function createBooking(req, res) {
  const lessonId = Number(req.body.LessonId || req.body.lessonId);

  if (!lessonId) {
    return res.status(400).json({ message: 'Укажите занятие для записи' });
  }

  let transaction;

  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const existingResult = await new sql.Request(transaction)
      .input('StudentId', sql.Int, req.user.id)
      .input('LessonId', sql.Int, lessonId)
      .query(`
        SELECT Id, Status
        FROM dbo.Bookings WITH (UPDLOCK, HOLDLOCK)
        WHERE StudentId = @StudentId AND LessonId = @LessonId
      `);

    if (existingResult.recordset.length > 0 && existingResult.recordset[0].Status === 'active') {
      await transaction.rollback();
      return res.status(409).json({ message: 'Вы уже записаны на это занятие' });
    }

    const lessonResult = await new sql.Request(transaction)
      .input('LessonId', sql.Int, lessonId)
      .query(`
        SELECT
          l.Id,
          l.Title,
          l.Status,
          l.MaxStudents,
          (
            SELECT COUNT(*)
            FROM dbo.Bookings b WITH (UPDLOCK, HOLDLOCK)
            WHERE b.LessonId = l.Id AND b.Status = 'active'
          ) AS ActiveBookings
        FROM dbo.Lessons l WITH (UPDLOCK, HOLDLOCK)
        WHERE l.Id = @LessonId
      `);

    if (lessonResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Занятие не найдено' });
    }

    const lesson = lessonResult.recordset[0];

    if (lesson.Status !== 'available') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Запись доступна только на занятия со статусом available' });
    }

    if (Number(lesson.ActiveBookings) >= Number(lesson.MaxStudents)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'На занятии нет свободных мест' });
    }

    let booking;

    if (existingResult.recordset.length > 0 && existingResult.recordset[0].Status === 'cancelled') {
      const reactivateResult = await new sql.Request(transaction)
        .input('BookingId', sql.Int, existingResult.recordset[0].Id)
        .query(`
          UPDATE dbo.Bookings
          SET Status = 'active',
              CreatedAt = SYSDATETIME()
          OUTPUT INSERTED.*
          WHERE Id = @BookingId
        `);

      booking = reactivateResult.recordset[0];
    } else {
      const bookingResult = await new sql.Request(transaction)
        .input('StudentId', sql.Int, req.user.id)
        .input('LessonId', sql.Int, lessonId)
        .query(`
          INSERT INTO dbo.Bookings (StudentId, LessonId, Status)
          OUTPUT INSERTED.*
          VALUES (@StudentId, @LessonId, 'active')
        `);

      booking = bookingResult.recordset[0];
    }

    await createNotification(
      { transaction },
      {
        userId: req.user.id,
        title: 'Запись успешно создана',
        message: `Вы записаны на занятие "${lesson.Title}".`,
        channel: 'site'
      }
    );

    if (Number(lesson.ActiveBookings) + 1 >= Number(lesson.MaxStudents)) {
      await new sql.Request(transaction)
        .input('LessonId', sql.Int, lessonId)
        .query("UPDATE dbo.Lessons SET Status = 'full' WHERE Id = @LessonId");
    }

    await transaction.commit();

    return res.status(201).json({
      message: 'Запись успешно создана',
      booking
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => {});
    }

    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ message: 'Вы уже записаны на это занятие' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось создать запись' });
  }
}

async function cancelBooking(req, res) {
  const bookingId = Number(req.params.id);

  if (!bookingId) {
    return res.status(400).json({ message: 'Некорректный Id записи' });
  }

  let transaction;

  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const request = new sql.Request(transaction)
      .input('BookingId', sql.Int, bookingId);

    let ownerClause = '';

    if (req.user.role !== 'Admin') {
      request.input('StudentId', sql.Int, req.user.id);
      ownerClause = 'AND b.StudentId = @StudentId';
    }

    const bookingResult = await request.query(`
      SELECT
        b.Id,
        b.StudentId,
        b.LessonId,
        b.Status,
        l.Title AS LessonTitle,
        l.Status AS LessonStatus,
        l.MaxStudents
      FROM dbo.Bookings b WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN dbo.Lessons l WITH (UPDLOCK, HOLDLOCK) ON l.Id = b.LessonId
      WHERE b.Id = @BookingId ${ownerClause}
    `);

    if (bookingResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    const booking = bookingResult.recordset[0];

    if (booking.Status !== 'active') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Отменить можно только активную запись' });
    }

    await new sql.Request(transaction)
      .input('BookingId', sql.Int, bookingId)
      .query("UPDATE dbo.Bookings SET Status = 'cancelled' WHERE Id = @BookingId");

    const activeCountResult = await new sql.Request(transaction)
      .input('LessonId', sql.Int, booking.LessonId)
      .query(`
        SELECT COUNT(*) AS ActiveBookings
        FROM dbo.Bookings WITH (UPDLOCK, HOLDLOCK)
        WHERE LessonId = @LessonId AND Status = 'active'
      `);

    if (booking.LessonStatus === 'full' && Number(activeCountResult.recordset[0].ActiveBookings) < Number(booking.MaxStudents)) {
      await new sql.Request(transaction)
        .input('LessonId', sql.Int, booking.LessonId)
        .query("UPDATE dbo.Lessons SET Status = 'available' WHERE Id = @LessonId");
    }

    await createNotification(
      { transaction },
      {
        userId: booking.StudentId,
        title: 'Запись отменена',
        message: `Запись на занятие "${booking.LessonTitle}" отменена.`,
        channel: 'site'
      }
    );

    await transaction.commit();
    return res.json({ message: 'Запись отменена' });
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => {});
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось отменить запись' });
  }
}

async function getMyBookings(req, res) {
  try {
    const pool = await getPool();
    await ensureLessonProgressTable(pool);
    await ensureTheoryTopicsTable(pool);
    await ensureCoursesTrainingFields(pool);
    const result = await pool.request()
      .input('StudentId', sql.Int, req.user.id)
      .query(`
        SELECT
          b.Id,
          b.Status AS BookingStatus,
          b.CreatedAt,
          l.Id AS LessonId,
          l.Title AS LessonTitle,
          l.LessonType,
          l.TheoryTopicId,
          l.StartDateTime,
          l.EndDateTime,
          l.Status AS LessonStatus,
          c.Title AS CourseTitle,
          c.RequiredDrivingHours AS CourseRequiredDrivingHours,
          tt.Title AS TheoryTopicTitle,
          iu.FirstName AS InstructorFirstName,
          iu.LastName AS InstructorLastName,
          lp.ResultStatus,
          lp.HoursCompleted,
          lp.Comment AS ProgressComment,
          lp.MarkedAt
        FROM dbo.Bookings b
        INNER JOIN dbo.Lessons l ON l.Id = b.LessonId
        INNER JOIN dbo.Courses c ON c.Id = l.CourseId
        LEFT JOIN dbo.TheoryTopics tt ON tt.Id = l.TheoryTopicId
        LEFT JOIN dbo.Instructors i ON i.Id = l.InstructorId
        LEFT JOIN dbo.Users iu ON iu.Id = i.UserId
        LEFT JOIN dbo.LessonProgress lp ON lp.BookingId = b.Id
        WHERE b.StudentId = @StudentId
        ORDER BY l.StartDateTime DESC
      `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить ваши записи' });
  }
}

async function getBookings(req, res) {
  try {
    const pool = await getPool();
    await ensureLessonProgressTable(pool);
    await ensureTheoryTopicsTable(pool);
    await ensureCoursesTrainingFields(pool);
    const result = await pool.request().query(`
      SELECT
        b.Id,
        b.Status AS BookingStatus,
        b.CreatedAt,
        su.Id AS StudentId,
        su.FirstName AS StudentFirstName,
        su.LastName AS StudentLastName,
        su.Email AS StudentEmail,
        l.Id AS LessonId,
        l.Title AS LessonTitle,
        l.StartDateTime,
        l.EndDateTime,
        l.Status AS LessonStatus,
        l.LessonType,
        l.TheoryTopicId,
        c.Title AS CourseTitle,
        c.RequiredDrivingHours AS CourseRequiredDrivingHours,
        tt.Title AS TheoryTopicTitle,
        iu.FirstName AS InstructorFirstName,
        iu.LastName AS InstructorLastName,
        lp.ResultStatus,
        lp.HoursCompleted,
        lp.Comment AS ProgressComment,
        lp.MarkedAt
      FROM dbo.Bookings b
      INNER JOIN dbo.Users su ON su.Id = b.StudentId
      INNER JOIN dbo.Lessons l ON l.Id = b.LessonId
      INNER JOIN dbo.Courses c ON c.Id = l.CourseId
      LEFT JOIN dbo.TheoryTopics tt ON tt.Id = l.TheoryTopicId
      LEFT JOIN dbo.Instructors i ON i.Id = l.InstructorId
      LEFT JOIN dbo.Users iu ON iu.Id = i.UserId
      LEFT JOIN dbo.LessonProgress lp ON lp.BookingId = b.Id
      ORDER BY b.CreatedAt DESC
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить список записей' });
  }
}

module.exports = {
  createBooking,
  cancelBooking,
  getMyBookings,
  getBookings
};
