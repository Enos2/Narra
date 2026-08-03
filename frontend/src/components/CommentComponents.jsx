/* eslint-disable react-refresh/only-export-components */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-undef */
/**
 * DROP-IN replacement for CommentNode and CommentSection in VideoDetails.jsx
 *
 * Also update the import at the top of VideoDetails.jsx:
 *   import { ..., likeComment, dislikeComment } from "../requests";
 *                               ^^^^^^^^^^^^^^ add this
 *
 * And in the CommentSection usage at the bottom of VideoDetails.jsx,
 * make sure you still pass videoCreatorId={video.creator?._id}
 */

/* ─── Comment Node (recursive — handles unlimited reply depth) ─── */
function CommentNode({
  comment,
  depth,
  videoCreatorId,
  currentUser,
  token,
  onDelete,
  onLike,
  onDislike,
  onReplySubmit,
  addNotification,
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const replyTextareaRef = useRef(null);

  const commentName = getDisplayName(comment.user);
  const commentAvatar = getAvatarUrl(comment.user?.avatar, commentName);
  const hasReplies = Array.isArray(comment.replies) && comment.replies.length > 0;

  // Who can delete?
  // - the comment's author
  // - the video creator (owner)
  // - admins (handled server-side, but we can show the button for creators too)
  const isOwnComment =
    currentUser && comment.user?._id && currentUser._id === comment.user._id.toString();
  const isVideoOwner =
    currentUser &&
    videoCreatorId &&
    currentUser._id === videoCreatorId.toString();
  const canDelete = !!token && (isOwnComment || isVideoOwner);

  const isCreator =
    videoCreatorId &&
    comment.user?._id &&
    videoCreatorId.toString() === comment.user._id.toString();

  const replyToName = comment.replyToUser ? getDisplayName(comment.replyToUser) : null;
  const likeCount = comment.likeCount ?? (comment.likes?.length || 0);
  const dislikeCount = comment.dislikeCount ?? (comment.dislikes?.length || 0);

  /* ── submit a reply ── */
  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      // Pass THIS comment's _id as the parent, and THIS comment's user as replyToUser
      await onReplySubmit(
        comment._id,           // parentCommentId
        comment.user?._id,     // replyToUserId
        commentName,           // for the success notification
        replyText.trim()
      );
      setReplyText('');
      setShowReplyInput(false);
      setExpanded(true);
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Failed to post reply' });
    } finally {
      setSubmitting(false);
    }
  };

  /* stop keyboard events bubbling to the video player */
  const stopKeys = (e) => e.stopPropagation();

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && e.ctrlKey) handleReply();
  };

  const openReplyBox = () => {
    setShowReplyInput(true);
    setTimeout(() => replyTextareaRef.current?.focus(), 60);
  };

  return (
    <div className={`vd-comment-node ${depth > 0 ? 'vd-comment-reply-node' : ''}`}>
      {/* ── Comment row ── */}
      <div className="vd-comment-row">
        <img
          src={commentAvatar}
          alt=""
          className={`vd-comment-avatar ${depth > 0 ? 'vd-comment-avatar-sm' : ''}`}
        />

        <div className="vd-comment-content">
          {/* Header */}
          <div className="vd-comment-meta">
            <span className="vd-comment-author">{commentName}</span>
            {comment.user?.isVerified && (
              <span className="vd-badge-verified" title="Verified">✓</span>
            )}
            {isCreator && (
              <span className="vd-badge-creator">CREATOR</span>
            )}
            <span className="vd-comment-timestamp">{timeAgo(comment.createdAt)}</span>
            {comment.isEdited && (
              <span className="vd-comment-edited">(edited)</span>
            )}
          </div>

          {/* "Replying to @name" */}
          {replyToName && (
            <div className="vd-reply-to-indicator">
              <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                <path d="M6.5 3.5L2 8l4.5 4.5V9H10c1.93 0 3 .96 3 3v.5h1.5V12c0-2.76-1.74-4.5-4.5-4.5H6.5V3.5z" />
              </svg>
              replying to <strong>@{replyToName}</strong>
            </div>
          )}

          {/* Text */}
          <p className="vd-comment-text">{comment.content}</p>

          {/* Actions */}
          <div className="vd-comment-actions">
            {/* Like */}
            <button
              className="vd-ca-btn vd-ca-like"
              onClick={() => onLike(comment._id)}
              title="Like"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              {likeCount > 0 && <span>{formatNumber(likeCount)}</span>}
            </button>

            {/* Dislike */}
            <button
              className="vd-ca-btn vd-ca-dislike"
              onClick={() => onDislike(comment._id)}
              title="Dislike"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
              {dislikeCount > 0 && <span>{formatNumber(dislikeCount)}</span>}
            </button>

            {/* Reply */}
            {token && (
              <button className="vd-ca-btn vd-ca-reply" onClick={openReplyBox}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Reply
              </button>
            )}

            {/* Delete */}
            {canDelete && (
              <button
                className="vd-ca-btn vd-ca-delete"
                onClick={() => onDelete(comment._id)}
                title="Delete comment"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete
              </button>
            )}

            {/* Toggle replies */}
            {hasReplies && (
              <button
                className="vd-ca-btn vd-ca-toggle"
                onClick={() => setExpanded(!expanded)}
              >
                <span className={`vd-toggle-arrow ${expanded ? 'vd-toggle-up' : ''}`}>▾</span>
                {expanded ? 'Hide' : 'Show'} {comment.replies.length}{' '}
                {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>

          {/* Inline reply input */}
          {showReplyInput && (
            <div className="vd-inline-reply">
              <img
                src={getAvatarUrl(currentUser?.avatar, getDisplayName(currentUser))}
                alt=""
                className="vd-reply-input-avatar"
              />
              <div className="vd-reply-input-wrap">
                <textarea
                  ref={replyTextareaRef}
                  placeholder={`Reply to ${commentName}…`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={stopKeys}
                  onKeyPress={stopKeys}
                  onClick={stopKeys}
                  rows={2}
                />
                <div className="vd-reply-input-actions">
                  <span className="vd-reply-hint">Ctrl+Enter to post</span>
                  <button
                    className="vd-btn-cancel"
                    onClick={() => { setShowReplyInput(false); setReplyText(''); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="vd-btn-post"
                    onClick={handleReply}
                    disabled={submitting || !replyText.trim()}
                  >
                    {submitting ? 'Posting…' : 'Post Reply'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Nested replies ── */}
      {hasReplies && expanded && (
        <div className="vd-comment-children">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply._id}
              comment={reply}
              depth={depth + 1}
              videoCreatorId={videoCreatorId}
              currentUser={currentUser}
              token={token}
              onDelete={onDelete}
              onLike={onLike}
              onDislike={onDislike}
              onReplySubmit={onReplySubmit}
              addNotification={addNotification}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Comment Section ─── */
function CommentSection({
  videoId,
  token,
  user,
  hasAccess,
  isPaid,
  onPurchase,
  addNotification,
  videoCreatorId,
}) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const newCommentRef = useRef(null);

  /* ── load ── */
  const loadComments = useCallback(async () => {
    try {
      const fetched = await getVideoComments(videoId);
      setComments(Array.isArray(fetched) ? fetched : []);
    } catch (err) {
      console.error('loadComments error:', err);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  /* ── post top-level comment ── */
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    if (!token) {
      addNotification({ type: 'error', message: 'Please sign in to comment' });
      return;
    }
    setSubmitting(true);
    try {
      // parentCommentId = null → top-level comment
      await addComment(token, videoId, newComment.trim(), null, null);
      setNewComment('');
      await loadComments();
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Failed to post comment' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── post reply ── */
  // Called by CommentNode with (parentCommentId, replyToUserId, replyToUserName, content)
  const handleSubmitReply = async (parentCommentId, replyToUserId, replyToUserName, content) => {
    if (!token) {
      addNotification({ type: 'error', message: 'Please sign in to reply' });
      return;
    }
    if (!content?.trim()) return;

    // addComment detects it's a reply because parentCommentId is not null
    await addComment(token, videoId, content.trim(), parentCommentId, replyToUserId);
    addNotification({ type: 'success', message: `Replied to ${replyToUserName}` });
    await loadComments();
  };

  /* ── delete ── */
  const handleDeleteComment = async (commentId) => {
    if (!token) return;
    try {
      await deleteComment(token, commentId);
      addNotification({ type: 'success', message: 'Comment deleted' });
      await loadComments();
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Failed to delete' });
    }
  };

  /* ── like ── */
  const handleLikeComment = async (commentId) => {
    if (!token) {
      addNotification({ type: 'info', message: 'Sign in to like comments' });
      return;
    }
    try {
      await likeComment(token, commentId);
      await loadComments();
    } catch (err) {
      console.error('likeComment error:', err);
    }
  };

  /* ── dislike ── */
  const handleDislikeComment = async (commentId) => {
    if (!token) {
      addNotification({ type: 'info', message: 'Sign in to react to comments' });
      return;
    }
    try {
      // Import dislikeComment at top of file:
      //   import { ..., dislikeComment } from "../requests";
      const { dislikeComment } = await import('../requests');
      await dislikeComment(token, commentId);
      await loadComments();
    } catch (err) {
      console.error('dislikeComment error:', err);
    }
  };

  /* ── keyboard guard for new-comment textarea ── */
  const handleNewCommentKeyDown = (e) => {
    e.stopPropagation(); // never let keys reach video player
    if (e.key === 'Enter' && e.ctrlKey) handleSubmitComment();
  };

  /* ── sort ── */
  const sorted = [...comments].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'top') return (b.likes?.length || 0) - (a.likes?.length || 0);
    return 0;
  });

  /* ── locked state ── */
  if (!hasAccess && isPaid) {
    return (
      <div className="vd-comments-section">
        <div className="vd-comments-header">
          <h3 className="vd-comments-title">
            Comments
          </h3>
        </div>
        <div className="vd-comments-locked">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p>Purchase this content to join the conversation</p>
          <button className="vd-btn-purchase-sm" onClick={onPurchase}>
            Unlock Comments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vd-comments-section">
      {/* Header */}
      <div className="vd-comments-header">
        <h3 className="vd-comments-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Comments
          <span className="vd-comment-count">{comments.length}</span>
        </h3>
        {comments.length > 1 && (
          <div className="vd-comment-sort">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="top">Top</option>
            </select>
          </div>
        )}
      </div>

      {/* New comment */}
      <div className="vd-new-comment">
        <img
          src={getAvatarUrl(user?.avatar, getDisplayName(user))}
          alt=""
          className="vd-new-comment-avatar"
        />
        <div className="vd-new-comment-wrap">
          <textarea
            ref={newCommentRef}
            placeholder={token ? 'Share your thoughts…' : 'Sign in to comment'}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleNewCommentKeyDown}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            disabled={!token || submitting}
            rows={3}
          />
          {newComment.trim() && (
            <div className="vd-new-comment-actions">
              <span className="vd-new-comment-hint">Ctrl+Enter to post</span>
              <button className="vd-btn-cancel" onClick={() => setNewComment('')}>
                Cancel
              </button>
              <button
                className="vd-btn-post"
                onClick={handleSubmitComment}
                disabled={submitting || !newComment.trim()}
              >
                {submitting ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="vd-comments-list">
        {loading ? (
          <div className="vd-comments-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="vd-comment-skeleton">
                <div className="vd-skel-avatar" />
                <div className="vd-skel-lines">
                  <div className="vd-skel-line" />
                  <div className="vd-skel-line vd-skel-short" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length > 0 ? (
          sorted.map((comment) => (
            <CommentNode
              key={comment._id}
              comment={comment}
              depth={0}
              videoCreatorId={videoCreatorId}
              currentUser={user}
              token={token}
              onDelete={handleDeleteComment}
              onLike={handleLikeComment}
              onDislike={handleDislikeComment}
              onReplySubmit={handleSubmitReply}
              addNotification={addNotification}
            />
          ))
        ) : (
          <div className="vd-no-comments">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>No comments yet — be the first!</p>
          </div>
        )}
      </div>
    </div>
  );
}