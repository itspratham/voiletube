import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useDropzone } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { closeUploadModal } from '@/store/slices/uiSlice'
import { videoService } from '@/services/api'
import toast from 'react-hot-toast'

const STEPS = ['Select file', 'Details', 'Done']

export default function UploadModal() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [thumbnail, setThumbnail] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedVideo, setUploadedVideo] = useState(null)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { status: 'published', allow_comments: true }
  })

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) { setFile(accepted[0]); setStep(1) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.webm', '.mov', '.mpeg'] },
    maxSize: 500 * 1024 * 1024,
    multiple: false,
  })

  const onSubmit = async (data) => {
    if (!file) return
    setUploading(true)

    const formData = new FormData()
    formData.append('video_file', file)
    formData.append('title', data.title)
    formData.append('description', data.description || '')
    formData.append('status', data.status)
    formData.append('allow_comments', data.allow_comments)
    if (thumbnail) formData.append('thumbnail', thumbnail)
    if (data.tags) {
      data.tags.split(',').forEach((t) => formData.append('tags', t.trim()))
    }

    try {
      const { data: video } = await videoService.upload(formData, (event) => {
        if (!event.total) return
        setUploadProgress(Math.round((event.loaded * 100) / event.total))
      })
      setUploadedVideo(video)
      setStep(2)
      toast.success('Video uploaded! Processing may take a few minutes.')
    } catch (err) {
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !uploading && dispatch(closeUploadModal())} />
      <div className="glass-panel-strong relative max-h-[90vh] w-full max-w-2xl animate-slide-up overflow-y-auto rounded-lg">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-vt-border/80 bg-vt-surface/80 px-6 py-4 backdrop-blur-2xl">
          <h2 className="font-semibold text-lg">Upload video</h2>
          <div className="flex items-center gap-4">
            {/* Stepper */}
            <div className="hidden sm:flex items-center gap-2 text-sm">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    i < step ? 'bg-vt-accent text-white' : i === step ? 'bg-vt-accent text-white' : 'bg-vt-chip text-vt-muted'
                  }`}>
                    {i < step ? '✓' : i + 1}
                  </span>
                  <span className={i === step ? 'text-vt-text' : 'text-vt-muted'}>{s}</span>
                  {i < STEPS.length - 1 && <span className="text-vt-border">›</span>}
                </div>
              ))}
            </div>
            {!uploading && (
              <button onClick={() => dispatch(closeUploadModal())} className="btn-ghost p-1.5 rounded-full">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Step 0: File select */}
          {step === 0 && (
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-16 text-center transition-colors ${
                isDragActive ? 'border-vt-accent bg-vt-accent/5' : 'border-vt-border hover:border-vt-muted'
              }`}
            >
              <input {...getInputProps()} />
              <Upload size={48} className="mx-auto mb-4 text-vt-muted" />
              <p className="text-lg font-medium mb-2">
                {isDragActive ? 'Drop your video here' : 'Drag and drop a video file'}
              </p>
              <p className="text-vt-muted text-sm mb-6">MP4, WebM, MOV up to 500 MB</p>
              <button className="btn-primary px-8 py-3">Select file</button>
            </div>
          )}

          {/* Step 1: Details */}
          {step === 1 && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="flex items-center gap-3 rounded-lg border border-vt-border/80 bg-vt-chip/70 px-4 py-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vt-accent/20">
                  <Upload size={14} className="text-vt-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file?.name}</p>
                  <p className="text-xs text-vt-muted">{(file?.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button type="button" onClick={() => setStep(0)} className="ml-auto text-xs text-vt-muted hover:text-vt-text">Change</button>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Title <span className="text-red-400">*</span></label>
                <input
                  {...register('title', { required: 'Title is required', maxLength: { value: 255, message: 'Max 255 chars' } })}
                  placeholder="Give your video a title"
                  className="input-field"
                />
                {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <textarea
                  {...register('description')}
                  placeholder="Tell viewers about your video"
                  rows={4}
                  className="input-field resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Thumbnail</label>
                  <label className="relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-vt-border transition-colors hover:border-vt-muted">
                    {thumbnail ? (
                      <img src={URL.createObjectURL(thumbnail)} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Upload size={20} className="mx-auto mb-1 text-vt-muted" />
                        <span className="text-xs text-vt-muted">Upload thumbnail</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => setThumbnail(e.target.files[0])} />
                  </label>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Visibility</label>
                    <select {...register('status')} className="input-field">
                      <option value="published">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Tags</label>
                    <input
                      {...register('tags')}
                      placeholder="tag1, tag2, tag3"
                      className="input-field"
                    />
                    <p className="text-xs text-vt-muted mt-1">Comma-separated</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="allow_comments" {...register('allow_comments')} className="rounded" />
                <label htmlFor="allow_comments" className="text-sm">Allow comments</label>
              </div>

              {uploading && (
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-vt-muted">Uploading…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-vt-chip rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-vt-accent transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => dispatch(closeUploadModal())} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="btn-primary px-8 disabled:opacity-60">
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </span>
                  ) : 'Upload'}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Done */}
          {step === 2 && (
            <div className="text-center py-8">
              <CheckCircle size={56} className="mx-auto mb-4 text-green-400" />
              <h3 className="text-xl font-semibold mb-2">Video uploaded!</h3>
              <p className="text-vt-muted mb-6">Your video is being processed and will be available shortly.</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => dispatch(closeUploadModal())} className="btn-secondary">Close</button>
                <button
                  onClick={() => {
                    if (!uploadedVideo?.id) {
                      toast.error('Video is still processing. Try opening it from your uploads in a moment.')
                      return
                    }
                    dispatch(closeUploadModal())
                    navigate(`/watch/${uploadedVideo?.id}`)
                  }}
                  className="btn-primary"
                >
                  View video
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
