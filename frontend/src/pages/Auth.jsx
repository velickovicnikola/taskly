import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { login, register, clearError } from '../store/authSlice';

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const error = useSelector((state) => state.auth.error);

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(clearError());
  }, [mode, dispatch]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const action = isRegister
      ? register(form)
      : login({ email: form.email, password: form.password });
    const result = await dispatch(action);
    setSubmitting(false);
    if (result.meta.requestStatus === 'fulfilled') navigate('/');
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold text-emerald-600">Taskly</h1>
        <h2 className="text-lg font-semibold text-slate-700">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h2>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
        )}

        {isRegister && (
          <input
            name="name"
            placeholder="Name"
            value={form.name}
            onChange={handleChange}
            className={inputClass}
            required
          />
        )}
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className={inputClass}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min 6 characters)"
          value={form.password}
          onChange={handleChange}
          className={inputClass}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 text-white py-2 font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Please wait...' : isRegister ? 'Sign up' : 'Log in'}
        </button>

        <p className="text-sm text-slate-500 text-center">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link
            to={isRegister ? '/login' : '/register'}
            className="text-emerald-600 font-medium hover:underline"
          >
            {isRegister ? 'Log in' : 'Sign up'}
          </Link>
        </p>
      </form>
    </div>
  );
}