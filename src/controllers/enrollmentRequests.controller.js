const { getPool, sql } = require('../config/db');
const { createNotification } = require('../services/notification.service');

const REQUEST_STATUSES = new Set(['new', 'in_progress', 'approved', 'rejected']);
const REQUEST_STATUS_LABELS = {
  new: 'новая',
  in_progress: 'в работе',
  approved: 'одобрена',
  rejected: 'отклонена'
};

function normalizeRequestBody(body) {
  return {
    CourseId: body.CourseId ?? body.courseId,
    FullName: body.FullName ?? body.fullName,
    Phone: body.Phone ?? body.phone,
    Email: body.Email ?? body.email,
    Comment: body.Comment ?? body.comment ?? null
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createEnrollmentRequest(req, res) {
  try {
    const data = normalizeRequestBody(req.body);

    if (!data.CourseId) {
      return res.status(400).json({ message: 'Выберите курс' });
    }

    const pool = await getPool();
    const userProfileResult = await pool.request()
      .input('UserId', sql.Int, req.user.id)
      .query(`
        SELECT FirstName, LastName, Phone, Email
        FROM dbo.Users
        WHERE Id = @UserId
      `);

    if (userProfileResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const profile = userProfileResult.recordset[0];
    const fullName = String(data.FullName || `${profile.FirstName} ${profile.LastName}`).trim();
    const phone = String(data.Phone || profile.Phone || '').trim();
    const email = String(data.Email || profile.Email || '').trim();
    const comment = data.Comment ? String(data.Comment).trim() : null;

    if (!fullName || !phone || !email) {
      return res.status(400).json({ message: 'В профиле должны быть указаны ФИО, телефон и email' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Укажите корректный email' });
    }

    const courseResult = await pool.request()
      .input('CourseId', sql.Int, Number(data.CourseId))
      .query('SELECT Id FROM dbo.Courses WHERE Id = @CourseId');

    if (courseResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Выбранный курс не найден' });
    }

    const result = await pool.request()
      .input('UserId', sql.Int, req.user.id)
      .input('CourseId', sql.Int, Number(data.CourseId))
      .input('FullName', sql.NVarChar(200), fullName)
      .input('Phone', sql.NVarChar(30), phone)
      .input('Email', sql.NVarChar(150), email)
      .input('Comment', sql.NVarChar(1000), comment)
      .query(`
        INSERT INTO dbo.EnrollmentRequests (UserId, CourseId, FullName, Phone, Email, Comment)
        OUTPUT INSERTED.*
        VALUES (@UserId, @CourseId, @FullName, @Phone, @Email, @Comment)
      `);

    return res.status(201).json({
      message: 'Заявка отправлена. Администратор свяжется с вами',
      request: result.recordset[0]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось отправить заявку' });
  }
}

async function getMyEnrollmentRequests(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.Int, req.user.id)
      .query(`
        SELECT
          er.Id,
          er.UserId,
          er.CourseId,
          er.FullName,
          er.Phone,
          er.Email,
          er.Comment,
          er.Status,
          er.CreatedAt,
          c.Title AS CourseTitle,
          c.Price AS CoursePrice,
          c.Duration AS CourseDuration
        FROM dbo.EnrollmentRequests er
        INNER JOIN dbo.Courses c ON c.Id = er.CourseId
        WHERE er.UserId = @UserId
        ORDER BY er.CreatedAt DESC
      `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить ваши заявки на обучение' });
  }
}

async function getEnrollmentRequests(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        er.Id,
        er.UserId,
        er.CourseId,
        er.FullName,
        er.Phone,
        er.Email,
        er.Comment,
        er.Status,
        er.CreatedAt,
        c.Title AS CourseTitle,
        u.FirstName AS UserFirstName,
        u.LastName AS UserLastName,
        u.Email AS UserEmail
      FROM dbo.EnrollmentRequests er
      INNER JOIN dbo.Courses c ON c.Id = er.CourseId
      LEFT JOIN dbo.Users u ON u.Id = er.UserId
      ORDER BY er.CreatedAt DESC
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить заявки на обучение' });
  }
}

async function updateEnrollmentRequestStatus(req, res) {
  const id = Number(req.params.id);
  const status = req.body.Status || req.body.status;

  if (!id) {
    return res.status(400).json({ message: 'Некорректный Id заявки' });
  }

  if (!REQUEST_STATUSES.has(status)) {
    return res.status(400).json({ message: 'Укажите корректный статус заявки' });
  }

  let transaction;

  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const result = await new sql.Request(transaction)
      .input('Id', sql.Int, id)
      .input('Status', sql.NVarChar(50), status)
      .query(`
        UPDATE dbo.EnrollmentRequests
        SET Status = @Status
        OUTPUT INSERTED.*
        WHERE Id = @Id
      `);

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    const request = result.recordset[0];
    const userResult = await new sql.Request(transaction)
      .input('UserId', sql.Int, request.UserId)
      .input('Email', sql.NVarChar(150), request.Email)
      .query(`
        SELECT TOP 1 Id
        FROM dbo.Users
        WHERE Id = @UserId OR Email = @Email
        ORDER BY CASE WHEN Id = @UserId THEN 0 ELSE 1 END
      `);

    if (userResult.recordset.length > 0) {
      await createNotification(
        { transaction },
        {
          userId: userResult.recordset[0].Id,
          title: 'Заявка на обучение обработана',
          message: `Статус вашей заявки изменен: ${REQUEST_STATUS_LABELS[status]}.`,
          channel: 'site'
        }
      );
    }

    await transaction.commit();
    return res.json(request);
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => {});
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось изменить статус заявки' });
  }
}

async function deleteEnrollmentRequest(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.Int, id)
      .query('DELETE FROM dbo.EnrollmentRequests OUTPUT DELETED.Id WHERE Id = @Id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    return res.json({ message: 'Заявка удалена' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось удалить заявку' });
  }
}

module.exports = {
  createEnrollmentRequest,
  getMyEnrollmentRequests,
  getEnrollmentRequests,
  updateEnrollmentRequestStatus,
  deleteEnrollmentRequest
};
