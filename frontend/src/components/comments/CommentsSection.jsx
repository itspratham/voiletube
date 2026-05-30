import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useSelector, useDispatch } from 'react-redux'
import { ThumbsUp, MoreVertical, Reply } from 'lucide-react'
import { commentService } from '@/services/api'
import { openAuthModal } from '@/store/slices/uiSlice'
import { formatTimeAgo, formatCount } from '@/utils/format'

export default function CommentsSection({ videoId, commentsCount }) {
  const { isAuthenticated, user } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const qc = useQueryClient()
  const [newComment, setNewComment] = useState('')
  const [focused, setFocused] = useState(false)
  const [sortBy, setSortBy] = useState('top')

  const { data: comments = [], isLoading } = useQuery(
    ['comments', videoId, sortBy],
    () => commentService.getByVideo(videoId, { sort: sortBy }).then((r) => r.data.results || r.data)
  )

  const addComment = useMutation(
    (content) => commentService.create(videoId, { content }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['comments', videoId])
        setNewComment('')
        setFocused(false)
      },
    }
  )

  const handleSubmit = () => {
    if (!newComment.trim()) return
    if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
    addComment.mutate(newComment.trim())
  }

  return (
    <div className="premium-surface mt-7 p-5">
      <div className="flex items-center gap-6 mb-6">
        <h3 className="text-lg font-semibold">{formatCount(commentsCount)} Comments</h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="cursor-pointer rounded-full border border-vt-border/80 bg-vt-surface/60 px-3 py-1.5 text-sm text-vt-muted outline-none"
        >
          <option value="top">Top comments</option>
          <option value="new">Newest first</option>
        </select>
      </div>

      {/* New comment input */}
      <div className="flex gap-4 mb-8">
        {user ? (
          <img src={user.avatar_url} alt={user.display_name} className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-1 ring-vt-border/90" />
        ) : (
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-vt-chip" />
        )}
        <div className="flex-1">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onFocus={() => {
              if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
              setFocused(true)
            }}
            placeholder="Add a comment…"
            className="w-full border-b border-vt-border bg-transparent pb-2 text-sm outline-none placeholder-vt-muted transition-colors focus:border-vt-accent"
          />
          {focused && (
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setFocused(false); setNewComment('') }} className="btn-ghost text-sm px-4 py-1.5">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!newComment.trim() || addComment.isLoading}
                className="btn-primary disabled:opacity-50"
              >
                Comment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comments list */}
      {isLoading ? (
        <CommentsSkeleton />
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} videoId={videoId} />
          ))}
        </div>
      )}
    </div>
  )
}

function CommentItem({ comment, videoId, isReply = false }) {
  const { isAuthenticated, user } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const qc = useQueryClient()
  const [showReplies, setShowReplies] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [liked, setLiked] = useState(comment.user_liked)
  const [likeCount, setLikeCount] = useState(comment.likes_count)

  const { data: replies = [] } = useQuery(
    ['replies', comment.id],
    () => commentService.getReplies(comment.id).then((r) => r.data.results || r.data),
    { enabled: showReplies }
  )

  const addReply = useMutation(
    (content) => commentService.createReply(comment.id, { content }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['replies', comment.id])
        setReplyText('')
        setShowReplyInput(false)
        setShowReplies(true)
      },
    }
  )

  const handleLike = async () => {
    if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
    const { data } = await commentService.like(comment.id)
    setLiked(data.liked)
    setLikeCount((c) => data.liked ? c + 1 : c - 1)
  }

  return (
    <div className={`flex gap-3 ${isReply ? 'ml-12' : ''}`}>
      <img
        src={comment.author?.avatar_url}
        alt={comment.author?.display_name}
        className={`flex-shrink-0 rounded-full object-cover ring-1 ring-vt-border/80 ${isReply ? 'w-7 h-7' : 'w-10 h-10'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{comment.author?.display_name}</span>
          {comment.is_pinned && (
            <span className="rounded-full bg-vt-chip px-2 py-0.5 text-xs text-vt-muted">Pinned</span>
          )}
          <span className="text-xs text-vt-muted">{formatTimeAgo(comment.created_at)}</span>
        </div>
        <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs ${liked ? 'text-vt-accent' : 'text-vt-muted'} hover:text-vt-text transition-colors`}>
            <ThumbsUp size={14} fill={liked ? 'currentColor' : 'none'} />
            {likeCount > 0 && likeCount}
          </button>
          {!isReply && (
            <button
              onClick={() => {
                if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
                setShowReplyInput(!showReplyInput)
              }}
              className="flex items-center gap-1.5 text-xs text-vt-muted hover:text-vt-text transition-colors"
            >
              <Reply size={14} /> Reply
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReplyInput && (
          <div className="flex gap-3 mt-3">
            {user && <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />}
            <div className="flex-1">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${comment.author?.display_name}…`}
                className="w-full border-b border-vt-border bg-transparent pb-2 text-sm outline-none placeholder-vt-muted transition-colors focus:border-vt-accent"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setShowReplyInput(false)} className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
                <button
                  onClick={() => addReply.mutate(replyText.trim())}
                  disabled={!replyText.trim()}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  Reply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show replies toggle */}
        {!isReply && comment.replies_count > 0 && (
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="mt-2 flex items-center gap-1.5 text-sm text-vt-accent transition-colors hover:text-vt-accent-hover"
          >
            <Reply size={14} />
            {showReplies ? 'Hide' : `${comment.replies_count} ${comment.replies_count === 1 ? 'reply' : 'replies'}`}
          </button>
        )}

        {/* Replies */}
        {showReplies && (
          <div className="mt-3 space-y-4">
            {replies.map((r) => (
              <CommentItem key={r.id} comment={r} videoId={videoId} isReply />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CommentsSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-10 h-10 skeleton rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 skeleton rounded w-32" />
            <div className="h-4 skeleton rounded w-full" />
            <div className="h-4 skeleton rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
