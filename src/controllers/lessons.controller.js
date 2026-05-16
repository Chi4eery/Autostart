const { getPool, sql } = require('../config/db');
const { notifyLessonStudents } = require('../services/notification.service');
const { ensureLessonProgressTable } = require('../services/progress.service');
const { ensureTheoryTopicsTable } = require('../services/theoryTopics.service');
const { ensureCoursesTrainingFields } = require('../services/coursesSchema.service');

function normalizeLessonBody(body) {
  return {
    CourseId: body.CourseId ?? body.courseId,
    InstructorId: body.InstructorId ?? body.instructorId ?? null,
    TheoryTopicId: body.TheoryTopicId ?? body.theoryTopicId ?? null,
    Title: body.Title ?? body.title,
    LessonType: body.LessonType ?? body.lessonType,
    StartDateTime: body.StartDateTime ?? body.startDateTime,
    EndDateTime: body.EndDateTime ?? body.endDateTime,
    MaxStudents: body.MaxStudents ?? body.maxStudents ?? 1,
    Status: body.Status ?? body.status ?? 'available'
  };
}

function validateLesson(lesson) {
  if (!lesson.CourseId || !lesson.Title || !lesson.LessonType || !lesson.StartDateTime || !lesson.EndDateTime) {
    return 'Заполните курс, название, тип, начало и окончание занятия';
  }

  const start = new Date(lesson.StartDateTime);
  const end = new Date(lesson.EndDateTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Укажите корректные дату и время занятия';
  }

  if (end <= start) {
    return 'Дата окончания занятия должна быть позже даты начала';
  }

  if (Number(lesson.MaxStudents) <= 0) {
    return 'Количество мест должно быть больше 0';
  }

  return null;
}

async function instructorHasConflict(request, instructorId, start, end, lessonId = null) {
  if (!instructorId) {
    return false;
  }

  request
    .input('InstructorId', sql.Int, Number(instructorId))
    .input('StartDateTime', sql.DateTime2, start)
    .input('EndDateTime', sql.DateTime2, end);

  if (lessonId) {
    request.input('LessonId', sql.Int, lessonId);
  }

  const result = await request.query(`
    SELECT TOP 1 Id
    FROM dbo.Lessons
    WHERE InstructorId = @InstructorId
      AND Status <> 'cancelled'
      AND StartDateTime < @EndDateTime
      AND EndDateTime > @StartDateTime
      ${lessonId ? 'AND Id <> @LessonId' : ''}
  `);

  return result.recordset.length > 0;
}

async function getLessons(req, res) {
  try {
    const pool = await getPool();
    await ensureCoursesTrainingFields(pool);
    await ensureTheoryTopicsTable(pool);
    const result = await pool.request().query(`
      SELECT
        l.Id,
        l.CourseId,
        l.InstructorId,
        l.TheoryTopicId,
        l.Title,
        l.LessonType,
        l.StartDateTime,
        l.EndDateTime,
        l.MaxStudents,
        l.Status,
        c.Title AS CourseTitle,
        c.RequiredDrivingHours AS CourseRequiredDrivingHours,
        tt.Title AS TheoryTopicTitle,
        tt.SortOrder AS TheoryTopicSortOrder,
        iu.FirstName AS InstructorFirstName,
        iu.LastName AS InstructorLastName,
        COUNT(CASE WHEN b.Status = 'active' THEN 1 END) AS ActiveBookings
      FROM dbo.Lessons l
      INNER JOIN dbo.Courses c ON c.Id = l.CourseId
      LEFT JOIN dbo.TheoryTopics tt ON tt.Id = l.TheoryTopicId
      LEFT JOIN dbo.Instructors i ON i.Id = l.InstructorId
      LEFT JOIN dbo.Users iu ON iu.Id = i.UserId
      LEFT JOIN dbo.Bookings b ON b.LessonId = l.Id
      GROUP BY
        l.Id,
        l.CourseId,
        l.InstructorId,
        l.TheoryTopicId,
        l.Title,
        l.LessonType,
        l.StartDateTime,
        l.EndDateTime,
        l.MaxStudents,
        l.Status,
        c.Title,
        c.RequiredDrivingHours,
        tt.Title,
        tt.SortOrder,
        iu.FirstName,
        iu.LastName
      ORDER BY l.StartDateTime
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить расписание занятий' });
  }
}

async function createLesson(req, res) {
  try {
    const lesson = normalizeLessonBody(req.body);
    const validationError = validateLesson(lesson);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const start = new Date(lesson.StartDateTime);
    const end = new Date(lesson.EndDateTime);
    const pool = await getPool();
    await ensureTheoryTopicsTable(pool);

    const hasConflict = await instructorHasConflict(pool.request(), lesson.InstructorId, start, end);

    if (hasConflict) {
      return res.status(409).json({ message: 'Инструктор уже занят в выбранное время' });
    }

    const result = await pool.request()
      .input('CourseId', sql.Int, Number(lesson.CourseId))
      .input('InstructorId', sql.Int, lesson.InstructorId ? Number(lesson.InstructorId) : null)
      .input('TheoryTopicId', sql.Int, lesson.TheoryTopicId ? Number(lesson.TheoryTopicId) : null)
      .input('Title', sql.NVarChar(150), lesson.Title.trim())
      .input('LessonType', sql.NVarChar(50), lesson.LessonType)
      .input('StartDateTime', sql.DateTime2, start)
      .input('EndDateTime', sql.DateTime2, end)
      .input('MaxStudents', sql.Int, Number(lesson.MaxStudents))
      .input('Status', sql.NVarChar(50), lesson.Status)
      .query(`
        INSERT INTO dbo.Lessons
          (CourseId, InstructorId, TheoryTopicId, Title, LessonType, StartDateTime, EndDateTime, MaxStudents, Status)
        OUTPUT INSERTED.*
        VALUES
          (@CourseId, @InstructorId, @TheoryTopicId, @Title, @LessonType, @StartDateTime, @EndDateTime, @MaxStudents, @Status)
      `);

    return res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось создать занятие' });
  }
}

async function updateLesson(req, res) {
  const id = Number(req.params.id);
  const lesson = normalizeLessonBody(req.body);
  const validationError = validateLesson(lesson);

  if (!id) {
    return res.status(400).json({ message: 'Некорректный Id занятия' });
  }

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  let transaction;

  try {
    const start = new Date(lesson.StartDateTime);
    const end = new Date(lesson.EndDateTime);
    const pool = await getPool();
    await ensureTheoryTopicsTable(pool);

    const hasConflict = await instructorHasConflict(pool.request(), lesson.InstructorId, start, end, id);

    if (hasConflict) {
      return res.status(409).json({ message: 'Инструктор уже занят в выбранное время' });
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const result = await new sql.Request(transaction)
      .input('Id', sql.Int, id)
      .input('CourseId', sql.Int, Number(lesson.CourseId))
      .input('InstructorId', sql.Int, lesson.InstructorId ? Number(lesson.InstructorId) : null)
      .input('TheoryTopicId', sql.Int, lesson.TheoryTopicId ? Number(lesson.TheoryTopicId) : null)
      .input('Title', sql.NVarChar(150), lesson.Title.trim())
      .input('LessonType', sql.NVarChar(50), lesson.LessonType)
      .input('StartDateTime', sql.DateTime2, start)
      .input('EndDateTime', sql.DateTime2, end)
      .input('MaxStudents', sql.Int, Number(lesson.MaxStudents))
      .input('Status', sql.NVarChar(50), lesson.Status)
      .query(`
        UPDATE dbo.Lessons
        SET CourseId = @CourseId,
            InstructorId = @InstructorId,
            TheoryTopicId = @TheoryTopicId,
            Title = @Title,
            LessonType = @LessonType,
            StartDateTime = @StartDateTime,
            EndDateTime = @EndDateTime,
            MaxStudents = @MaxStudents,
            Status = @Status
        OUTPUT INSERTED.*
        WHERE Id = @Id
      `);

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Занятие не найдено' });
    }

    await notifyLessonStudents(
      { transaction },
      id,
      'Занятие изменено',
      `Занятие "${lesson.Title}" было обновлено. Проверьте актуальное расписание в личном кабинете.`
    );

    await transaction.commit();
    return res.json(result.recordset[0]);
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => {});
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось обновить занятие' });
  }
}

async function deleteLesson(req, res) {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ message: 'Некорректный Id занятия' });
  }

  let transaction;

  try {
    const pool = await getPool();
    await ensureLessonProgressTable(pool);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const lessonResult = await new sql.Request(transaction)
      .input('Id', sql.Int, id)
      .query('SELECT Title FROM dbo.Lessons WHERE Id = @Id');

    if (lessonResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Занятие не найдено' });
    }

    await notifyLessonStudents(
      { transaction },
      id,
      'Занятие удалено',
      `Занятие "${lessonResult.recordset[0].Title}" удалено из расписания.`
    );

    await new sql.Request(transaction)
      .input('LessonId', sql.Int, id)
      .query(`
        DELETE lp
        FROM dbo.LessonProgress lp
        INNER JOIN dbo.Bookings b ON b.Id = lp.BookingId
        WHERE b.LessonId = @LessonId;

        DELETE FROM dbo.Bookings WHERE LessonId = @LessonId;
      `);

    await new sql.Request(transaction)
      .input('Id', sql.Int, id)
      .query('DELETE FROM dbo.Lessons WHERE Id = @Id');

    await transaction.commit();
    return res.json({ message: 'Занятие удалено' });
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => {});
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось удалить занятие' });
  }
}

module.exports = {
  getLessons,
  createLesson,
  updateLesson,
  deleteLesson
};
