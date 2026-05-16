const { sql } = require('../config/db');

async function ensureLessonProgressTable(poolOrTransaction) {
  const request = typeof poolOrTransaction.request === 'function'
    ? poolOrTransaction.request()
    : new sql.Request(poolOrTransaction);

  await request.query(`
    IF OBJECT_ID(N'dbo.LessonProgress', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.LessonProgress (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        BookingId INT NOT NULL UNIQUE,
        ResultStatus NVARCHAR(50) NOT NULL CONSTRAINT DF_LessonProgress_ResultStatus DEFAULT 'not_marked',
        HoursCompleted DECIMAL(5,2) NULL,
        Comment NVARCHAR(1000) NULL,
        MarkedByUserId INT NULL,
        MarkedAt DATETIME2 NULL,
        CONSTRAINT FK_LessonProgress_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings(Id),
        CONSTRAINT FK_LessonProgress_MarkedBy FOREIGN KEY (MarkedByUserId) REFERENCES dbo.Users(Id)
      );
    END
  `);
}

module.exports = {
  ensureLessonProgressTable
};
