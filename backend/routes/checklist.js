const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/checklist?task_id=5
router.get('/', async (req, res) => {
  const { task_id } = req.query;
  if (!task_id) {
    return res.status(400).json({ message: 'task_id is required' });
  }

  try {
    const result = await pool.query(
      `SELECT c.* FROM checklist_items c
       JOIN tasks t ON c.task_id = t.id
       WHERE c.task_id = $1 AND t.user_id = $2
       ORDER BY c.position ASC, c.id ASC`,
      [task_id, req.userId]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/checklist  { task_id, text }
router.post('/', async (req, res) => {
  const { task_id, text } = req.body;
  if (!task_id || !text || !text.trim()) {
    return res.status(400).json({ message: 'task_id and text are required' });
  }

  try {
    const task = await pool.query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [
      task_id,
      req.userId,
    ]);
    if (task.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const result = await pool.query(
      `INSERT INTO checklist_items (task_id, text, position)
       VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM checklist_items WHERE task_id = $1), 0))
       RETURNING *`,
      [task_id, text.trim()]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/checklist/:id  { text?, done? }
router.put('/:id', async (req, res) => {
  const { text, done } = req.body;

  try {
    const result = await pool.query(
      `UPDATE checklist_items SET
         text = COALESCE($1, text),
         done = COALESCE($2, done)
       WHERE id = $3
         AND task_id IN (SELECT id FROM tasks WHERE user_id = $4)
       RETURNING *`,
      [text, done, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Checklist item not found' });
    }
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/checklist/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM checklist_items
       WHERE id = $1
         AND task_id IN (SELECT id FROM tasks WHERE user_id = $2)
       RETURNING id`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Checklist item not found' });
    }
    res.json({ message: 'Checklist item deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;