import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { TASK_COLORS } from '../colors';

export default function TaskModal({ task, onClose, onChanged }) {
  const [title, setTitle] = useState(task.title);
  const [savedTitle, setSavedTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [color, setColor] = useState(task.color || null);
  const [description, setDescription] = useState(task.description || '');
  const [savedText, setSavedText] = useState(task.description || '');
  const [autoComplete, setAutoComplete] = useState(Boolean(task.auto_complete));
  const [completed, setCompleted] = useState(task.status === 'completed');
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Loads the checklist and returns it (null if loading failed)
  const loadItems = useCallback(async () => {
    try {
      const data = await api(`/checklist?task_id=${task.id}`);
      setItems(data.items);
      return data.items;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [task.id]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Saves changed task fields, returns true on success
  async function save(changes) {
    try {
      await api(`/tasks/${task.id}`, { method: 'PUT', body: changes });
      setError(null);
      onChanged();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(savedTitle);
      return;
    }
    if (trimmed === savedTitle) return;
    if (await save({ title: trimmed })) setSavedTitle(trimmed);
  }

  async function saveNotes() {
    if (description === savedText) return;
    if (await save({ description })) setSavedText(description);
  }

  function changePriority(value) {
    setPriority(value);
    save({ priority: value });
  }

  function changeDueDate(value) {
    setDueDate(value);
    save({ due_date: value || null });
  }

  function changeColor(value) {
    setColor(value);
    save({ color: value });
  }

  // If auto-complete is on and every checklist item is done, mark the task as completed
  // With auto-complete on: all items done -> Completed, an item open again -> back to In Progress
  async function syncStatus(currentItems, enabled, allowRevert = true) {
    if (!enabled || currentItems.length === 0) return;
    const allDone = currentItems.every((item) => item.done);

    if (allDone && !completed) {
      if (await save({ status: 'completed' })) {
        setCompleted(true);
        setNotice('All checklist items are done, so the task was moved to Done.');
      }
    } else if (!allDone && completed && allowRevert) {
      if (await save({ status: 'in_progress' })) {
        setCompleted(false);
        setNotice('A checklist item is open again, so the task was moved back to In Progress.');
      }
    }
  }

  async function changeAutoComplete(value) {
    setAutoComplete(value);
    setNotice(null);

    const ok = await save({ auto_complete: value });
    if (!ok) {
      setAutoComplete(!value);
      return;
    }
    // Turning it on when everything is already checked completes the task right away
    if (value) await syncStatus(items, true, false);
  }

  // Runs a checklist change, reloads the list, then syncs the task status
  async function run(action) {
    try {
      setNotice(null);
      await action();
      const fresh = await loadItems();
      if (fresh) await syncStatus(fresh, autoComplete);
    } catch (err) {
      setError(err.message);
    }
  }

  function addItem(e) {
    e.preventDefault();
    if (!newItem.trim()) return;
    run(() => api('/checklist', { method: 'POST', body: { task_id: task.id, text: newItem } }));
    setNewItem('');
  }

  const toggleItem = (item) =>
    run(() => api(`/checklist/${item.id}`, { method: 'PUT', body: { done: !item.done } }));

  const deleteItem = (item) => run(() => api(`/checklist/${item.id}`, { method: 'DELETE' }));

  const doneCount = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const fieldClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
            }}
            className="flex-1 text-lg font-semibold text-slate-800 rounded-lg px-2 py-1 -ml-2 border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            title="Close"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
        )}

        {notice && (
          <div className="rounded-lg bg-emerald-50 text-emerald-700 text-sm px-3 py-2">
            {notice}
          </div>
        )}

        {/* Details */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => changePriority(e.target.value)}
              className={fieldClass}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Due date</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => changeDueDate(e.target.value)}
                className={fieldClass}
              />
              {dueDate && (
                <button
                  onClick={() => changeDueDate('')}
                  className="text-xs text-slate-400 hover:text-red-500 whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Color</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeColor(null)}
              title="No color"
              className={`h-6 w-6 rounded-full border-2 border-dashed border-slate-300 ${
                color === null ? 'ring-2 ring-offset-1 ring-slate-400' : ''
              }`}
            />
            {Object.entries(TASK_COLORS).map(([name, c]) => (
              <button
                key={name}
                onClick={() => changeColor(name)}
                title={name}
                className={`h-6 w-6 rounded-full ${c.dot} ${
                  color === name ? 'ring-2 ring-offset-1 ring-slate-500' : ''
                }`}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveNotes}
            rows={4}
            placeholder="Add notes..."
            className={fieldClass}
          />
          <p className="text-xs text-slate-400 mt-1">
            Everything here is saved automatically when you change it or click outside the field.
          </p>
        </div>

        {/* Checklist */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-slate-600">Checklist</label>
            {items.length > 0 && (
              <span className="text-xs text-slate-400">
                {doneCount}/{items.length}
              </span>
            )}
          </div>

          {items.length > 0 && (
            <div className="h-1.5 rounded-full bg-slate-100 mb-3 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
            </div>
          )}

          <ul className="space-y-1.5 mb-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleItem(item)}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span
                  className={`flex-1 text-sm ${
                    item.done ? 'line-through text-slate-400' : 'text-slate-700'
                  }`}
                >
                  {item.text}
                </span>
                <button
                  onClick={() => deleteItem(item)}
                  className="text-slate-300 hover:text-red-500 text-lg leading-none"
                  title="Delete item"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={addItem} className="flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add an item"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700"
            >
              Add
            </button>
          </form>

          <label className="flex items-start gap-2 text-sm text-slate-600 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={autoComplete}
              onChange={(e) => changeAutoComplete(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-600"
            />
            <span>Move this task to Done automatically when all checklist items are completed</span>
          </label>
        </div>
      </div>
    </div>
  );
}