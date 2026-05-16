IF DB_ID(N'AutoSchoolDB') IS NULL
BEGIN
    CREATE DATABASE AutoSchoolDB;
END
GO

USE AutoSchoolDB;
GO

IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Roles
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL UNIQUE
    );
END
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        FirstName NVARCHAR(100) NOT NULL,
        LastName NVARCHAR(100) NOT NULL,
        Phone NVARCHAR(30) NULL,
        Email NVARCHAR(150) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        RoleId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF OBJECT_ID(N'dbo.Instructors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Instructors
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Category NVARCHAR(50) NULL,
        ExperienceYears INT NULL,
        Description NVARCHAR(1000) NULL,
        CONSTRAINT FK_Instructors_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
        CONSTRAINT UQ_Instructors_UserId UNIQUE (UserId)
    );
END
GO

IF OBJECT_ID(N'dbo.Courses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Courses
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(150) NOT NULL,
        Description NVARCHAR(1000) NULL,
        Price DECIMAL(10,2) NULL,
        Duration NVARCHAR(100) NULL,
        RequiredDrivingHours INT NULL
    );
END
GO

IF COL_LENGTH(N'dbo.Courses', N'RequiredDrivingHours') IS NULL
BEGIN
    ALTER TABLE dbo.Courses ADD RequiredDrivingHours INT NULL;
END
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

IF OBJECT_ID(N'dbo.Lessons', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Lessons
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CourseId INT NOT NULL,
        InstructorId INT NULL,
        TheoryTopicId INT NULL,
        Title NVARCHAR(150) NOT NULL,
        LessonType NVARCHAR(50) NOT NULL,
        StartDateTime DATETIME2 NOT NULL,
        EndDateTime DATETIME2 NOT NULL,
        MaxStudents INT NOT NULL CONSTRAINT DF_Lessons_MaxStudents DEFAULT 1,
        Status NVARCHAR(50) NOT NULL CONSTRAINT DF_Lessons_Status DEFAULT N'available',
        CONSTRAINT FK_Lessons_Courses FOREIGN KEY (CourseId) REFERENCES dbo.Courses(Id),
        CONSTRAINT FK_Lessons_Instructors FOREIGN KEY (InstructorId) REFERENCES dbo.Instructors(Id),
        CONSTRAINT FK_Lessons_TheoryTopics FOREIGN KEY (TheoryTopicId) REFERENCES dbo.TheoryTopics(Id)
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

IF OBJECT_ID(N'dbo.Bookings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Bookings
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        StudentId INT NOT NULL,
        LessonId INT NOT NULL,
        Status NVARCHAR(50) NOT NULL CONSTRAINT DF_Bookings_Status DEFAULT N'active',
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Bookings_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Bookings_Users FOREIGN KEY (StudentId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_Bookings_Lessons FOREIGN KEY (LessonId) REFERENCES dbo.Lessons(Id),
        CONSTRAINT UQ_Bookings_Student_Lesson UNIQUE (StudentId, LessonId)
    );
END
GO

IF OBJECT_ID(N'dbo.LearningMaterials', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LearningMaterials
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CourseId INT NULL,
        Title NVARCHAR(150) NOT NULL,
        Description NVARCHAR(1000) NULL,
        FileUrl NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_LearningMaterials_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT FK_LearningMaterials_Courses FOREIGN KEY (CourseId) REFERENCES dbo.Courses(Id)
    );
END
GO

IF OBJECT_ID(N'dbo.LessonProgress', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LessonProgress
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        BookingId INT NOT NULL UNIQUE,
        ResultStatus NVARCHAR(50) NOT NULL CONSTRAINT DF_LessonProgress_ResultStatus DEFAULT N'not_marked',
        HoursCompleted DECIMAL(5,2) NULL,
        Comment NVARCHAR(1000) NULL,
        MarkedByUserId INT NULL,
        MarkedAt DATETIME2 NULL,
        CONSTRAINT FK_LessonProgress_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings(Id),
        CONSTRAINT FK_LessonProgress_MarkedBy FOREIGN KEY (MarkedByUserId) REFERENCES dbo.Users(Id)
    );
END
GO

IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Title NVARCHAR(150) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        Channel NVARCHAR(50) NOT NULL CONSTRAINT DF_Notifications_Channel DEFAULT N'site',
        IsRead BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
    );
END
GO

IF OBJECT_ID(N'dbo.EnrollmentRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EnrollmentRequests
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NULL,
        CourseId INT NOT NULL,
        FullName NVARCHAR(200) NOT NULL,
        Phone NVARCHAR(30) NOT NULL,
        Email NVARCHAR(150) NOT NULL,
        Comment NVARCHAR(1000) NULL,
        Status NVARCHAR(50) NOT NULL CONSTRAINT DF_EnrollmentRequests_Status DEFAULT N'new',
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_EnrollmentRequests_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT FK_EnrollmentRequests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_EnrollmentRequests_Courses FOREIGN KEY (CourseId) REFERENCES dbo.Courses(Id)
    );
END
GO

IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLog
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NULL,
        Action NVARCHAR(150) NOT NULL,
        Details NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AuditLog_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT FK_AuditLog_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_RoleId' AND object_id = OBJECT_ID(N'dbo.Users'))
BEGIN
    CREATE INDEX IX_Users_RoleId ON dbo.Users(RoleId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Lessons_StartDateTime' AND object_id = OBJECT_ID(N'dbo.Lessons'))
BEGIN
    CREATE INDEX IX_Lessons_StartDateTime ON dbo.Lessons(StartDateTime);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Lessons_TheoryTopicId' AND object_id = OBJECT_ID(N'dbo.Lessons'))
BEGIN
    CREATE INDEX IX_Lessons_TheoryTopicId ON dbo.Lessons(TheoryTopicId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Bookings_StudentId' AND object_id = OBJECT_ID(N'dbo.Bookings'))
BEGIN
    CREATE INDEX IX_Bookings_StudentId ON dbo.Bookings(StudentId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Bookings_LessonId' AND object_id = OBJECT_ID(N'dbo.Bookings'))
BEGIN
    CREATE INDEX IX_Bookings_LessonId ON dbo.Bookings(LessonId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_UserId_IsRead' AND object_id = OBJECT_ID(N'dbo.Notifications'))
BEGIN
    CREATE INDEX IX_Notifications_UserId_IsRead ON dbo.Notifications(UserId, IsRead);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EnrollmentRequests_Status_CreatedAt' AND object_id = OBJECT_ID(N'dbo.EnrollmentRequests'))
BEGIN
    CREATE INDEX IX_EnrollmentRequests_Status_CreatedAt ON dbo.EnrollmentRequests(Status, CreatedAt);
END
GO
