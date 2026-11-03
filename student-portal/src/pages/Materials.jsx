import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, ExternalLink, FileText, Eye, PlayCircle } from 'lucide-react'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import FilePreview from '../components/ui/FilePreview'
import ProtectedContent from '../components/proctoring/ProtectedContent'
import YouTubePlayer from '../components/YouTubePlayer'

export default function Materials({ mode = 'materials' }) {
  const isVideos = mode === 'videos'
  const [previewing, setPreviewing] = useState(null) // { id, title, file_type }
  const qc = useQueryClient()

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => apiClient.get('/materials').then((r) => r.data),
  })

  const { data: course } = useQuery({
    queryKey: ['v2', 'curriculum'],
    queryFn: () => apiClient.get('/v2/me/curriculum').then((r) => r.data),
    retry: false,
    enabled: isVideos,
  })
  const markWatched = (v) => apiClient.post(`/v2/me/videos/${v.id}/watched`).then(() => qc.invalidateQueries({ queryKey: ['v2', 'curriculum'] })).catch(() => {})
  const play = (v) => {
    setPreviewing(v)
    if (v.has_file || v.file_type) markWatched(v) // uploaded files: counted when opened; YouTube: counted when finished
  }

  if (isLoading) return <Spinner />
  const videos = (materials || []).filter((m) => m.content_type === 'video')
  const docs = (materials || []).filter((m) => m.content_type !== 'video')
  const ytId = (url) => (url || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/)?.[1]
  const playlist = course ? [...course.modules.flatMap((m) => m.chapters.flatMap((c) => c.videos)), ...course.unassigned] : []
  const nextOf = (v) => { const i = playlist.findIndex((x) => x.id === v.id); return i >= 0 ? playlist.slice(i + 1).find((x) => x.has_file || ytId(x.resource_url)) : null }

  const Item = ({ m }) => {
    const isVideo = m.content_type === 'video'
    const Icon = isVideo ? PlayCircle : FileText
    const typeLabel = m.file_type ? m.file_type.toUpperCase() : isVideo ? 'Video' : 'Link'
    return (
      <Card className="rounded-2xl border-brand-100 bg-gradient-to-r from-white via-white to-brand-50/50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-brand-100 p-3 text-brand-600"><Icon size={22} /></div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-brand-800">{m.title}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">{typeLabel}</p>
              {m.description && <p className="mt-1 text-sm text-slate-600">{m.description}</p>}
            </div>
          </div>
          {m.has_file || m.file_type
            ? <Button variant="secondary" className="shrink-0" onClick={() => (isVideo ? play(m) : setPreviewing(m))}>{isVideo ? <PlayCircle size={18} /> : <Eye size={18} />} {isVideo ? 'Play' : 'Preview'}</Button>
            : isVideo && ytId(m.resource_url)
              ? <Button variant="secondary" className="shrink-0" onClick={() => play(m)}><PlayCircle size={18} /> Play</Button>
              : <a href={m.resource_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Open <ExternalLink size={16} /></a>}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{isVideos ? 'Videos' : 'Study Materials'}</h1>
        <p className="mt-1 text-sm text-slate-500">{isVideos ? 'Your course videos, organised by module and chapter.' : 'Documents and resources ARINSA AI MINDS has shared for your program.'}</p>
      </div>

      {!isVideos && (
      <section className="space-y-3">
        {docs.length ? docs.map((m) => <Item key={m.id} m={m} />) : <Card className="p-8 text-center text-sm text-slate-500">No study materials yet.</Card>}
      </section>
      )}

      {isVideos && (
      <section className="space-y-4">
        {course ? (
          <>
            {course.modules.filter((m) => m.video_count > 0).map((m) => (
              <Card key={m.id} className="overflow-hidden rounded-2xl p-0 shadow-sm">
                <div className="border-b border-slate-100 px-6 py-5">
                  <h3 className="text-xl font-medium text-sky-600">Module {m.number}: {m.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><BookOpen size={15} /> Chapters : {m.chapters.filter((c) => c.videos.length).length}</span>
                    <span className="inline-flex items-center gap-1.5"><PlayCircle size={15} /> Videos : {m.video_count}{m.minutes ? ` · ${m.minutes} mins` : ''}</span>
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={15} /> Completed : {m.completed_percent}%</span>
                  </div>
                </div>
                {m.chapters.filter((c) => c.videos.length).map((c) => (
                  <div key={c.id} className="border-b border-slate-100 px-6 py-4 last:border-0">
                    <p className="flex items-center gap-3 text-base text-slate-700"><span className="h-4 w-4 shrink-0 rounded-sm bg-sky-400" /> {c.title}</p>
                    <ul className="mt-3 space-y-1">
                      {c.videos.map((v, i) => (
                        <li key={v.id}>
                          <button onClick={() => (v.has_file || ytId(v.resource_url) ? play(v) : window.open(v.resource_url, '_blank', 'noopener'))}
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-sky-50">
                            <PlayCircle size={16} className="shrink-0 text-sky-500" />
                            <span className="w-10 shrink-0 text-slate-500">{c.number}.{i + 1}</span>
                            <span className="min-w-0 flex-1 text-slate-700">{v.title} {v.watched && <Eye size={15} className="ml-1 inline text-emerald-500" aria-label="Watched" />}</span>
                            {v.duration_minutes ? <span className="shrink-0 text-slate-500">{v.duration_minutes} mins</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Card>
            ))}
            {course.unassigned.length > 0 && (
              <div className="space-y-3">{course.unassigned.map((v) => <Item key={v.id} m={{ ...v, content_type: 'video' }} />)}</div>
            )}
            {!course.modules.some((m) => m.video_count) && !course.unassigned.length && <Card className="p-8 text-center text-sm text-slate-500">No videos yet.</Card>}
          </>
        ) : videos.length ? videos.map((m) => <Item key={m.id} m={m} />) : <Card className="p-8 text-center text-sm text-slate-500">No videos yet.</Card>}
      </section>
      )}

      {previewing && (
        <ProtectedContent
          key={previewing.id}
          assessmentType="material"
          assessmentId={previewing.id}
          resourceId={previewing.id}
          viewLabel="View Material"
          onCancel={() => setPreviewing(null)}
          autoEnter
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{previewing.title}</h2>
          {previewing.file_type ? (
            <FilePreview
              fetcher={() => apiClient.get(`/materials/${previewing.id}/download`, { responseType: 'blob' })}
              fileName={`${previewing.title}.${previewing.file_type}`}
            />
          ) : (
            <YouTubePlayer key={previewing.id} videoId={ytId(previewing.resource_url)} title={previewing.title}
              next={nextOf(previewing)} onNext={() => play(nextOf(previewing))} onEnded={() => markWatched(previewing)} />
          )}
        </ProtectedContent>
      )}
    </div>
  )
}
