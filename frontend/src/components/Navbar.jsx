import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../store/authSlice';
import { checkReminders, remindersEnabled, setRemindersEnabled } from '../reminders';

export default function Navbar() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  const [enabled, setEnabled] = useState(remindersEnabled());

  // First time: ask the browser for permission
  async function enableReminders() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setRemindersEnabled(true);
      setEnabled(true);
      checkReminders();
    }
  }

  // Afterwards: switch reminders on and off inside the app
  function toggleReminders() {
    const next = !enabled;
    setRemindersEnabled(next);
    setEnabled(next);
    if (next) checkReminders();
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
          {permission === 'granted' && (
            <button
              onClick={toggleReminders}
              className={`text-xs rounded-lg border px-2.5 py-1 ${
                enabled
                  ? 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-50'
              }`}
              title="Click to turn reminders on or off"
            >
              Reminders: {enabled ? 'On' : 'Off'}
            </button>
          )}
          {permission === 'denied' && (
            <span
              className="text-xs text-slate-400"
              title="Allow notifications for this site in your browser settings (lock icon next to the address)"
            >
              Reminders blocked by browser
            </span>
          )}
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