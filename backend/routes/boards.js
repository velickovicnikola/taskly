const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/boards (all boards of the user)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM boards WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ boards: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/boards (creates the board with 3 default lists)
router.post('/', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const boardResult = await client.query(
      'INSERT INTO boards (user_id, title) VALUES ($1, $2) RETURNING *',
      [req.userId, title.trim()]
    );
    const board = boardResult.rows[0];

    const defaults = ['To Do', 'In Progress', 'Done'];
    for (let i = 0; i < defaults.length; i++) {
      await client.query(
        'INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3)',
        [board.id, defaults[i], i]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ board });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/boards/:id (board with its lists and their tasks)
router.get('/:id', async (req, res) => {
  try {
    const boardResult = await pool.query(
      'SELECT * FROM boards WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (boardResult.rows.length === 0) {
      return res.status(404).json({ message: 'Board not found' });
    }

    const lists = await pool.query(
      'SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC',
      [req.params.id]
    );
    const tasks = await pool.query(
      `SELECT t.*, l.board_id FROM tasks t
       JOIN lists l ON t.list_id = l.id
       WHERE l.board_id = $1 AND t.user_id = $2
       ORDER BY t.position ASC, t.created_at ASC`,
      [req.params.id, req.userId]
    );

    const listsWithTasks = lists.rows.map((list) => ({
      ...list,
      tasks: tasks.rows.filter((t) => t.list_id === list.id),
    }));

    res.json({ board: { ...boardResult.rows[0], lists: listsWithTasks } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/boards/:id (rename)
router.put('/:id', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE boards SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [title.trim(), req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Board not found' });
    }
    res.json({ board: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/boards/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM boards WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Board not found' });
    }
    res.json({ message: 'Board deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/boards/:id/lists (add a list to a board)
router.post('/:id/lists', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const board = await pool.query(
      'SELECT id FROM boards WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (board.rows.length === 0) {
      return res.status(404).json({ message: 'Board not found' });
    }

    const result = await pool.query(
      `INSERT INTO lists (board_id, title, position)
       VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM lists WHERE board_id = $1), 0))
       RETURNING *`,
      [req.params.id, title.trim()]
    );
    res.status(201).json({ list: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;