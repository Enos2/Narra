/* eslint-disable react-hooks/exhaustive-deps */
// FILE: frontend/src/components/AuthGate.jsx
import { useEffect } from "react";
import { useAppContext } from "../context/AppContext";

function AuthGate({ children }) {
  const { isAuthReady, checkAuth } = useAppContext();

  useEffect(() => {
    checkAuth();
  }, []);

  if (!isAuthReady) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#030303',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(204, 85, 0, 0.2)',
          borderTopColor: '#cc5500',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return children;
}

export default AuthGate;