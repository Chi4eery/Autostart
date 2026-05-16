const { sql } = require('../config/db');

const THEORY_TOPICS = [
  [1, 'Вводное занятие и обязанности водителя', 'Базовые обязанности водителя, документы и ответственность.'],
  [2, 'Дорожные знаки', 'Предупреждающие, запрещающие, предписывающие и информационные знаки.'],
  [3, 'Дорожная разметка', 'Горизонтальная и вертикальная разметка, особенности применения.'],
  [4, 'Приоритет проезда', 'Очередность движения и правила уступки дороги.'],
  [5, 'Маневрирование', 'Перестроение, повороты, развороты и движение задним ходом.'],
  [6, 'Остановка и стоянка', 'Правила остановки, стоянки и запреты.'],
  [7, 'Проезд перекрестков', 'Регулируемые и нерегулируемые перекрестки.'],
  [8, 'Пешеходные переходы', 'Проезд переходов и взаимодействие с пешеходами.'],
  [9, 'Скорость движения', 'Выбор скорости, ограничения и безопасная дистанция.'],
  [10, 'Безопасность и ответственность', 'Безопасное поведение на дороге и ответственность водителя.']
];

async function ensureTheoryTopicsTable(poolOrTransaction) {
  const request = typeof poolOrTransaction.request === 'function'
    ? poolOrTransaction.request()
    : new sql.Request(poolOrTransaction);

  await request.query(`
    IF OBJECT_ID(N'dbo.TheoryTopics', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TheoryTopics (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(150) NOT NULL UNIQUE,
        SortOrder INT NOT NULL,
        Description NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_TheoryTopics_IsActive DEFAULT 1
      );
    END;

    IF COL_LENGTH(N'dbo.Lessons', N'TheoryTopicId') IS NULL
    BEGIN
      ALTER TABLE dbo.Lessons ADD TheoryTopicId INT NULL;
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.foreign_keys
      WHERE name = N'FK_Lessons_TheoryTopics'
        AND parent_object_id = OBJECT_ID(N'dbo.Lessons')
    )
    BEGIN
      ALTER TABLE dbo.Lessons
      ADD CONSTRAINT FK_Lessons_TheoryTopics FOREIGN KEY (TheoryTopicId) REFERENCES dbo.TheoryTopics(Id);
    END;
  `);

  for (const [sortOrder, title, description] of THEORY_TOPICS) {
    const seedRequest = typeof poolOrTransaction.request === 'function'
      ? poolOrTransaction.request()
      : new sql.Request(poolOrTransaction);

    await seedRequest
      .input('SortOrder', sql.Int, sortOrder)
      .input('Title', sql.NVarChar(150), title)
      .input('Description', sql.NVarChar(1000), description)
      .query(`
        MERGE dbo.TheoryTopics AS target
        USING (SELECT @SortOrder AS SortOrder, @Title AS Title, @Description AS Description) AS source
        ON target.Title = source.Title
        WHEN MATCHED THEN
          UPDATE SET SortOrder = source.SortOrder, Description = source.Description, IsActive = 1
        WHEN NOT MATCHED THEN
          INSERT (SortOrder, Title, Description, IsActive)
          VALUES (source.SortOrder, source.Title, source.Description, 1);
      `);
  }

  const cleanupRequest = typeof poolOrTransaction.request === 'function'
    ? poolOrTransaction.request()
    : new sql.Request(poolOrTransaction);

  await cleanupRequest.query(`
    UPDATE dbo.TheoryTopics
    SET IsActive = 0
    WHERE Title NOT IN (
      N'Вводное занятие и обязанности водителя',
      N'Дорожные знаки',
      N'Дорожная разметка',
      N'Приоритет проезда',
      N'Маневрирование',
      N'Остановка и стоянка',
      N'Проезд перекрестков',
      N'Пешеходные переходы',
      N'Скорость движения',
      N'Безопасность и ответственность'
    );
  `);
}

module.exports = {
  ensureTheoryTopicsTable,
  THEORY_TOPICS
};
