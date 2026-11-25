import { api } from './api';

const todayKey = () => new Date().toLocaleDateString('sv-SE');

// Shows browser notifications for tasks due today and overdue tasks
export async function checkReminders() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    const { tasks } = await api('/tasks');
    const today = todayKey();
    const open = tasks.filter((t) => t.status !== 'completed' && t.due_date);
    const dueToday = open.filter((t) => t.due_date === today);
    const overdue = open.filter((t) => t.due_date < today);

    // 'tag' makes a repeated notification replace the previous one instead of piling up
    if (dueToday.length > 0) {
      new Notification('Taskly: due today', {
        body: dueToday.map((t) => t.title).join(', '),
        tag: 'taskly-due-today',
      });
    }
    if (overdue.length > 0) {
      new Notification('Taskly: overdue tasks', {
        body: overdue.map((t) => t.title).join(', '),
        tag: 'taskly-overdue',
      });
    }
  } catch (err) {
    console.error('Reminder check failed:', err.message);
  }
}