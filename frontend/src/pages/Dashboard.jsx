import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboard, addTask, updateTask, deleteTask } from '../store/tasksSlice';
import Navbar from '../components/Navbar';
import TaskModal from '../components/TaskModal';
import { TASK_COLORS } from '../colors';

// 'YYYY-MM-DD' for today in the user's local timezone
const today = () => new Date().toLocaleDateString('sv-SE');

const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const PRIORITY_STYLES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>
        {value} <span className="text-sm font-normal text-slate-400">tasks</span>
      </p>
    </div>
  );
}

function DonutChart({ data }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const segments = data.map((d, i) => {
    const before = data.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    return {
      ...d,
      length: total ? (d.value / total) * circumference : 0,
      offset: total ? (before / total) * circumference : 0,
    };
  });

  return (
    <svg viewBox="0 0 100 100" className="w-36 h-36 -rotate-90">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="16" />
      {segments.map((s) => (
        <circle
          key={s.label}
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={s.color}
          strokeWidth="16"
          strokeDasharray={`${s.length} ${circumference - s.length}`}
          strokeDashoffset={-s.offset}
        />
      ))}
    </svg>
  );
}

function ProgressBar({ value, color = 'bg-emerald-500' }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function ProgressCard({ stats, boards }) {
  const total = stats.todo + stats.in_progress + stats.completed;
  const percent = total ? Math.round((stats.completed / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 mb-4">Progress</h2>

      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-slate-600">Overall</span>
        <span className="text-sm font-semibold text-slate-800">{percent}%</span>
      </div>
      <ProgressBar value={percent} />
      <p className="text-xs text-slate-400 mt-1">
        {stats.completed} of {total} tasks completed
      </p>

      {boards.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Boards</p>
          {boards.map((board) => {
            const pct = board.total ? Math.round((board.completed / board.total) * 100) : 0;
            return (
              <div key={board.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 truncate">{board.title}</span>
                  <span className="text-slate-400">
                    {board.completed}/{board.total}
                  </span>
                </div>
                <ProgressBar value={pct} color="bg-blue-500" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { tasks, stats, progress, loading, error } = useSelector((state) => state.tasks);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [openTask, setOpenTask] = useState(null);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    dispatch(addTask({ title, priority, due_date: dueDate || null }));
    setTitle('');
    setDueDate('');
    setPriority('medium');
  }

  const todayStr = today();
  const upcoming = tasks
    .filter((t) => t.status !== 'completed' && t.due_date && t.due_date >= todayStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3);

  const chartData = [
    { label: 'Completed', value: stats.completed, color: '#10b981' },
    { label: 'In Progress', value: stats.in_progress, color: '#3b82f6' },
    { label: 'To Do', value: stats.todo, color: '#94a3b8' },
  ];

  const inputClass =
    'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      {openTask && (
        <TaskModal
          task={openTask}
          onClose={() => setOpenTask(null)}
          onChanged={() => dispatch(fetchDashboard())}
        />
      )}
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back, {user.name}!</h1>
          <p className="text-sm text-slate-500">Here's what's happening today.</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>
        )}

        {/* Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="To Do" value={stats.todo} color="text-slate-700" />
          <StatCard label="In Progress" value={stats.in_progress} color="text-blue-600" />
          <StatCard label="Completed" value={stats.completed} color="text-emerald-600" />
          <StatCard label="Overdue" value={stats.overdue} color="text-red-600" />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* My Tasks */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-4">My Tasks</h2>

            <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="New task..."
                className={`${inputClass} flex-1 min-w-40`}
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
              >
                Add
              </button>
            </form>

            {loading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks yet. Add your first one above.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tasks.map((task) => {
                  const done = task.status === 'completed';
                  const overdue = !done && task.due_date && task.due_date < todayStr;
                  return (
                    
                    <li
                      key={task.id}
                      className={`flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg ${
                        task.color ? TASK_COLORS[task.color].tint : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() =>
                          dispatch(updateTask({ id: task.id, status: done ? 'todo' : 'completed' }))
                        }
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <button
                      onClick={() => setOpenTask(task)}
                      className={`flex-1 text-left text-sm hover:text-emerald-600 ${
                        done ? 'line-through text-slate-400' : 'text-slate-700'
                      }`}
                    >
                      {task.title}
                    </button>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                      <select
                        value={task.status}
                        onChange={(e) =>
                          dispatch(updateTask({ id: task.id, status: e.target.value }))
                        }
                        className="text-xs border border-slate-200 rounded px-1 py-0.5 text-slate-600"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <span
                        className={`text-xs w-12 text-right ${
                          overdue ? 'text-red-600 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {task.due_date ? formatDate(task.due_date) : ''}
                      </span>
                      <button
                        onClick={() => dispatch(deleteTask(task.id))}
                        className="text-slate-300 hover:text-red-500 text-lg leading-none"
                        title="Delete task"
                      >
                        &times;
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Tasks Overview</h2>
              <div className="flex items-center gap-4">
                <DonutChart data={chartData} />
                <ul className="text-sm space-y-1.5">
                  {chartData.map((d) => (
                    <li key={d.label} className="flex items-center gap-2 text-slate-600">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.label}
                      <span className="ml-auto font-medium text-slate-800">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <ProgressCard stats={stats} boards={progress} />

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-400">No upcoming deadlines.</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((t) => (
                    <li key={t.id} className="text-sm">
                      <p className="text-slate-700">{t.title}</p>
                      <p className="text-xs text-slate-400">{formatDate(t.due_date)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}