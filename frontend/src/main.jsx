import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { store } from './store';
import { applyTheme, getTheme } from './theme';
import { setUnauthorizedHandler } from './api';
import { logoutUser } from './store/authSlice';

// Log the user out when the token is no longer valid
setUnauthorizedHandler(() => store.dispatch(logoutUser()));

applyTheme(getTheme()); // apply the saved theme before the first render
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>
);