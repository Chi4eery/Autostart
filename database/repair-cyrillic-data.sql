USE AutoSchoolDB;
GO

-- Запустите этот файл, если после выполнения seed.sql в SSMS часть русских
-- строк отображается как ????????. Это бывает, когда SQL-файл открыт не как UTF-8.

UPDATE dbo.Users
SET
    FirstName = N'Иван',
    LastName = N'Смирнов'
WHERE Email = N'student1@autostart.local';

UPDATE dbo.Courses
SET
    Title = N'Категория B',
    Description = N'Полный курс подготовки водителей легковых автомобилей: теория, практика и подготовка к экзаменационному маршруту.',
    Duration = N'3 месяца'
WHERE Price = 42000.00;

UPDATE i
SET Description = N'Специалист по подготовке к экзамену и уверенной езде в плотном потоке.'
FROM dbo.Instructors i
INNER JOIN dbo.Users u ON u.Id = i.UserId
WHERE u.Email = N'instructor2@autostart.local';

UPDATE dbo.Lessons
SET Title = N'Теория: дорожные знаки'
WHERE LessonType = N'theory'
  AND Title LIKE N'%?%';

UPDATE dbo.LearningMaterials
SET
    Title = N'Чек-лист перед экзаменом',
    Description = N'Что повторить и проверить перед практическим экзаменом.'
WHERE FileUrl = N'/materials/exam-checklist.pdf';

UPDATE dbo.Notifications
SET Message = REPLACE(Message, N'??????: ???????? ?????', N'Теория: дорожные знаки')
WHERE Message LIKE N'%??????: ???????? ?????%';
GO
