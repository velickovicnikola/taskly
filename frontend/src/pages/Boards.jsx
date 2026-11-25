import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';

export default function Boards() {
  const [boards, setBoards] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/boards');
      setBoards(data.boards);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api('/boards', { method: 'POST', body: { title } });
      setTitle('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(board) {
    if (!window.confirm(`Delete board "${board.title}" and all its lists?`)) return;
    try {
      await api(`/boards/${board.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Boards</h1>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>
        )}

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New board name..."
            className="flex-1 max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
          >
            Create board
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-slate-400">No boards yet. Create your first one above.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {boards.map((board) => (
              <div key={board.id} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
                <Link
                  to={`/boards/${board.id}`}
                  className="font-semibold text-slate-800 hover:text-emerald-600"
                >
                  {board.title}
                </Link>
                <button
                  onClick={() => handleDelete(board)}
                  className="self-start text-xs text-slate-400 hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}