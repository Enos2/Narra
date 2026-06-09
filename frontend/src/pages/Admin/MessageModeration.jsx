/**
 * pages/admin/MessageModeration.jsx
 *
 * This route now redirects to AdminMessageCenter which handles
 * both user and admin conversation moderation in one place.
 */

import { Navigate } from 'react-router-dom';

export default function MessageModeration() {
  return <Navigate to="/admin/messages" replace />;
}