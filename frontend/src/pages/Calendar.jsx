import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Navbar from '../components/Navbar';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const toKey = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const todayKey = () => new Date().toLocaleDateString('sv-SE');

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(todayKey());
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/tasks');
      setTasks(data.tasks);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // { '2026-12-01': [task, task], ... }
  const tasksByDate = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      if (!task.due_date) continue;
      if (!map[task.due_date]) map[task.due_date] = [];
      map[task.due_date].push(task);
    }
    return map;
  }, [tasks]);

  function changeMonth(delta) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function goToToday() {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(todayKey());
  }

  async function run(action) {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    run(() => api('/tasks', { method: 'POST', body: { title, due_date: selected } }));
    setTitle('');
  }

  const toggleTask = (task) =>
    run(() =>
      api(`/tasks/${task.id}`, {
        method: 'PUT',
        body: { status: task.status === 'completed' ? 'todo' : 'completed' },
      })
    );

  const deleteTask = (task) => run(() => api(`/tasks/${task.id}`, { method: 'DELETE' }));

  // Monday-first grid: empty cells before the 1st, then the days of the month
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = todayKey();
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const selectedLabel = new Date(`${selected}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const selectedTasks = tasksByDate[selected] || [];

  function chipClass(task) {
    if (task.status === 'completed') return 'bg-emerald-100 text-emerald-700 line-through';
    if (task.due_date < today) return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-700';
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Month grid */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-slate-800">{monthLabel}</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => changeMonth(-1)}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                >
                  &larr;
                </button>
                <button
                  onClick={goToToday}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                >
                  Today
                </button>
                <button
                  onClick={() => changeMonth(1)}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                >
                  &rarr;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
              {WEEKDAYS.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} />;

                const key = toKey(year, month, day);
                const dayTasks = tasksByDate[key] || [];
                const isToday = key === today;
                const isSelected = key === selected;

                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`min-h-20 rounded-lg border p-1.5 text-left align-top flex flex-col gap-1 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        isToday
                          ? 'bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center'
                          : 'text-slate-600'
                      }`}
                    >
                      {day}
                    </span>
                    {dayTasks.slice(0, 2).map((task) => (
                      <span
                        key={task.id}
                        className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate ${chipClass(task)}`}
                      >
                        {task.title}
                      </span>
                    ))}
                    {dayTasks.length > 2 && (
                      <span className="text-[10px] text-slate-400">+{dayTasks.length - 2} more</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4 self-start">
            <h2 className="font-semibold text-slate-800">{selectedLabel}</h2>

            {selectedTasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks due on this day.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {selectedTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => toggleTask(task)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'
                      }`}
                    >
                      {task.title}
                    </span>
                    <button
                      onClick={() => deleteTask(task)}
                      className="text-slate-300 hover:text-red-500 text-lg leading-none"
                      title="Delete task"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a task for this day"
                className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
    </div>
  );
}