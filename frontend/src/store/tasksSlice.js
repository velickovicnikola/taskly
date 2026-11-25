import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../api';

// Loads tasks, dashboard counters and per-board progress together
export const fetchDashboard = createAsyncThunk(
  'tasks/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const [tasksData, stats, progressData] = await Promise.all([
        api('/tasks'),
        api('/tasks/stats'),
        api('/tasks/progress'),
      ]);
      return { tasks: tasksData.tasks, stats, progress: progressData.boards };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// After every change we reload the dashboard so tasks and counters stay in sync
export const addTask = createAsyncThunk(
  'tasks/add',
  async (task, { dispatch, rejectWithValue }) => {
    try {
      await api('/tasks', { method: 'POST', body: task });
      await dispatch(fetchDashboard());
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateTask = createAsyncThunk(
  'tasks/update',
  async ({ id, ...changes }, { dispatch, rejectWithValue }) => {
    try {
      await api(`/tasks/${id}`, { method: 'PUT', body: changes });
      await dispatch(fetchDashboard());
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteTask = createAsyncThunk(
  'tasks/delete',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      await api(`/tasks/${id}`, { method: 'DELETE' });
      await dispatch(fetchDashboard());
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: {
    tasks: [],
    stats: { todo: 0, in_progress: 0, completed: 0, overdue: 0 },
    progress: [],
    loading: true,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.tasks = action.payload.tasks;
        state.stats = action.payload.stats;
        state.progress = action.payload.progress;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(addTask.rejected, (state, action) => { state.error = action.payload; })
      .addCase(updateTask.rejected, (state, action) => { state.error = action.payload; })
      .addCase(deleteTask.rejected, (state, action) => { state.error = action.payload; });
  },
});

export default tasksSlice.reducer;