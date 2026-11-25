import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api, setToken, clearToken, getToken } from '../api';

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const data = await api('/auth/login', { method: 'POST', body: credentials });
    setToken(data.token);
    return data.user;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const register = createAsyncThunk('auth/register', async (form, { rejectWithValue }) => {
  try {
    const data = await api('/auth/register', { method: 'POST', body: form });
    setToken(data.token);
    return data.user;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

// Called on app start: if a token exists, load the user it belongs to
export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
  try {
    const data = await api('/auth/me');
    return data.user;
  } catch (err) {
    clearToken();
    return rejectWithValue(err.message);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, loading: Boolean(getToken()), error: null },
  reducers: {
    logout(state) {
      state.user = null;
      state.error = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.error = null; })
      .addCase(login.fulfilled, (state, action) => { state.user = action.payload; })
      .addCase(login.rejected, (state, action) => { state.error = action.payload; })
      .addCase(register.pending, (state) => { state.error = null; })
      .addCase(register.fulfilled, (state, action) => { state.user = action.payload; })
      .addCase(register.rejected, (state, action) => { state.error = action.payload; })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(loadUser.rejected, (state) => {
        state.user = null;
        state.loading = false;
      });
  },
});

export const { logout, clearError } = authSlice.actions;

export const logoutUser = () => (dispatch) => {
  clearToken();
  dispatch(logout());
};

export default authSlice.reducer;