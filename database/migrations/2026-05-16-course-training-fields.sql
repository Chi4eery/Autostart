USE AutoSchoolDB;
GO

IF COL_LENGTH(N'dbo.Courses', N'RequiredDrivingHours') IS NULL
BEGIN
    ALTER TABLE dbo.Courses ADD RequiredDrivingHours INT NULL;
END
GO

UPDATE dbo.Courses
SET RequiredDrivingHours = 52
WHERE Title = N'Категория B'
  AND RequiredDrivingHours IS NULL;
GO

UPDATE dbo.Courses
SET RequiredDrivingHours = 10
WHERE Title = N'Восстановление навыков'
  AND RequiredDrivingHours IS NULL;
GO
