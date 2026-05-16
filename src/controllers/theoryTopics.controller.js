const { getPool } = require('../config/db');
const { ensureTheoryTopicsTable } = require('../services/theoryTopics.service');

async function getTheoryTopics(req, res) {
  try {
    const pool = await getPool();
    await ensureTheoryTopicsTable(pool);

    const result = await pool.request().query(`
      SELECT Id, Title, SortOrder, Description, IsActive
      FROM dbo.TheoryTopics
      WHERE IsActive = 1
      ORDER BY SortOrder, Id
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось получить темы теории' });
  }
}

module.exports = {
  getTheoryTopics
};
