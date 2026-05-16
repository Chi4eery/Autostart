const { getPool, sql } = require('../config/db');
const { ensureCoursesTrainingFields } = require('../services/coursesSchema.service');

function normalizeCourseBody(body) {
  return {
    Title: body.Title ?? body.title,
    Description: body.Description ?? body.description ?? null,
    Price: body.Price ?? body.price ?? null,
    Duration: body.Duration ?? body.duration ?? null,
    RequiredDrivingHours: body.RequiredDrivingHours ?? body.requiredDrivingHours ?? null
  };
}

async function getCourses(req, res) {
  try {
    const pool = await getPool();
    await ensureCoursesTrainingFields(pool);
    const result = await pool.request().query(`
      SELECT Id, Title, Description, Price, Duration, RequiredDrivingHours
      FROM dbo.Courses
      ORDER BY Id
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить список курсов' });
  }
}

async function createCourse(req, res) {
  try {
    const course = normalizeCourseBody(req.body);

    if (!course.Title) {
      return res.status(400).json({ message: 'Укажите название курса' });
    }

    const pool = await getPool();
    await ensureCoursesTrainingFields(pool);
    const result = await pool.request()
      .input('Title', sql.NVarChar(150), course.Title.trim())
      .input('Description', sql.NVarChar(1000), course.Description)
      .input('Price', sql.Decimal(10, 2), course.Price === null || course.Price === '' ? null : Number(course.Price))
      .input('Duration', sql.NVarChar(100), course.Duration)
      .input('RequiredDrivingHours', sql.Int, course.RequiredDrivingHours === null || course.RequiredDrivingHours === '' ? null : Number(course.RequiredDrivingHours))
      .query(`
        INSERT INTO dbo.Courses (Title, Description, Price, Duration, RequiredDrivingHours)
        OUTPUT INSERTED.*
        VALUES (@Title, @Description, @Price, @Duration, @RequiredDrivingHours)
      `);

    return res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось создать курс' });
  }
}

async function updateCourse(req, res) {
  try {
    const id = Number(req.params.id);
    const course = normalizeCourseBody(req.body);

    if (!id || !course.Title) {
      return res.status(400).json({ message: 'Укажите Id и название курса' });
    }

    const pool = await getPool();
    await ensureCoursesTrainingFields(pool);
    const result = await pool.request()
      .input('Id', sql.Int, id)
      .input('Title', sql.NVarChar(150), course.Title.trim())
      .input('Description', sql.NVarChar(1000), course.Description)
      .input('Price', sql.Decimal(10, 2), course.Price === null || course.Price === '' ? null : Number(course.Price))
      .input('Duration', sql.NVarChar(100), course.Duration)
      .input('RequiredDrivingHours', sql.Int, course.RequiredDrivingHours === null || course.RequiredDrivingHours === '' ? null : Number(course.RequiredDrivingHours))
      .query(`
        UPDATE dbo.Courses
        SET Title = @Title,
            Description = @Description,
            Price = @Price,
            Duration = @Duration,
            RequiredDrivingHours = @RequiredDrivingHours
        OUTPUT INSERTED.*
        WHERE Id = @Id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось обновить курс' });
  }
}

async function deleteCourse(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.Int, id)
      .query('DELETE FROM dbo.Courses OUTPUT DELETED.Id WHERE Id = @Id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

    return res.json({ message: 'Курс удален' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось удалить курс. Проверьте связанные занятия, заявки и материалы.' });
  }
}

module.exports = {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse
};
