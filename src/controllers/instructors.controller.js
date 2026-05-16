const { getPool, sql } = require('../config/db');
const { ensureLessonProgressTable } = require('../services/progress.service');
const { ensureTheoryTopicsTable } = require('../services/theoryTopics.service');

function normalizeInstructorBody(body) {
  return {
    UserId: body.UserId ?? body.userId,
    Category: body.Category ?? body.category ?? null,
    ExperienceYears: body.ExperienceYears ?? body.experienceYears ?? null,
    Description: body.Description ?? body.description ?? null
  };
}

async function getInstructors(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        i.Id,
        i.UserId,
        u.FirstName,
        u.LastName,
        u.Email,
        u.Phone,
        i.Category,
        i.ExperienceYears,
        i.Description
      FROM dbo.Instructors i
      INNER JOIN dbo.Users u ON u.Id = i.UserId
      ORDER BY u.LastName, u.FirstName
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить список инструкторов' });
  }
}

async function createInstructor(req, res) {
  try {
    const instructor = normalizeInstructorBody(req.body);

    if (!instructor.UserId) {
      return res.status(400).json({ message: 'Выберите пользователя для профиля инструктора' });
    }

    const pool = await getPool();
    const roleResult = await pool.request()
      .input('RoleName', sql.NVarChar(50), 'Instructor')
      .query('SELECT Id FROM dbo.Roles WHERE Name = @RoleName');

    if (roleResult.recordset.length === 0) {
      return res.status(500).json({ message: 'В базе не найдена роль Instructor' });
    }

    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      await new sql.Request(transaction)
        .input('UserId', sql.Int, Number(instructor.UserId))
        .input('RoleId', sql.Int, roleResult.recordset[0].Id)
        .query('UPDATE dbo.Users SET RoleId = @RoleId WHERE Id = @UserId');

      const result = await new sql.Request(transaction)
        .input('UserId', sql.Int, Number(instructor.UserId))
        .input('Category', sql.NVarChar(50), instructor.Category)
        .input('ExperienceYears', sql.Int, instructor.ExperienceYears ? Number(instructor.ExperienceYears) : null)
        .input('Description', sql.NVarChar(1000), instructor.Description)
        .query(`
          INSERT INTO dbo.Instructors (UserId, Category, ExperienceYears, Description)
          OUTPUT INSERTED.*
          VALUES (@UserId, @Category, @ExperienceYears, @Description)
        `);

      await transaction.commit();
      return res.status(201).json(result.recordset[0]);
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ message: 'У выбранного пользователя уже есть профиль инструктора' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось создать профиль инструктора' });
  }
}

async function updateInstructor(req, res) {
  try {
    const id = Number(req.params.id);
    const instructor = normalizeInstructorBody(req.body);

    if (!id || !instructor.UserId) {
      return res.status(400).json({ message: 'Выберите пользователя и профиль инструктора' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.Int, id)
      .input('UserId', sql.Int, Number(instructor.UserId))
      .input('Category', sql.NVarChar(50), instructor.Category)
      .input('ExperienceYears', sql.Int, instructor.ExperienceYears ? Number(instructor.ExperienceYears) : null)
      .input('Description', sql.NVarChar(1000), instructor.Description)
      .query(`
        UPDATE dbo.Instructors
        SET UserId = @UserId,
            Category = @Category,
            ExperienceYears = @ExperienceYears,
            Description = @Description
        OUTPUT INSERTED.*
        WHERE Id = @Id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Инструктор не найден' });
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ message: 'У выбранного пользователя уже есть профиль инструктора' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось обновить инструктора' });
  }
}

async function deleteInstructor(req, res) {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ message: 'Некорректный Id инструктора' });
  }

  let transaction;

  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    await new sql.Request(transaction)
      .input('InstructorId', sql.Int, id)
      .query('UPDATE dbo.Lessons SET InstructorId = NULL WHERE InstructorId = @InstructorId');

    const result = await new sql.Request(transaction)
      .input('Id', sql.Int, id)
      .query('DELETE FROM dbo.Instructors OUTPUT DELETED.Id WHERE Id = @Id');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Инструктор не найден' });
    }

    await transaction.commit();
    return res.json({ message: 'Инструктор удален' });
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => {});
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось удалить инструктора' });
  }
}

async function getMyInstructorLessons(req, res) {
  try {
    const pool = await getPool();
    await ensureLessonProgressTable(pool);
    await ensureTheoryTopicsTable(pool);
    let instructorId = null;

    if (req.user.role === 'Instructor') {
      const instructorResult = await pool.request()
        .input('UserId', sql.Int, req.user.id)
        .query('SELECT Id FROM dbo.Instructors WHERE UserId = @UserId');

      if (instructorResult.recordset.length === 0) {
        return res.status(404).json({ message: 'Профиль инструктора не найден' });
      }

      instructorId = instructorResult.recordset[0].Id;
    }

    const lessonsRequest = pool.request();
    const studentsRequest = pool.request();
    let whereClause = 'WHERE l.InstructorId IS NOT NULL';

    if (instructorId) {
      lessonsRequest.input('InstructorId', sql.Int, instructorId);
      studentsRequest.input('InstructorId', sql.Int, instructorId);
      whereClause = 'WHERE l.InstructorId = @InstructorId';
    }

    const lessonsResult = await lessonsRequest.query(`
      SELECT
        l.Id,
        l.Title,
        l.LessonType,
        l.TheoryTopicId,
        l.StartDateTime,
        l.EndDateTime,
        l.MaxStudents,
        l.Status,
        c.Title AS CourseTitle,
        tt.Title AS TheoryTopicTitle,
        tt.SortOrder AS TheoryTopicSortOrder,
        i.Id AS InstructorId,
        iu.FirstName AS InstructorFirstName,
        iu.LastName AS InstructorLastName,
        COUNT(CASE WHEN b.Status = 'active' THEN 1 END) AS BookedCount
      FROM dbo.Lessons l
      INNER JOIN dbo.Courses c ON c.Id = l.CourseId
      LEFT JOIN dbo.TheoryTopics tt ON tt.Id = l.TheoryTopicId
      LEFT JOIN dbo.Instructors i ON i.Id = l.InstructorId
      LEFT JOIN dbo.Users iu ON iu.Id = i.UserId
      LEFT JOIN dbo.Bookings b ON b.LessonId = l.Id
      ${whereClause}
      GROUP BY
        l.Id,
        l.Title,
        l.LessonType,
        l.TheoryTopicId,
        l.StartDateTime,
        l.EndDateTime,
        l.MaxStudents,
        l.Status,
        c.Title,
        tt.Title,
        tt.SortOrder,
        i.Id,
        iu.FirstName,
        iu.LastName
      ORDER BY l.StartDateTime
    `);

    const studentsResult = await studentsRequest.query(`
      SELECT
        b.Id AS BookingId,
        b.LessonId,
        u.Id AS StudentId,
        u.FirstName,
        u.LastName,
        u.Phone,
        u.Email,
        lp.ResultStatus,
        lp.HoursCompleted,
        lp.Comment AS ProgressComment,
        lp.MarkedAt
      FROM dbo.Bookings b
      INNER JOIN dbo.Users u ON u.Id = b.StudentId
      INNER JOIN dbo.Lessons l ON l.Id = b.LessonId
      LEFT JOIN dbo.LessonProgress lp ON lp.BookingId = b.Id
      ${whereClause}
        AND b.Status = 'active'
      ORDER BY l.StartDateTime, u.LastName, u.FirstName
    `);

    const studentsByLesson = studentsResult.recordset.reduce((acc, student) => {
      if (!acc[student.LessonId]) {
        acc[student.LessonId] = [];
      }

      acc[student.LessonId].push(student);
      return acc;
    }, {});

    const lessons = lessonsResult.recordset.map((lesson) => ({
      ...lesson,
      Students: studentsByLesson[lesson.Id] || []
    }));

    return res.json(lessons);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить занятия инструктора' });
  }
}

async function createMyInstructorLesson(req, res) {
  try {
    const pool = await getPool();
    await ensureTheoryTopicsTable(pool);
    const instructorResult = await pool.request()
      .input('UserId', sql.Int, req.user.id)
      .query('SELECT Id FROM dbo.Instructors WHERE UserId = @UserId');

    if (instructorResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Профиль инструктора не найден' });
    }

    const instructorId = instructorResult.recordset[0].Id;
    const lesson = {
      CourseId: req.body.CourseId ?? req.body.courseId,
      TheoryTopicId: req.body.TheoryTopicId ?? req.body.theoryTopicId ?? null,
      Title: req.body.Title ?? req.body.title,
      LessonType: req.body.LessonType ?? req.body.lessonType,
      StartDateTime: req.body.StartDateTime ?? req.body.startDateTime,
      EndDateTime: req.body.EndDateTime ?? req.body.endDateTime,
      MaxStudents: req.body.MaxStudents ?? req.body.maxStudents ?? 1,
      Status: req.body.Status ?? req.body.status ?? 'available'
    };

    if (!lesson.CourseId || !lesson.Title || !lesson.LessonType || !lesson.StartDateTime || !lesson.EndDateTime) {
      return res.status(400).json({ message: 'Заполните курс, название, тип, начало и окончание занятия' });
    }

    const start = new Date(lesson.StartDateTime);
    const end = new Date(lesson.EndDateTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Укажите корректные дату и время занятия' });
    }

    if (end <= start) {
      return res.status(400).json({ message: 'Окончание занятия должно быть позже начала' });
    }

    if (Number(lesson.MaxStudents) <= 0) {
      return res.status(400).json({ message: 'Количество мест должно быть больше 0' });
    }

    const conflictResult = await pool.request()
      .input('InstructorId', sql.Int, instructorId)
      .input('StartDateTime', sql.DateTime2, start)
      .input('EndDateTime', sql.DateTime2, end)
      .query(`
        SELECT TOP 1 Id
        FROM dbo.Lessons
        WHERE InstructorId = @InstructorId
          AND Status <> 'cancelled'
          AND StartDateTime < @EndDateTime
          AND EndDateTime > @StartDateTime
      `);

    if (conflictResult.recordset.length > 0) {
      return res.status(409).json({ message: 'Инструктор уже занят в выбранное время' });
    }

    const result = await pool.request()
      .input('CourseId', sql.Int, Number(lesson.CourseId))
      .input('InstructorId', sql.Int, instructorId)
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
    return res.status(500).json({ message: 'Не удалось создать занятие инструктора' });
  }
}

module.exports = {
  getInstructors,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  getMyInstructorLessons,
  createMyInstructorLesson
};
