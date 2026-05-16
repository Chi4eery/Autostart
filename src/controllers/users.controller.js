const { getPool, sql } = require('../config/db');

function normalizeUserBody(body) {
  return {
    FirstName: body.FirstName ?? body.firstName,
    LastName: body.LastName ?? body.lastName,
    Phone: body.Phone ?? body.phone ?? null,
    Email: body.Email ?? body.email,
    RoleId: body.RoleId ?? body.roleId
  };
}

async function getUsers(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Phone,
        u.Email,
        u.RoleId,
        r.Name AS RoleName,
        u.CreatedAt
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON r.Id = u.RoleId
      ORDER BY u.CreatedAt DESC
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить список пользователей' });
  }
}

async function getRoles(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT Id, Name
      FROM dbo.Roles
      ORDER BY Id
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить роли пользователей' });
  }
}

async function getCurrentUser(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.Int, req.user.id)
      .query(`
        SELECT
          u.Id,
          u.FirstName,
          u.LastName,
          u.Phone,
          u.Email,
          u.RoleId,
          r.Name AS RoleName,
          u.CreatedAt
        FROM dbo.Users u
        INNER JOIN dbo.Roles r ON r.Id = u.RoleId
        WHERE u.Id = @UserId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить данные пользователя' });
  }
}

async function getStaffContacts(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        u.Id,
        u.FirstName,
        u.LastName,
        u.Phone,
        u.Email,
        r.Name AS RoleName,
        i.Category,
        i.ExperienceYears,
        i.Description
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON r.Id = u.RoleId
      LEFT JOIN dbo.Instructors i ON i.UserId = u.Id
      WHERE r.Name IN ('Instructor', 'Admin')
      ORDER BY
        CASE WHEN r.Name = 'Admin' THEN 0 ELSE 1 END,
        u.LastName,
        u.FirstName
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить контакты сотрудников' });
  }
}

async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);
    const user = normalizeUserBody(req.body);

    if (!id || !user.FirstName || !user.LastName || !user.Email || !user.RoleId) {
      return res.status(400).json({ message: 'Заполните имя, фамилию, email и роль пользователя' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.Int, id)
      .input('FirstName', sql.NVarChar(100), user.FirstName.trim())
      .input('LastName', sql.NVarChar(100), user.LastName.trim())
      .input('Phone', sql.NVarChar(30), user.Phone || null)
      .input('Email', sql.NVarChar(150), user.Email.trim())
      .input('RoleId', sql.Int, Number(user.RoleId))
      .query(`
        UPDATE dbo.Users
        SET FirstName = @FirstName,
            LastName = @LastName,
            Phone = @Phone,
            Email = @Email,
            RoleId = @RoleId
        OUTPUT
          INSERTED.Id,
          INSERTED.FirstName,
          INSERTED.LastName,
          INSERTED.Phone,
          INSERTED.Email,
          INSERTED.RoleId,
          INSERTED.CreatedAt
        WHERE Id = @Id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    console.error(error);
    return res.status(500).json({ message: 'Не удалось обновить пользователя' });
  }
}

module.exports = {
  getUsers,
  getRoles,
  getCurrentUser,
  getStaffContacts,
  updateUser
};
