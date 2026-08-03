/* eslint-disable no-unused-vars */
// File: src/components/ReleaseModal.jsx
import React, { useState } from 'react';

const ReleaseModal = ({ video, onClose, onConfirm, isSeries }) => {
  const [price, setPrice] = useState(video?.price || 0);
  const [currency, setCurrency] = useState(video?.currency || 'USD');
  const [releaseAllEpisodes, setReleaseAllEpisodes] = useState(false);

  if (!video) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({ price, currency, releaseAllEpisodes });
  };

  return (
    <>
      <div className="dash-reason-header" style={{ borderBottom: '1px solid rgba(204,85,0,0.4)' }}>
        <h3>Release "{video.title}"</h3>
        <button className="dash-reason-close" onClick={onClose}>×</button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="dash-reason-body">
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc', fontSize: '0.85rem' }}>Price (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value))}
              placeholder="0.00"
              style={{
                width: '100%',
                padding: '0.7rem',
                background: '#030303',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />
            <small style={{ color: '#777', fontSize: '0.7rem' }}>Set 0 for free content</small>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc', fontSize: '0.85rem' }}>Currency</label>
            <select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                width: '100%',
                padding: '0.7rem',
                background: '#030303',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="KES">KES - Kenyan Shilling</option>
            </select>
          </div>

          {isSeries && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ccc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={releaseAllEpisodes}
                  onChange={(e) => setReleaseAllEpisodes(e.target.checked)}
                />
                Release all episodes at once
              </label>
            </div>
          )}
        </div>

        <div className="dash-reason-actions">
          <button type="button" className="dash-reason-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="dash-reason-submit">Confirm Release</button>
        </div>
      </form>
    </>
  );
};

export default ReleaseModal;