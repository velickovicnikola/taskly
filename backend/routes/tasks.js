const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth); // every route below requires a valid token

const STATUSES = ['todo', 'in_progress', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];

// GET /api/tasks?status=todo&priority=high&list_id=1
router.get('/', async (req, res) => {
  const { status, priority, list_id } = req.query;
  const conditions = ['user_id = $1'];
  const params = [req.userId];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    conditions.push(`priority = $${params.length}`);
  }
  if (list_id) {
    params.push(list_id);
    conditions.push(`list_id = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT * FROM tasks WHERE ${conditions.join(' AND ')}
       ORDER BY position ASC, created_at DESC`,
      params
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tasks/stats (dashboard counters)
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'todo')::int AS todo,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE status <> 'completed' AND due_date < CURRENT_DATE)::int AS overdue
       FROM tasks WHERE user_id = $1`,
      [req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tasks/progress (completed vs total tasks per board)
router.get('/progress', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.title,
         COUNT(t.id)::int AS total,
         COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed
       FROM boards b
       LEFT JOIN lists l ON l.board_id = b.id
       LEFT JOIN tasks t ON t.list_id = l.id
       WHERE b.user_id = $1
       GROUP BY b.id, b.title
       ORDER BY b.created_at DESC`,
      [req.userId]
    );
    res.json({ boards: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  const { title, description, status, priority, due_date, list_id } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority' });
  }

  try {
    // New tasks go to the end of their list (position = highest position + 1)
    const result = await pool.query(
      `INSERT INTO tasks (user_id, list_id, title, description, status, priority, due_date, position)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'todo'), COALESCE($6, 'medium'), $7,
         COALESCE((SELECT MAX(position) + 1 FROM tasks WHERE list_id = $2), 0))
       RETURNING *`,
      [req.userId, list_id || null, title.trim(), description || null, status || null, priority || null, due_date || null]
    );
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tasks/:id/move  { list_id, index, status? }
// Moves a task into a list at a given index and renumbers that list
router.put('/:id/move', async (req, res) => {
  const { list_id, index, status } = req.body;

  if (!list_id || !Number.isInteger(index) || index < 0) {
    return res.status(400).json({ message: 'list_id and a non-negative integer index are required' });
  }
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const task = await client.query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (task.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await client.query(
      `SELECT l.id FROM lists l
       JOIN boards b ON l.board_id = b.id
       WHERE l.id = $1 AND b.user_id = $2`,
      [list_id, req.userId]
    );
    if (list.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'List not found' });
    }

    // Other tasks in the target list, in their current order
    const others = await client.query(
      `SELECT id FROM tasks
       WHERE list_id = $1 AND user_id = $2 AND id <> $3
       ORDER BY position ASC, created_at ASC`,
      [list_id, req.userId, req.params.id]
    );
    const ids = others.rows.map((row) => row.id);
    ids.splice(Math.min(index, ids.length), 0, Number(req.params.id));

    await client.query('UPDATE tasks SET list_id = $1, status = COALESCE($2, status) WHERE id = $3', [
      list_id,
      status || null,
      req.params.id,
    ]);
    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [i, ids[i]]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Task moved' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/tasks/:id (partial update, only sent fields change)
router.put('/:id', async (req, res) => {
  const { title, description, status, priority, due_date, list_id } = req.body;

  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  if (priority && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority' });
  }

  try {
    const result = await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         priority = COALESCE($4, priority),
         due_date = COALESCE($5, due_date),
         list_id = COALESCE($6, list_id)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [title, description, status, priority, due_date, list_id, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;