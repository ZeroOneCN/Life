import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ThemeProvider } from './hooks/useTheme';
import './index.css';
import './styles/health.css';
import './styles/dashboard.css';
import './styles/auth.css';
import './styles/shopping.css';
import './styles/investment.css';
import './styles/schedule.css';
import 'nprogress/nprogress.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
