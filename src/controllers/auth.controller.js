const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/db');

function createToken(user) {
  return jwt.sign(
    {
      id: user.Id,
      email: user.Email,
      role: user.RoleName
    },
    process.env.JWT_SECRET || 'change_me',
    { expiresIn: '8h' }
  );
}

function mapUser(user) {
  return {
    id: user.Id,
    firstName: user.FirstName,
    lastName: user.LastName,
    phone: user.Phone,
    email: user.Email,
    role: user.RoleName
  };
}

async function register(req, res) {
  try {
    const firstName = req.body.firstName || req.body.FirstName;
    const lastName = req.body.lastName || req.body.LastName;
    const phone = req.body.phone || req.body.Phone || null;
    const email = req.body.email || req.body.Email;
    const password = req.body.password || req.body.Password;

    if (!firstName || !lastName || !phone || !email || !password) {
      return res.status(400).json({ message: 'Заполните имя, фамилию, телефон, email и пароль' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
    }

    const pool = await getPool();

    const existing = await pool.request()
      .input('Email', sql.NVarChar(150), email.trim())
      .query('SELECT Id FROM dbo.Users WHERE Email = @Email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    const roleResult = await pool.request()
      .input('RoleName', sql.NVarChar(50), 'Applicant')
      .query('SELECT Id, Name FROM dbo.Roles WHERE Name = @RoleName');

    if (roleResult.recordset.length === 0) {
      return res.status(500).json({ message: 'В базе данных не найдена роль Applicant' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const role = roleResult.recordset[0];

    const insertResult = await pool.request()
      .input('FirstName', sql.NVarChar(100), firstName.trim())
      .input('LastName', sql.NVarChar(100), lastName.trim())
      .input('Phone', sql.NVarChar(30), phone)
      .input('Email', sql.NVarChar(150), email.trim())
      .input('PasswordHash', sql.NVarChar(255), passwordHash)
      .input('RoleId', sql.Int, role.Id)
      .query(`
        INSERT INTO dbo.Users (FirstName, LastName, Phone, Email, PasswordHash, RoleId)
        OUTPUT INSERTED.Id, INSERTED.FirstName, INSERTED.LastName, INSERTED.Phone, INSERTED.Email
        VALUES (@FirstName, @LastName, @Phone, @Email, @PasswordHash, @RoleId)
      `);

    const createdUser = {
      ...insertResult.recordset[0],
      RoleName: role.Name
    };

    return res.status(201).json({
      token: createToken(createdUser),
      user: mapUser(createdUser)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось зарегистрировать пользователя' });
  }
}

async function login(req, res) {
  try {
    const email = req.body.email || req.body.Email;
    const password = req.body.password || req.body.Password;

    if (!email || !password) {
      return res.status(400).json({ message: 'Введите email и пароль' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('Email', sql.NVarChar(150), email.trim())
      .query(`
        SELECT
          u.Id,
          u.FirstName,
          u.LastName,
          u.Phone,
          u.Email,
          u.PasswordHash,
          r.Name AS RoleName
        FROM dbo.Users u
        INNER JOIN dbo.Roles r ON r.Id = u.RoleId
        WHERE u.Email = @Email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const user = result.recordset[0];
    const passwordIsValid = await bcrypt.compare(password, user.PasswordHash);

    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    return res.json({
      token: createToken(user),
      user: mapUser(user)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось выполнить вход' });
  }
}

module.exports = {
  register,
  login
};
