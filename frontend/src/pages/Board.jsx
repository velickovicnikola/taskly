import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import Navbar from '../components/Navbar';
import TaskModal from '../components/TaskModal';

// Moving a task into a list with one of these names also updates its status
const STATUS_BY_LIST = {
  'to do': 'todo',
  'in progress': 'in_progress',
  done: 'completed',
};
const statusFor = (list) => STATUS_BY_LIST[list.title.trim().toLowerCase()];

const PRIORITY_STYLES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

function Column({
  list,
  index,
  lists,
  draggingId,
  dropTarget,
  onAddTask,
  onMoveTask,
  onDeleteTask,
  onDeleteList,
  onOpenTask,
  onDragStart,
  onDragEnd,
  onDragOverList,
  onDropOnList,
}) {
  const [title, setTitle] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask(list, title);
    setTitle('');
  }

  // Index where the dragged card would land, ignoring the dragged card itself
  function getDropIndex(e) {
    const cards = [...e.currentTarget.querySelectorAll('[data-card-id]')];
    let result = 0;
    for (const card of cards) {
      if (Number(card.dataset.cardId) === draggingId) continue;
      const rect = card.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) result++;
    }
    return result;
  }

  function handleDragOver(e) {
    if (draggingId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOverList(list.id, getDropIndex(e));
  }

  function handleDrop(e) {
    if (draggingId === null) return;
    e.preventDefault();
    onDropOnList(list, getDropIndex(e));
  }

  const isTarget = dropTarget !== null && dropTarget.listId === list.id;
  const othersCount = list.tasks.filter((t) => t.id !== draggingId).length;

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`w-72 shrink-0 rounded-2xl p-3 flex flex-col gap-3 ${
        isTarget ? 'bg-emerald-100/60' : 'bg-slate-200/60'
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="font-semibold text-slate-700">
          {list.title} <span className="text-slate-400 font-normal">{list.tasks.length}</span>
        </h2>
        <button
          onClick={() => onDeleteList(list)}
          className="text-slate-400 hover:text-red-500 text-lg leading-none"
          title="Delete list"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col gap-2 min-h-10">
        {list.tasks.map((task, i) => {
          const isDragged = task.id === draggingId;
          const othersBefore = list.tasks.slice(0, i).filter((t) => t.id !== draggingId).length;

          return (
            <div key={task.id}>
              {isTarget && !isDragged && dropTarget.index === othersBefore && (
                <div className="h-1 rounded bg-emerald-500 mb-2" />
              )}
              <div
                draggable
                data-card-id={task.id}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(task.id));
                  e.dataTransfer.effectAllowed = 'move';
                  onDragStart(task.id);
                }}
                onDragEnd={onDragEnd}
                className={`bg-white rounded-xl shadow-sm p-3 space-y-2 cursor-grab active:cursor-grabbing ${
                  isDragged ? 'opacity-40' : ''
                }`}
              >
                <button
                  onClick={() => onOpenTask(task)}
                  className={`block w-full text-left text-sm hover:text-emerald-600 ${
                    task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'
                  }`}
                >
                  {task.title}
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority]}`}>
                    {task.priority}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      disabled={index === 0}
                      onClick={() => onMoveTask(task, lists[index - 1])}
                      className="px-1.5 text-slate-500 hover:text-emerald-600 disabled:opacity-25"
                      title="Move left"
                    >
                      &larr;
                    </button>
                    <button
                      disabled={index === lists.length - 1}
                      onClick={() => onMoveTask(task, lists[index + 1])}
                      className="px-1.5 text-slate-500 hover:text-emerald-600 disabled:opacity-25"
                      title="Move right"
                    >
                      &rarr;
                    </button>
                    <button
                      onClick={() => onDeleteTask(task)}
                      className="px-1.5 text-slate-300 hover:text-red-500"
                      title="Delete task"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isTarget && dropTarget.index === othersCount && (
          <div className="h-1 rounded bg-emerald-500" />
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="+ Add a task"
          className="w-full rounded-lg bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </form>
    </div>
  );
}

export default function Board() {
  const { id } = useParams();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [newList, setNewList] = useState('');
  const [openTask, setOpenTask] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api(`/boards/${id}`);
      setBoard(data.board);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Runs an API action, then reloads the board
  async function run(action) {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const addList = (e) => {
    e.preventDefault();
    if (!newList.trim()) return;
    run(() => api(`/boards/${id}/lists`, { method: 'POST', body: { title: newList } }));
    setNewList('');
  };

  const deleteList = (list) => {
    if (!window.confirm(`Delete list "${list.title}"? Its tasks will stay in My Tasks.`)) return;
    run(() => api(`/lists/${list.id}`, { method: 'DELETE' }));
  };

  const addTask = (list, title) =>
    run(() =>
      api('/tasks', { method: 'POST', body: { title, list_id: list.id, status: statusFor(list) } })
    );

  const deleteTask = (task) => run(() => api(`/tasks/${task.id}`, { method: 'DELETE' }));

  // Moves a task to a list at an index: updates the screen immediately, then saves
  function moveTaskTo(taskId, targetList, index) {
    setBoard((prev) => {
      const moving = prev.lists.flatMap((l) => l.tasks).find((t) => t.id === taskId);
      if (!moving) return prev;

      const lists = prev.lists.map((l) => {
        const tasks = l.tasks.filter((t) => t.id !== taskId);
        if (l.id === targetList.id) {
          tasks.splice(index, 0, {
            ...moving,
            list_id: l.id,
            status: statusFor(l) || moving.status,
          });
        }
        return { ...l, tasks };
      });
      return { ...prev, lists };
    });

    run(() =>
      api(`/tasks/${taskId}/move`, {
        method: 'PUT',
        body: { list_id: targetList.id, index, status: statusFor(targetList) },
      })
    );
  }

  // Arrow buttons: move to the end of the neighbouring list
  const moveTask = (task, targetList) => moveTaskTo(task.id, targetList, targetList.tasks.length);

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  // Only update state when the target actually changes (dragover fires very often)
  function handleDragOverList(listId, index) {
    setDropTarget((prev) =>
      prev && prev.listId === listId && prev.index === index ? prev : { listId, index }
    );
  }

  function handleDropOnList(list, index) {
    if (draggingId !== null) moveTaskTo(draggingId, list, index);
    handleDragEnd();
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      {openTask && (
        <TaskModal task={openTask} onClose={() => setOpenTask(null)} onChanged={load} />
      )}
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/boards" className="text-sm text-slate-500 hover:text-emerald-600">
            &larr; All boards
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{board ? board.title : ''}</h1>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>
        )}

        {board && (
          <div className="flex gap-4 items-start overflow-x-auto pb-4">
            {board.lists.map((list, index) => (
              <Column
                key={list.id}
                list={list}
                index={index}
                lists={board.lists}
                draggingId={draggingId}
                dropTarget={dropTarget}
                onAddTask={addTask}
                onMoveTask={moveTask}
                onDeleteTask={deleteTask}
                onDeleteList={deleteList}
                onOpenTask={setOpenTask}
                onDragStart={setDraggingId}
                onDragEnd={handleDragEnd}
                onDragOverList={handleDragOverList}
                onDropOnList={handleDropOnList}
              />
            ))}

            <form onSubmit={addList} className="w-72 shrink-0">
              <input
                value={newList}
                onChange={(e) => setNewList(e.target.value)}
                placeholder="+ Add a list"
                className="w-full rounded-xl bg-white/70 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </form>
          </div>
        )}
      </div>
    </div>
  );
}