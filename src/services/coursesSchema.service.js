const { sql } = require('../config/db');

async function ensureCoursesTrainingFields(poolOrTransaction) {
  const request = typeof poolOrTransaction.request === 'function'
    ? poolOrTransaction.request()
    : new sql.Request(poolOrTransaction);

  await request.query(`
    IF COL_LENGTH(N'dbo.Courses', N'RequiredDrivingHours') IS NULL
    BEGIN
      ALTER TABLE dbo.Courses ADD RequiredDrivingHours INT NULL;
    END;
  `);
}

module.exports = {
  ensureCoursesTrainingFields
};
