import React from 'react';
import ReactDOM from 'react-dom/client';
import GenreSessionOverlay from './components/GenreSessionOverlay.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('overlay-root')).render(
  <React.StrictMode>
    <GenreSessionOverlay />
  </React.StrictMode>
);
