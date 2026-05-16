const { getPool, sql } = require('../config/db');

function normalizeMaterialBody(body) {
  return {
    CourseId: body.CourseId ?? body.courseId ?? null,
    Title: body.Title ?? body.title,
    Description: body.Description ?? body.description ?? null,
    FileUrl: body.FileUrl ?? body.fileUrl ?? null
  };
}

async function getMaterials(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        m.Id,
        m.CourseId,
        m.Title,
        m.Description,
        m.FileUrl,
        m.CreatedAt,
        c.Title AS CourseTitle
      FROM dbo.LearningMaterials m
      LEFT JOIN dbo.Courses c ON c.Id = m.CourseId
      ORDER BY m.CreatedAt DESC
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить учебные материалы' });
  }
}

async function createMaterial(req, res) {
  try {
    const material = normalizeMaterialBody(req.body);

    if (!material.Title) {
      return res.status(400).json({ message: 'Укажите название материала' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('CourseId', sql.Int, material.CourseId ? Number(material.CourseId) : null)
      .input('Title', sql.NVarChar(150), material.Title.trim())
      .input('Description', sql.NVarChar(1000), material.Description)
      .input('FileUrl', sql.NVarChar(500), material.FileUrl)
      .query(`
        INSERT INTO dbo.LearningMaterials (CourseId, Title, Description, FileUrl)
        OUTPUT INSERTED.*
        VALUES (@CourseId, @Title, @Description, @FileUrl)
      `);

    return res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось создать учебный материал' });
  }
}

async function updateMaterial(req, res) {
  try {
    const id = Number(req.params.id);
    const material = normalizeMaterialBody(req.body);

    if (!id || !material.Title) {
      return res.status(400).json({ message: 'Укажите Id и название материала' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.Int, id)
      .input('CourseId', sql.Int, material.CourseId ? Number(material.CourseId) : null)
      .input('Title', sql.NVarChar(150), material.Title.trim())
      .input('Description', sql.NVarChar(1000), material.Description)
      .input('FileUrl', sql.NVarChar(500), material.FileUrl)
      .query(`
        UPDATE dbo.LearningMaterials
        SET CourseId = @CourseId,
            Title = @Title,
            Description = @Description,
            FileUrl = @FileUrl
        OUTPUT INSERTED.*
        WHERE Id = @Id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Материал не найден' });
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось обновить учебный материал' });
  }
}

async function deleteMaterial(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.Int, id)
      .query('DELETE FROM dbo.LearningMaterials OUTPUT DELETED.Id WHERE Id = @Id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Материал не найден' });
    }

    return res.json({ message: 'Материал удален' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось удалить учебный материал' });
  }
}

module.exports = {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial
};
