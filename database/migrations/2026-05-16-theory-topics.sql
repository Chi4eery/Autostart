USE AutoSchoolDB;
GO

IF OBJECT_ID(N'dbo.TheoryTopics', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TheoryTopics
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(150) NOT NULL UNIQUE,
        SortOrder INT NOT NULL,
        Description NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_TheoryTopics_IsActive DEFAULT 1
    );
END
GO

IF COL_LENGTH(N'dbo.Lessons', N'TheoryTopicId') IS NULL
BEGIN
    ALTER TABLE dbo.Lessons ADD TheoryTopicId INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Lessons_TheoryTopics'
      AND parent_object_id = OBJECT_ID(N'dbo.Lessons')
)
BEGIN
    ALTER TABLE dbo.Lessons
    ADD CONSTRAINT FK_Lessons_TheoryTopics FOREIGN KEY (TheoryTopicId) REFERENCES dbo.TheoryTopics(Id);
END
GO

MERGE dbo.TheoryTopics AS target
USING (VALUES
    (1, N'Вводное занятие и обязанности водителя', N'Базовые обязанности водителя, документы и ответственность.'),
    (2, N'Дорожные знаки', N'Предупреждающие, запрещающие, предписывающие и информационные знаки.'),
    (3, N'Дорожная разметка', N'Горизонтальная и вертикальная разметка, особенности применения.'),
    (4, N'Приоритет проезда', N'Очередность движения и правила уступки дороги.'),
    (5, N'Маневрирование', N'Перестроение, повороты, развороты и движение задним ходом.'),
    (6, N'Остановка и стоянка', N'Правила остановки, стоянки и запреты.'),
    (7, N'Проезд перекрестков', N'Регулируемые и нерегулируемые перекрестки.'),
    (8, N'Пешеходные переходы', N'Проезд переходов и взаимодействие с пешеходами.'),
    (9, N'Скорость движения', N'Выбор скорости, ограничения и безопасная дистанция.'),
    (10, N'Безопасность и ответственность', N'Безопасное поведение на дороге и ответственность водителя.')
) AS source(SortOrder, Title, Description)
ON target.Title = source.Title
WHEN MATCHED THEN
    UPDATE SET SortOrder = source.SortOrder, Description = source.Description, IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (SortOrder, Title, Description, IsActive)
    VALUES (source.SortOrder, source.Title, source.Description, 1);

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
GO

UPDATE l
SET TheoryTopicId = tt.Id
FROM dbo.Lessons l
INNER JOIN dbo.TheoryTopics tt
    ON l.LessonType = N'theory'
   AND (
        LOWER(l.Title) LIKE N'%' + LOWER(tt.Title) + N'%'
        OR (tt.Title = N'Дорожные знаки' AND LOWER(l.Title) LIKE N'%знак%')
        OR (tt.Title = N'Дорожная разметка' AND LOWER(l.Title) LIKE N'%размет%')
        OR (tt.Title = N'Проезд перекрестков' AND LOWER(l.Title) LIKE N'%перекрест%')
        OR (tt.Title = N'Пешеходные переходы' AND LOWER(l.Title) LIKE N'%пешеход%')
        OR (tt.Title = N'Скорость движения' AND LOWER(l.Title) LIKE N'%скорост%')
   )
WHERE l.TheoryTopicId IS NULL
   OR l.TheoryTopicId IN (SELECT Id FROM dbo.TheoryTopics WHERE IsActive = 0)
   OR (tt.Title = N'Дорожные знаки' AND LOWER(l.Title) LIKE N'%знак%')
   OR (tt.Title = N'Дорожная разметка' AND LOWER(l.Title) LIKE N'%размет%');
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Lessons_TheoryTopicId' AND object_id = OBJECT_ID(N'dbo.Lessons'))
BEGIN
    CREATE INDEX IX_Lessons_TheoryTopicId ON dbo.Lessons(TheoryTopicId);
END
GO
