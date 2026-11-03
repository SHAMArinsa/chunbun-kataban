import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Maximize, Minimize, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX } from 'lucide-react'

/*
 * Locked-down YouTube player for unlisted course videos.
 *  - YouTube's own controls, title, logo, keyboard shortcuts and right-click are unreachable:
 *    the iframe sits under a transparent layer, and our own controls drive it through the IFrame API.
 *  - Pausing or finishing covers the video with our own screen, so YouTube's "More videos" and
 *    end-screen recommendations never show.
 *  - The video ID is never shown to the student.
 */

let apiPromise
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT) }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    })
  }
  return apiPromise
}

const fmt = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]

export default function YouTubePlayer({ videoId, title, onEnded, next, onNext, watermark }) {
  const boxRef = useRef(null)
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [state, setState] = useState('idle') // idle | playing | paused | ended | buffering
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(100)
  const [speed, setSpeed] = useState(1)
  const [full, setFull] = useState(false)
  const endedRef = useRef(onEnded)
  endedRef.current = onEnded
  const firedRef = useRef(false)
  const finish = () => { setState('ended'); if (!firedRef.current) { firedRef.current = true; endedRef.current?.() } }

  useEffect(() => {
    let alive = true
    loadYouTubeApi().then((YT) => {
      if (!alive || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: {
          controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, modestbranding: 1,
          playsinline: 1, cc_load_policy: 0, autoplay: 0, origin: window.location.origin,
        },
        events: {
          onReady: (e) => { if (!alive) return; setReady(true); setDuration(e.target.getDuration() || 0) },
          onStateChange: (e) => {
            if (!alive) return
            const S = window.YT.PlayerState
            if (e.data === S.PLAYING) setState('playing')
            else if (e.data === S.PAUSED) setState('paused')
            else if (e.data === S.BUFFERING) setState('buffering')
            else if (e.data === S.ENDED) finish()
            setDuration(e.target.getDuration() || 0)
          },
        },
      })
    })
    return () => { alive = false; try { playerRef.current?.destroy() } catch { /* ignore */ } playerRef.current = null }
  }, [videoId])

  useEffect(() => {
    if (state !== 'playing') return undefined
    const t = setInterval(() => {
      const p = playerRef.current
      if (!p?.getCurrentTime) return
      const cur = p.getCurrentTime()
      setTime(cur)
      // Stop just before the real end so YouTube's end screen can never render.
      const d = p.getDuration?.() || 0
      if (d && d - cur < 0.6) { p.pauseVideo(); p.seekTo(Math.max(0, d - 0.7), true); finish() }
    }, 250)
    return () => clearInterval(t)
  }, [state])

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === boxRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const p = () => playerRef.current
  const toggle = () => {
    if (!ready) return
    if (state === 'playing' || state === 'buffering') p().pauseVideo()
    else if (state === 'ended') { p().seekTo(0, true); p().playVideo() }
    else p().playVideo()
  }
  const seek = (v) => { p()?.seekTo(v, true); setTime(v); if (state === 'ended') setState('paused') }
  const skip = (d) => seek(Math.min(Math.max(0, time + d), Math.max(0, duration - 1)))
  const setVol = (v) => { setVolume(v); p()?.setVolume(v); if (v > 0 && muted) { p()?.unMute(); setMuted(false) } }
  const toggleMute = () => { if (muted) { p()?.unMute(); setMuted(false) } else { p()?.mute(); setMuted(true) } }
  const changeSpeed = (v) => { setSpeed(v); p()?.setPlaybackRate(v) }
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : boxRef.current?.requestFullscreen?.())
  const onKey = (e) => {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); skip(10) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-10) }
    else if (e.key === 'f') toggleFull()
    else if (e.key === 'm') toggleMute()
  }

  const covered = state === 'paused' || state === 'ended' || state === 'idle'
  return (
    <div ref={boxRef} tabIndex={0} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}
      className={`group relative w-full select-none overflow-hidden bg-black outline-none ${full ? 'h-full' : 'aspect-video rounded-lg'}`}>
      {/* The YouTube iframe — never directly clickable */}
      {/* The frame is 200px taller than the visible box and shifted up 100px: the video still fits edge to edge,
          while YouTube's title / channel bar (top) and logo (bottom) sit in the cropped-off strips. */}
      <div className="pointer-events-none absolute inset-x-0 [&>iframe]:h-full [&>iframe]:w-full" style={{ top: -100, height: 'calc(100% + 200px)' }}><div ref={hostRef} /></div>

      {/* Click-catcher: play/pause on click, blocks YouTube title/logo/links */}
      <button type="button" aria-label={state === 'playing' ? 'Pause' : 'Play'} onClick={toggle} className="absolute inset-0 z-10 cursor-pointer" />

      {watermark && <div className="pointer-events-none absolute right-3 top-3 z-20 rounded bg-black/30 px-2 py-0.5 text-[11px] text-white/70">{watermark}</div>}

      {/* Cover screens: before start, paused, ended — hide YouTube's overlays */}
      {covered && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/90 p-6 text-center text-white">
          {state === 'ended' ? (
            <>
              <CheckCircle2 size={44} className="text-emerald-400" />
              <p className="text-lg font-semibold">Completed</p>
              <p className="max-w-lg text-sm text-white/70">{title}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => seek(0) || p()?.playVideo()} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm hover:bg-white/10"><RotateCcw size={16} /> Watch again</button>
                {next && <button type="button" onClick={onNext} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold hover:bg-brand-500"><SkipForward size={16} /> Next: {next.title}</button>}
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={toggle} disabled={!ready} aria-label="Play"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg transition hover:scale-105 disabled:opacity-50">
                <Play size={28} className="ml-1" />
              </button>
              <p className="max-w-lg text-sm text-white/80">{ready ? (state === 'paused' ? 'Paused' : title) : 'Loading video…'}</p>
            </>
          )}
        </div>
      )}

      {/* Our controls */}
      <div className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6 text-white transition-opacity ${state === 'playing' ? 'opacity-0 group-hover:opacity-100 focus-within:opacity-100' : 'opacity-100'}`}>
        <input type="range" min={0} max={duration || 0} step={0.5} value={Math.min(time, duration || 0)} onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek" className="h-1 w-full cursor-pointer accent-brand-500" />
        <div className="mt-1.5 flex items-center gap-3 text-sm">
          <button type="button" onClick={toggle} aria-label={state === 'playing' ? 'Pause' : 'Play'} className="hover:text-brand-300">{state === 'playing' || state === 'buffering' ? <Pause size={18} /> : <Play size={18} />}</button>
          <button type="button" onClick={() => skip(-10)} className="text-xs hover:text-brand-300">−10s</button>
          <button type="button" onClick={() => skip(10)} className="text-xs hover:text-brand-300">+10s</button>
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="hover:text-brand-300">{muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
          <input type="range" min={0} max={100} value={muted ? 0 : volume} onChange={(e) => setVol(Number(e.target.value))} aria-label="Volume" className="h-1 w-20 cursor-pointer accent-white" />
          <span className="tabular-nums text-xs text-white/80">{fmt(time)} / {fmt(duration)}</span>
          <span className="ml-auto" />
          <select value={speed} onChange={(e) => changeSpeed(Number(e.target.value))} aria-label="Playback speed"
            className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white outline-none [&>option]:text-slate-900">
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
          <button type="button" onClick={toggleFull} aria-label="Fullscreen" className="hover:text-brand-300">{full ? <Minimize size={18} /> : <Maximize size={18} />}</button>
        </div>
      </div>
    </div>
  )
}
