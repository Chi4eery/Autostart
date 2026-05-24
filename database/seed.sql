USE AutoSchoolDB;
GO

INSERT INTO dbo.Roles (Name)
SELECT RoleName
FROM (VALUES (N'Guest'), (N'Applicant'), (N'Student'), (N'Instructor'), (N'Admin')) AS SourceRoles(RoleName)
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Roles r
    WHERE r.Name = SourceRoles.RoleName
);
GO

DECLARE @GuestRoleId INT = (SELECT Id FROM dbo.Roles WHERE Name = N'Guest');
DECLARE @ApplicantRoleId INT = (SELECT Id FROM dbo.Roles WHERE Name = N'Applicant');
DECLARE @StudentRoleId INT = (SELECT Id FROM dbo.Roles WHERE Name = N'Student');
DECLARE @InstructorRoleId INT = (SELECT Id FROM dbo.Roles WHERE Name = N'Instructor');
DECLARE @AdminRoleId INT = (SELECT Id FROM dbo.Roles WHERE Name = N'Admin');

DECLARE @PasswordHash NVARCHAR(255) = N'$2b$10$S92cK5TcrqS6hwuaNbrGLuZ74aJSk6EtoA8zx6XLrMr1jjOrgXS.e';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'admin@autostart.local')
BEGIN
    INSERT INTO dbo.Users (FirstName, LastName, Phone, Email, PasswordHash, RoleId)
    VALUES (N'Анна', N'Администратор', N'+7 900 100-00-01', N'admin@autostart.local', @PasswordHash, @AdminRoleId);
END

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'student1@autostart.local')
BEGIN
    INSERT INTO dbo.Users (FirstName, LastName, Phone, Email, PasswordHash, RoleId)
    VALUES (N'Иван', N'Смирнов', N'+7 900 200-00-01', N'student1@autostart.local', @PasswordHash, @StudentRoleId);
END

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'applicant@autostart.local')
BEGIN
    INSERT INTO dbo.Users (FirstName, LastName, Phone, Email, PasswordHash, RoleId)
    VALUES (N'Алексей', N'Иванов', N'+7 900 400-00-01', N'applicant@autostart.local', @PasswordHash, @ApplicantRoleId);
END

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'student2@autostart.local')
BEGIN
    INSERT INTO dbo.Users (FirstName, LastName, Phone, Email, PasswordHash, RoleId)
    VALUES (N'Мария', N'Кузнецова', N'+7 900 200-00-02', N'student2@autostart.local', @PasswordHash, @StudentRoleId);
END

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'instructor1@autostart.local')
BEGIN
    INSERT INTO dbo.Users (FirstName, LastName, Phone, Email, PasswordHash, RoleId)
    VALUES (N'Сергей', N'Петров', N'+7 900 300-00-01', N'instructor1@autostart.local', @PasswordHash, @InstructorRoleId);
END

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'instructor2@autostart.local')
BEGIN
    INSERT INTO dbo.Users (FirstName, LastName, Phone, Email, PasswordHash, RoleId)
    VALUES (N'Ольга', N'Волкова', N'+7 900 300-00-02', N'instructor2@autostart.local', @PasswordHash, @InstructorRoleId);
END

DECLARE @InstructorUser1 INT = (SELECT Id FROM dbo.Users WHERE Email = N'instructor1@autostart.local');
DECLARE @InstructorUser2 INT = (SELECT Id FROM dbo.Users WHERE Email = N'instructor2@autostart.local');

IF NOT EXISTS (SELECT 1 FROM dbo.Instructors WHERE UserId = @InstructorUser1)
BEGIN
    INSERT INTO dbo.Instructors (UserId, Category, ExperienceYears, Description)
    VALUES (@InstructorUser1, N'B', 9, N'Инструктор по городскому вождению и парковке. Спокойно объясняет сложные маневры.');
END

IF NOT EXISTS (SELECT 1 FROM dbo.Instructors WHERE UserId = @InstructorUser2)
BEGIN
    INSERT INTO dbo.Instructors (UserId, Category, ExperienceYears, Description)
    VALUES (@InstructorUser2, N'B, C', 12, N'Специалист по подготовке к экзамену и уверенной езде в плотном потоке.');
END

IF NOT EXISTS (SELECT 1 FROM dbo.Courses WHERE Title = N'Категория B')
BEGIN
    INSERT INTO dbo.Courses (Title, Description, Price, Duration, RequiredDrivingHours)
    VALUES (N'Категория B', N'Полный курс подготовки водителей легковых автомобилей: теория, практика и подготовка к экзаменационному маршруту.', 42000.00, N'3 месяца', 52);
END
ELSE
BEGIN
    UPDATE dbo.Courses
    SET RequiredDrivingHours = COALESCE(RequiredDrivingHours, 52)
    WHERE Title = N'Категория B';
END

IF NOT EXISTS (SELECT 1 FROM dbo.Courses WHERE Title = N'Восстановление навыков')
BEGIN
    INSERT INTO dbo.Courses (Title, Description, Price, Duration, RequiredDrivingHours)
    VALUES (N'Восстановление навыков', N'Индивидуальные занятия для водителей, которые хотят вернуть уверенность за рулем.', 12000.00, N'2 недели', 10);
END
ELSE
BEGIN
    UPDATE dbo.Courses
    SET RequiredDrivingHours = COALESCE(RequiredDrivingHours, 10)
    WHERE Title = N'Восстановление навыков';
END

DECLARE @CourseB INT = (SELECT Id FROM dbo.Courses WHERE Title = N'Категория B');
DECLARE @CourseRefresh INT = (SELECT Id FROM dbo.Courses WHERE Title = N'Восстановление навыков');
DECLARE @Instructor1 INT = (SELECT Id FROM dbo.Instructors WHERE UserId = @InstructorUser1);
DECLARE @Instructor2 INT = (SELECT Id FROM dbo.Instructors WHERE UserId = @InstructorUser2);

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

DECLARE @BaseDate DATETIME2 = CAST(CAST(SYSDATETIME() AS DATE) AS DATETIME2);
DECLARE @TopicRoadSigns INT = (SELECT Id FROM dbo.TheoryTopics WHERE Title = N'Дорожные знаки');

IF NOT EXISTS (SELECT 1 FROM dbo.Lessons WHERE Title = N'Теория: дорожные знаки')
BEGIN
    INSERT INTO dbo.Lessons (CourseId, InstructorId, TheoryTopicId, Title, LessonType, StartDateTime, EndDateTime, MaxStudents, Status)
    VALUES
    (
        @CourseB,
        NULL,
        @TopicRoadSigns,
        N'Теория: дорожные знаки',
        N'theory',
        DATEADD(HOUR, 18, DATEADD(DAY, 1, @BaseDate)),
        DATEADD(HOUR, 20, DATEADD(DAY, 1, @BaseDate)),
        20,
        N'available'
    );
END

UPDATE dbo.Lessons
SET TheoryTopicId = @TopicRoadSigns
WHERE LessonType = N'theory'
  AND TheoryTopicId IS NULL
  AND Title LIKE N'%дорожные знаки%';

IF NOT EXISTS (SELECT 1 FROM dbo.Lessons WHERE Title = N'Практика: автодром')
BEGIN
    INSERT INTO dbo.Lessons (CourseId, InstructorId, Title, LessonType, StartDateTime, EndDateTime, MaxStudents, Status)
    VALUES
    (
        @CourseB,
        @Instructor1,
        N'Практика: автодром',
        N'practice',
        DATEADD(HOUR, 10, DATEADD(DAY, 2, @BaseDate)),
        DATEADD(HOUR, 12, DATEADD(DAY, 2, @BaseDate)),
        1,
        N'available'
    );
END

IF NOT EXISTS (SELECT 1 FROM dbo.Lessons WHERE Title = N'Практика: город')
BEGIN
    INSERT INTO dbo.Lessons (CourseId, InstructorId, Title, LessonType, StartDateTime, EndDateTime, MaxStudents, Status)
    VALUES
    (
        @CourseB,
        @Instructor2,
        N'Практика: город',
        N'practice',
        DATEADD(HOUR, 14, DATEADD(DAY, 3, @BaseDate)),
        DATEADD(HOUR, 16, DATEADD(DAY, 3, @BaseDate)),
        1,
        N'available'
    );
END

IF NOT EXISTS (SELECT 1 FROM dbo.Lessons WHERE Title = N'Практика: сложные перекрестки')
BEGIN
    INSERT INTO dbo.Lessons (CourseId, InstructorId, Title, LessonType, StartDateTime, EndDateTime, MaxStudents, Status)
    VALUES
    (
        @CourseRefresh,
        @Instructor1,
        N'Практика: сложные перекрестки',
        N'practice',
        DATEADD(HOUR, 11, DATEADD(DAY, 4, @BaseDate)),
        DATEADD(HOUR, 13, DATEADD(DAY, 4, @BaseDate)),
        2,
        N'available'
    );
END

IF NOT EXISTS (SELECT 1 FROM dbo.LearningMaterials WHERE Title = N'Памятка по дорожным знакам')
BEGIN
    INSERT INTO dbo.LearningMaterials (CourseId, Title, Description, FileUrl)
    VALUES (@CourseB, N'Памятка по дорожным знакам', N'Краткий конспект по основным группам дорожных знаков.', N'/materials/road-signs.pdf');
END

IF NOT EXISTS (SELECT 1 FROM dbo.LearningMaterials WHERE Title = N'Чек-лист перед экзаменом')
BEGIN
    INSERT INTO dbo.LearningMaterials (CourseId, Title, Description, FileUrl)
    VALUES (@CourseB, N'Чек-лист перед экзаменом', N'Что повторить и проверить перед практическим экзаменом.', N'/materials/exam-checklist.pdf');
END

IF NOT EXISTS (SELECT 1 FROM dbo.LearningMaterials WHERE Title = N'Безопасная езда в городе')
BEGIN
    INSERT INTO dbo.LearningMaterials (CourseId, Title, Description, FileUrl)
    VALUES (@CourseRefresh, N'Безопасная езда в городе', N'Рекомендации по перестроениям, дистанции и прогнозированию ситуаций.', N'/materials/city-driving.pdf');
END

DECLARE @Student1 INT = (SELECT Id FROM dbo.Users WHERE Email = N'student1@autostart.local');
DECLARE @Student2 INT = (SELECT Id FROM dbo.Users WHERE Email = N'student2@autostart.local');
DECLARE @Applicant1 INT = (SELECT Id FROM dbo.Users WHERE Email = N'applicant@autostart.local');
DECLARE @TheoryLesson INT = (SELECT TOP 1 Id FROM dbo.Lessons WHERE Title = N'Теория: дорожные знаки');

IF NOT EXISTS (SELECT 1 FROM dbo.Bookings WHERE StudentId = @Student1 AND LessonId = @TheoryLesson)
BEGIN
    INSERT INTO dbo.Bookings (StudentId, LessonId, Status)
    VALUES (@Student1, @TheoryLesson, N'active');
END

IF NOT EXISTS (SELECT 1 FROM dbo.Notifications WHERE UserId = @Student1 AND Title = N'Добро пожаловать')
BEGIN
    INSERT INTO dbo.Notifications (UserId, Title, Message, Channel)
    VALUES (@Student1, N'Добро пожаловать', N'Ваш учебный график доступен в личном кабинете.', N'site');
END

IF NOT EXISTS (SELECT 1 FROM dbo.Notifications WHERE UserId = @Student1 AND Title = N'Напоминание о занятии')
BEGIN
    INSERT INTO dbo.Notifications (UserId, Title, Message, Channel)
    VALUES (@Student1, N'Напоминание о занятии', N'Не забудьте прийти на теоретическое занятие по дорожным знакам.', N'site');
END

IF NOT EXISTS (SELECT 1 FROM dbo.Notifications WHERE UserId = @Student2 AND Title = N'Материалы курса')
BEGIN
    INSERT INTO dbo.Notifications (UserId, Title, Message, Channel)
    VALUES (@Student2, N'Материалы курса', N'Для вас добавлены новые учебные материалы по безопасной езде.', N'site');
END

IF EXISTS (SELECT 1 FROM dbo.EnrollmentRequests WHERE Email = N'guest.client@example.com')
   AND NOT EXISTS (SELECT 1 FROM dbo.EnrollmentRequests WHERE Email = N'applicant@autostart.local')
BEGIN
    UPDATE dbo.EnrollmentRequests
    SET
        UserId = @Applicant1,
        FullName = N'Алексей Иванов',
        Phone = N'+7 900 400-00-01',
        Email = N'applicant@autostart.local'
    WHERE Email = N'guest.client@example.com';
END

IF NOT EXISTS (SELECT 1 FROM dbo.EnrollmentRequests WHERE Email = N'applicant@autostart.local')
BEGIN
    INSERT INTO dbo.EnrollmentRequests (UserId, CourseId, FullName, Phone, Email, Comment, Status)
    VALUES (@Applicant1, @CourseB, N'Алексей Иванов', N'+7 900 400-00-01', N'applicant@autostart.local', N'Интересует обучение в вечерней группе.', N'new');
END

IF NOT EXISTS (SELECT 1 FROM dbo.EnrollmentRequests WHERE Email = N'student2@autostart.local')
BEGIN
    INSERT INTO dbo.EnrollmentRequests (UserId, CourseId, FullName, Phone, Email, Comment, Status)
    VALUES (@Student2, @CourseRefresh, N'Мария Кузнецова', N'+7 900 200-00-02', N'student2@autostart.local', N'Хочу восстановить навыки перед экзаменом.', N'in_progress');
END

IF NOT EXISTS (SELECT 1 FROM dbo.AuditLog WHERE Action = N'Seed database')
BEGIN
    INSERT INTO dbo.AuditLog (UserId, Action, Details)
    VALUES ((SELECT Id FROM dbo.Users WHERE Email = N'admin@autostart.local'), N'Seed database', N'Добавлены стартовые роли, пользователи, курсы, занятия и материалы.');
END
GO
