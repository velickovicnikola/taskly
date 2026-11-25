const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// PUT /api/lists/:id (rename and/or change position)
router.put('/:id', async (req, res) => {
  const { title, position } = req.body;

  try {
    const result = await pool.query(
      `UPDATE lists SET
         title = COALESCE($1, title),
         position = COALESCE($2, position)
       WHERE id = $3
         AND board_id IN (SELECT id FROM boards WHERE user_id = $4)
       RETURNING *`,
      [title, position, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'List not found' });
    }
    res.json({ list: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/lists/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM lists
       WHERE id = $1
         AND board_id IN (SELECT id FROM boards WHERE user_id = $2)
       RETURNING id`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'List not found' });
    }
    res.json({ message: 'List deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;