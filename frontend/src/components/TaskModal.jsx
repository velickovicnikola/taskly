import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function TaskModal({ task, onClose, onChanged }) {
  const [description, setDescription] = useState(task.description || '');
  const [savedText, setSavedText] = useState(task.description || '');
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState(null);

  const loadItems = useCallback(async () => {
    try {
      const data = await api(`/checklist?task_id=${task.id}`);
      setItems(data.items);
    } catch (err) {
      setError(err.message);
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

  // Notes are saved automatically when the text area loses focus
  async function saveNotes() {
    if (description === savedText) return;
    try {
      await api(`/tasks/${task.id}`, { method: 'PUT', body: { description } });
      setSavedText(description);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function run(action) {
    try {
      await action();
      await loadItems();
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-800">{task.title}</h2>
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

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveNotes}
            rows={4}
            placeholder="Add notes..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-slate-400 mt-1">Saved automatically when you click outside.</p>
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
        </div>
      </div>
    </div>
  );
}