// FILE: frontend/src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

function ProtectedRoute({ children, requiredRole = null }) {
  const { user, isAuthReady, token } = useAppContext();

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

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;