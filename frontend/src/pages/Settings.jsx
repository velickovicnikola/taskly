import { useState } from 'react';
import { useSelector } from 'react-redux';
import Navbar from '../components/Navbar';
import { getTheme, setTheme } from '../theme';

const THEMES = [
  { value: 'light', label: 'Light', description: 'Bright background' },
  { value: 'dark', label: 'Dark', description: 'Easier on the eyes at night' },
  { value: 'system', label: 'System', description: 'Follow your device setting' },
];

export default function Settings() {
  const user = useSelector((state) => state.auth.user);
  const [theme, setThemeState] = useState(getTheme());

  function choose(value) {
    setTheme(value);
    setThemeState(value);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>

        <section className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-1">Appearance</h2>
          <p className="text-sm text-slate-500 mb-4">
            Choose how Taskly looks. This is remembered in this browser.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {THEMES.map((option) => (
              <button
                key={option.value}
                onClick={() => choose(option.value)}
                className={`text-left rounded-xl border-2 p-4 ${
                  theme === option.value
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-medium text-slate-800">{option.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Account</h2>
          <dl className="text-sm space-y-2">
            <div className="flex gap-4">
              <dt className="w-16 text-slate-500">Name</dt>
              <dd className="text-slate-800">{user.name}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-16 text-slate-500">Email</dt>
              <dd className="text-slate-800">{user.email}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}