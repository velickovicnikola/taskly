const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth); // every route below requires a valid token

const STATUSES = ['todo', 'in_progress', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];
const COLORS = ['red', 'orange', 'amber', 'green', 'blue', 'purple', 'pink'];
const UPDATABLE_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'due_date',
  'list_id',
  'color',
  'auto_complete',
];
// Default list names that match each status (compared in lowercase)
const LIST_TITLE_BY_STATUS = { todo: 'to do', in_progress: 'in progress', completed: 'done' };

// True only if the list is on a board that belongs to this user
async function userOwnsList(listId, userId) {
  const result = await pool.query(
    `SELECT l.id FROM lists l
     JOIN boards b ON l.board_id = b.id
     WHERE l.id = $1 AND b.user_id = $2`,
    [listId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/tasks?status=todo&priority=high&list_id=1
router.get('/', async (req, res) => {
  const { status, priority, list_id } = req.query;
  const conditions = ['t.user_id = $1'];
  const params = [req.userId];

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    conditions.push(`t.priority = $${params.length}`);
  }
  if (list_id) {
    params.push(list_id);
    conditions.push(`t.list_id = $${params.length}`);
  }

  try {
    // board_id comes from the task's list (null for tasks that are not on a board)
    const result = await pool.query(
      `SELECT t.*, l.board_id
       FROM tasks t
       LEFT JOIN lists l ON t.list_id = l.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.position ASC, t.created_at DESC`,
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

// POST /api/tasks  (list_id places the task in a list; board_id uses the first list of that board)
router.post('/', async (req, res) => {
  const { title, description, status, priority, due_date, list_id, board_id } = req.body;

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
    if (list_id && !(await userOwnsList(list_id, req.userId))) {
      return res.status(404).json({ message: 'List not found' });
    }
    let targetListId = list_id || null;
    let targetStatus = status || null;

    // Board given without a list: use the first list of that board
    if (!targetListId && board_id) {
      const first = await pool.query(
        `SELECT l.id, l.title FROM lists l
         JOIN boards b ON l.board_id = b.id
         WHERE l.board_id = $1 AND b.user_id = $2
         ORDER BY l.position ASC, l.id ASC
         LIMIT 1`,
        [board_id, req.userId]
      );
      if (first.rows.length === 0) {
        return res.status(404).json({ message: 'Board not found or it has no lists' });
      }

      targetListId = first.rows[0].id;
      if (!targetStatus) {
        const listTitle = first.rows[0].title.trim().toLowerCase();
        targetStatus = STATUSES.find((s) => LIST_TITLE_BY_STATUS[s] === listTitle) || null;
      }
    }

    // New tasks go to the end of their list (position = highest position + 1)
    const result = await pool.query(
      `INSERT INTO tasks (user_id, list_id, title, description, status, priority, due_date, position)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'todo'), COALESCE($6, 'medium'), $7,
         COALESCE((SELECT MAX(position) + 1 FROM tasks WHERE list_id = $2), 0))
       RETURNING *`,
      [req.userId, targetListId, title.trim(), description || null, targetStatus, priority || null, due_date || null]
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

// PUT /api/tasks/:id/board  { board_id }  (null removes the task from its board)
router.put('/:id/board', async (req, res) => {
  const { board_id } = req.body;

  try {
    const taskResult = await pool.query(
      'SELECT id, status FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const task = taskResult.rows[0];

    // No board: the task stays in My Tasks, but is not on any board
    if (!board_id) {
      await pool.query('UPDATE tasks SET list_id = NULL, position = 0 WHERE id = $1', [task.id]);
      return res.json({ message: 'Task removed from its board' });
    }

    const lists = await pool.query(
      `SELECT l.id, l.title FROM lists l
       JOIN boards b ON l.board_id = b.id
       WHERE l.board_id = $1 AND b.user_id = $2
       ORDER BY l.position ASC, l.id ASC`,
      [board_id, req.userId]
    );
    if (lists.rows.length === 0) {
      return res.status(404).json({ message: 'Board not found or it has no lists' });
    }

    // Prefer the list that matches the task's status (To Do / In Progress / Done)
    const wantedTitle = LIST_TITLE_BY_STATUS[task.status];
    const target =
      lists.rows.find((l) => l.title.trim().toLowerCase() === wantedTitle) || lists.rows[0];

    await pool.query(
      `UPDATE tasks SET
         list_id = $1,
         position = COALESCE((SELECT MAX(position) + 1 FROM tasks WHERE list_id = $1), 0)
       WHERE id = $2`,
      [target.id, task.id]
    );

    res.json({ message: 'Task moved to board', list_id: target.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tasks/:id (partial update: only the fields that are sent change)
router.put('/:id', async (req, res) => {
  const body = req.body;
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  if (has('title') && (typeof body.title !== 'string' || !body.title.trim())) {
    return res.status(400).json({ message: 'Title cannot be empty' });
  }
  if (has('status') && !STATUSES.includes(body.status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  if (has('priority') && !PRIORITIES.includes(body.priority)) {
    return res.status(400).json({ message: 'Invalid priority' });
  }
  if (has('color') && body.color !== null && !COLORS.includes(body.color)) {
    return res.status(400).json({ message: 'Invalid color' });
  }
    if (has('auto_complete') && typeof body.auto_complete !== 'boolean') {
    return res.status(400).json({ message: 'auto_complete must be true or false' });
  }

  // Field names come from the whitelist above, values are always passed as parameters
  const sets = [];
  const params = [];
  for (const field of UPDATABLE_FIELDS) {
    if (!has(field)) continue;
    let value = body[field];
    if (field === 'title') value = value.trim();
    if (value === '') value = null; // an empty value clears the field (e.g. due date)
    params.push(value);
    sets.push(`${field} = $${params.length}`);
  }

  if (sets.length === 0) {
    return res.status(400).json({ message: 'Nothing to update' });
  }

  try {
    // null or '' removes the task from its list; any other value must be the user's own list
    if (has('list_id') && body.list_id !== null && body.list_id !== '') {
      if (!(await userOwnsList(body.list_id, req.userId))) {
        return res.status(404).json({ message: 'List not found' });
      }
    }
    // Changing the status also moves the task to the matching list on its board
    if (has('status') && !has('list_id')) {
      const target = await pool.query(
        `SELECT l2.id,
           COALESCE((SELECT MAX(position) + 1 FROM tasks WHERE list_id = l2.id), 0) AS next_position
         FROM tasks t
         JOIN lists l ON t.list_id = l.id
         JOIN lists l2 ON l2.board_id = l.board_id
         WHERE t.id = $1 AND t.user_id = $2
           AND LOWER(TRIM(l2.title)) = $3
           AND l2.id <> l.id
         LIMIT 1`,
        [req.params.id, req.userId, LIST_TITLE_BY_STATUS[body.status]]
      );

      if (target.rows.length > 0) {
        params.push(target.rows[0].id);
        sets.push(`list_id = $${params.length}`);
        params.push(target.rows[0].next_position);
        sets.push(`position = $${params.length}`);
      }
    }

    params.push(req.params.id, req.userId);

    const result = await pool.query(
      `UPDATE tasks SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params
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