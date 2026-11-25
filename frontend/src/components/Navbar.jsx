import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../store/authSlice';
import { checkReminders } from '../reminders';

export default function Navbar() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');

  async function enableReminders() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') checkReminders();
  }

  const linkClass = ({ isActive }) =>
    `text-sm font-medium ${isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'}`;

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-6">
        <span className="text-lg font-bold text-emerald-600">Taskly</span>
        <nav className="flex gap-4">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/boards" className={linkClass}>
            Boards
          </NavLink>
          <NavLink to="/calendar" className={linkClass}>
            Calendar
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {permission === 'default' && (
            <button
              onClick={enableReminders}
              className="text-xs rounded-lg border border-emerald-600 text-emerald-700 px-2.5 py-1 hover:bg-emerald-50"
            >
              Enable reminders
            </button>
          )}
          {permission === 'granted' && <span className="text-xs text-emerald-600">Reminders on</span>}
          <span className="text-sm text-slate-500">{user?.name}</span>
          <button
            onClick={() => dispatch(logoutUser())}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}