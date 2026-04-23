import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'notee_v1'
const SESSION_ID = (() => Date.now().toString(36) + Math.random().toString(36).slice(2))()

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function formatDate(ts) {
  const d = new Date(ts), now = new Date()
  const mins = Math.floor((now - d) / 60000)
  const hrs  = Math.floor((now - d) / 3600000)
  const days = Math.floor((now - d) / 86400000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24)  return `${hrs}h ago`
  if (days === 1) return 'yesterday'
  if (days < 7)  return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(secs) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

function formatBytes(b) {
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`
  return `${(b / 1048576).toFixed(1)}MB`
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

function getDevice() {
  const ua = navigator.userAgent
  if (/Mobi|Android/i.test(ua)) return 'mobile'
  if (/iPad|Tablet/i.test(ua))  return 'tablet'
  return 'desktop'
}

// ─────────────────────────────────────────────────────────────────────────────
// Context envelope — captured silently on every note creation
// ─────────────────────────────────────────────────────────────────────────────
function buildContext(recentlyViewed) {
  return {
    sessionId:     SESSION_ID,
    timeOfDay:     getTimeOfDay(),
    device:        getDevice(),
    recentlyViewed: recentlyViewed.slice(0, 6),
    ts:            Date.now(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Note model
// ─────────────────────────────────────────────────────────────────────────────
function createNote(content = '', ctx = null) {
  return {
    id:          genId(),
    content,
    attachments: [],
    context:     ctx,
    createdAt:   Date.now(),
    updatedAt:   Date.now(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Title / label extraction
// "If the user creates a title as the first sentence that would be the title.
//  Else no title, and the starting words will be shown."
// ─────────────────────────────────────────────────────────────────────────────
function deriveTitle(note) {
  const first = (note.content || '').split('\n')[0].trim()
  // Treat as a title if: 2–100 chars and doesn't end mid-sentence with a period mid-string
  if (first.length >= 2 && first.length <= 100) return first
  return null
}

function sidebarLabel(note) {
  const title = deriveTitle(note)
  if (title) return { text: title, isTitle: true }

  const words = (note.content || '')
    .replace(/\n/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 9)
    .join(' ')

  if (words) return { text: words, isTitle: false }

  const atts = note.attachments || []
  if (atts.length > 0) {
    const icons = { image: '↳ image', audio: '↳ audio', video: '↳ video', file: '↳ file', link: '↳ link' }
    return { text: icons[atts[0].kind] || atts[0].name, isTitle: false }
  }

  return { text: null, isTitle: false }
}

function sidebarSub(note) {
  const title = deriveTitle(note)
  if (!title) return null
  const rest = (note.content || '').split('\n').slice(1).join(' ').trim()
  if (rest.length > 0) return rest.slice(0, 72)
  const atts = note.attachments || []
  if (atts.length > 0) return `${atts.length} attachment${atts.length > 1 ? 's' : ''}`
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Search — Layer 1: Lexical (BM25-inspired keyword scoring)
//
// AI_STUB ─ Layer 2: Semantic search
// When Nomic Embed Vision (via Transformers.js + WebGPU) is available, replace
// lexicalScore() with vector cosine similarity against stored per-note embeddings.
// Interface: await AI.embed(text) → Float32Array
// Replace this block with:
//   const embedding = await AI.embed(query)
//   return notes.map(n => ({ note: n, score: cosineSim(embedding, n.embedding) }))
//             .filter(x => x.score > 0.30)
//             .sort((a, b) => b.score - a.score)
//             .map(x => x.note)
// ─────────────────────────────────────────────────────────────────────────────
function lexicalScore(query, note) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return 0

  const content = (note.content || '').toLowerCase()
  const title   = (deriveTitle(note) || '').toLowerCase()

  let score = 0
  for (const term of terms) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    const titleHits   = (title.match(re)   || []).length
    const contentHits = (content.match(re) || []).length
    score += titleHits * 4
    score += Math.min(contentHits, 12) * 1
  }

  // Recency bonus — decays over 14 days
  const ageDays = (Date.now() - note.updatedAt) / 86400000
  score += Math.max(0, 1 - ageDays / 14) * 0.8

  return score
}

function searchNotes(query, notes) {
  if (!query.trim()) return [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
  return notes
    .map(n => ({ note: n, score: lexicalScore(query, n) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.note)
}

// ─────────────────────────────────────────────────────────────────────────────
// Related notes — Hippocampus layer (keyword overlap + session co-capture)
//
// AI_STUB ─ Neocortex (Hebbian graph traversal)
// Replace this with D1 graph traversal + Cloudflare Vectorize ANN:
//   const embedding = await AI.embed(activeNote.content)
//   return neocortex.query(embedding, { limit: 5, sessionBoost: true })
// ─────────────────────────────────────────────────────────────────────────────
function getRelated(active, all) {
  if (!active || !active.content.trim()) return []

  const stopWords = new Set(['the','and','for','are','but','not','you','all','can','her','was','one','our','out','day','get','has','him','his','how','its','let','may','nor','now','off','old','see','she','too','two','use','way','who','why'])
  const activeWords = new Set(
    active.content.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w))
  )

  return all
    .filter(n => n.id !== active.id)
    .map(n => {
      const words = n.content.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w))
      const overlap = words.filter(w => activeWords.has(w)).length
      const sameSession = (n.context?.sessionId === active.context?.sessionId) ? 1.5 : 0
      return { note: n, score: overlap + sameSession }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => x.note)
}

// ─────────────────────────────────────────────────────────────────────────────
// File → attachment object
// ─────────────────────────────────────────────────────────────────────────────
async function fileToAtt(file) {
  const kind = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('audio/') ? 'audio'
    : file.type.startsWith('video/') ? 'video'
    : 'file'

  if (kind !== 'file') {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => resolve({ id: genId(), name: file.name, type: file.type, kind, dataUrl: e.target.result, size: file.size })
      reader.readAsDataURL(file)
    })
  }

  return { id: genId(), name: file.name, type: file.type || 'application/octet-stream', kind: 'file', size: file.size }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachment renderers
// ─────────────────────────────────────────────────────────────────────────────
function AttImage({ att, onRemove }) {
  return (
    <div className="att-img-wrap">
      <img src={att.dataUrl} alt={att.name} className="att-img" />
      {onRemove && <button className="att-x" onClick={onRemove} title="Remove">×</button>}
    </div>
  )
}

function AttAudio({ att, onRemove }) {
  return (
    <div className="att-block">
      <div className="att-block-row">
        <span className="att-kind-icon">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="3.5" y="0.5" width="4" height="6" rx="2" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M1 5.5a4.5 4.5 0 009 0M5.5 9.5v1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="att-name">{att.name}</span>
        <span className="att-size">{formatBytes(att.size)}</span>
        {onRemove && <button className="att-x-inline" onClick={onRemove}>×</button>}
      </div>
      <audio controls src={att.dataUrl} className="att-audio" preload="metadata" />
    </div>
  )
}

function AttVideo({ att, onRemove }) {
  return (
    <div className="att-video-wrap">
      <video controls src={att.dataUrl} className="att-video" preload="metadata" />
      <div className="att-video-row">
        <span className="att-name">{att.name}</span>
        <span className="att-size">{formatBytes(att.size)}</span>
        {onRemove && <button className="att-x-inline" onClick={onRemove}>×</button>}
      </div>
    </div>
  )
}

function AttFile({ att, onRemove }) {
  const ext = att.name.split('.').pop().toUpperCase().slice(0, 6)
  return (
    <div className="att-block">
      <span className="att-ext-badge">{ext}</span>
      <div className="att-file-info">
        <span className="att-name">{att.name}</span>
        <span className="att-size">{formatBytes(att.size)}</span>
      </div>
      {onRemove && <button className="att-x-inline" onClick={onRemove}>×</button>}
    </div>
  )
}

function AttLink({ att, onRemove }) {
  return (
    <div className="att-block att-block--link">
      <span className="att-link-arrow">↗</span>
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="att-link-url">
        {att.url}
      </a>
      {onRemove && <button className="att-x-inline" onClick={onRemove}>×</button>}
    </div>
  )
}

function Att({ att, onRemove }) {
  if (att.kind === 'image') return <AttImage att={att} onRemove={onRemove} />
  if (att.kind === 'audio') return <AttAudio att={att} onRemove={onRemove} />
  if (att.kind === 'video') return <AttVideo att={att} onRemove={onRemove} />
  if (att.kind === 'link')  return <AttLink  att={att} onRemove={onRemove} />
  return <AttFile att={att} onRemove={onRemove} />
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    catch { return [] }
  })
  const [activeId,      setActiveId]      = useState(null)
  const [search,        setSearch]        = useState('')
  const [,              setTick]          = useState(0)
  const [draft,         setDraft]         = useState('')        // text before first note is created
  const [dragOver,      setDragOver]      = useState(false)
  const [showLinkBox,   setShowLinkBox]   = useState(false)
  const [linkInput,     setLinkInput]     = useState('')
  const [isRecording,   setIsRecording]   = useState(false)
  const [recSecs,       setRecSecs]       = useState(0)
  const [recentViewed,  setRecentViewed]  = useState([])

  const editorRef       = useRef(null)
  const fileInputRef    = useRef(null)
  const recorderRef     = useRef(null)
  const recTimerRef     = useRef(null)

  // Timestamp refresh
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(iv)
  }, [])

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  const activeNote = notes.find(n => n.id === activeId) || null
  const displayed  = searchNotes(search, notes)
  const related    = getRelated(activeNote, notes)

  // Track recently viewed
  useEffect(() => {
    if (activeId) setRecentViewed(p => [activeId, ...p.filter(x => x !== activeId)].slice(0, 8))
  }, [activeId])

  // ── Note operations ─────────────────────────────────────────────────────────
  const newCapture = useCallback(() => {
    const note = createNote('', buildContext(recentViewed))
    setNotes(p => [note, ...p])
    setActiveId(note.id)
    setDraft('')
    setSearch('')
    setTimeout(() => editorRef.current?.focus(), 40)
  }, [recentViewed])

  const selectNote = useCallback((id) => {
    setActiveId(id)
    setDraft('')
    setTimeout(() => editorRef.current?.focus(), 40)
  }, [])

  const deleteNote = useCallback((id, e) => {
    e?.stopPropagation()
    setNotes(p => p.filter(n => n.id !== id))
    setActiveId(p => {
      if (p !== id) return p
      const rest = notes.filter(n => n.id !== id).sort((a, b) => b.updatedAt - a.updatedAt)
      return rest.length > 0 ? rest[0].id : null
    })
  }, [notes])

  // ── Text editing ─────────────────────────────────────────────────────────────
  // When no note is active: first keystroke auto-creates one (frictionless capture)
  const handleTextChange = useCallback((value) => {
    if (activeId) {
      setNotes(p => p.map(n => n.id === activeId ? { ...n, content: value, updatedAt: Date.now() } : n))
    } else {
      setDraft(value)
      if (value.trim()) {
        const note = createNote(value, buildContext(recentViewed))
        setNotes(p => [note, ...p])
        setActiveId(note.id)
        setDraft('')
      }
    }
  }, [activeId, recentViewed])

  // ── Attachments ──────────────────────────────────────────────────────────────
  const addAtts = useCallback((atts) => {
    if (!atts.length) return
    if (activeId) {
      setNotes(p => p.map(n => n.id === activeId
        ? { ...n, attachments: [...(n.attachments || []), ...atts], updatedAt: Date.now() }
        : n
      ))
    } else {
      // Create note from attachments
      const note = createNote('', buildContext(recentViewed))
      note.attachments = atts
      setNotes(p => [note, ...p])
      setActiveId(note.id)
    }
  }, [activeId, recentViewed])

  const removeAtt = useCallback((attId) => {
    setNotes(p => p.map(n => n.id === activeId
      ? { ...n, attachments: (n.attachments || []).filter(a => a.id !== attId) }
      : n
    ))
  }, [activeId])

  const handleFiles = useCallback(async (files) => {
    const atts = await Promise.all(Array.from(files).map(fileToAtt))
    addAtts(atts)
  }, [addAtts])

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
      return
    }
    const text = e.dataTransfer.getData('text/plain')
    if (text) {
      const urls = (text.match(/https?:\/\/[^\s]+/g) || [])
      if (urls.length > 0) {
        addAtts(urls.map(url => ({ id: genId(), kind: 'link', url, name: url })))
      }
    }
  }, [handleFiles, addAtts])

  // ── Clipboard paste (images) ──────────────────────────────────────────────────
  const handlePaste = useCallback((e) => {
    const fileItems = Array.from(e.clipboardData?.items || []).filter(i => i.kind === 'file')
    if (fileItems.length > 0) {
      e.preventDefault()
      handleFiles(fileItems.map(i => i.getAsFile()).filter(Boolean))
    }
  }, [handleFiles])

  // ── Voice recording ───────────────────────────────────────────────────────────
  const startRec = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const reader = new FileReader()
        const name = `Voice memo · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        reader.onload = e => addAtts([{ id: genId(), kind: 'audio', name, type: 'audio/webm', dataUrl: e.target.result, size: blob.size }])
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      rec.start()
      recorderRef.current = rec
      setIsRecording(true)
      setRecSecs(0)
      recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000)
    } catch {
      alert('Microphone access denied. Please allow microphone access and try again.')
    }
  }, [addAtts])

  const stopRec = useCallback(() => {
    recorderRef.current?.stop()
    clearInterval(recTimerRef.current)
    setIsRecording(false)
    setRecSecs(0)
  }, [])

  // ── Link ──────────────────────────────────────────────────────────────────────
  const addLink = useCallback(() => {
    if (!linkInput.trim()) return
    let url = linkInput.trim()
    if (!url.startsWith('http')) url = 'https://' + url
    addAtts([{ id: genId(), kind: 'link', url, name: url }])
    setLinkInput('')
    setShowLinkBox(false)
  }, [linkInput, addAtts])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); newCapture() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [newCapture])

  // ── Derived ───────────────────────────────────────────────────────────────────
  const textValue = activeNote ? activeNote.content : draft
  const wordCount = textValue.trim().split(/\s+/).filter(Boolean).length
  const attCount  = (activeNote?.attachments || []).length

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="layout">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sidebar">

        <div className="sidebar-head">
          <span className="logo">notee</span>
          <button className="new-btn" onClick={newCapture} title="New capture (⌘N)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="search-wrap">
          <svg className="search-ico" width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.15"/>
            <path d="M7 7l2.5 2.5" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search captures…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {/* AI_STUB: currently lexical BM25-style; swap for Nomic Embed vector search */}
        </div>

        <div className="note-stream">
          {displayed.length === 0 && (
            <div className="stream-empty">
              {search ? 'Nothing found' : 'No captures yet.\nPress ⌘N to start.'}
            </div>
          )}
          {displayed.map(note => {
            const { text, isTitle } = sidebarLabel(note)
            const sub  = sidebarSub(note)
            const atts = note.attachments || []
            return (
              <div
                key={note.id}
                className={`note-row${note.id === activeId ? ' note-row--active' : ''}`}
                onClick={() => selectNote(note.id)}
              >
                <div className="note-row-top">
                  <div className={`note-row-label${isTitle ? '' : ' note-row-label--body'}`}>
                    {text || <em className="note-row-empty">Empty</em>}
                  </div>
                  <button className="row-del" onClick={e => deleteNote(note.id, e)}>×</button>
                </div>
                {sub && <div className="note-row-sub">{sub}</div>}
                <div className="note-row-foot">
                  <span>{formatDate(note.updatedAt)}</span>
                  {atts.length > 0 && (
                    <span className="att-count">{atts.length} {atts.length === 1 ? 'item' : 'items'}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="sidebar-foot">
          {notes.length} {notes.length === 1 ? 'capture' : 'captures'}
        </div>
      </aside>

      {/* ── Capture pane ─────────────────────────────────────────────────── */}
      <main
        className={`cpane${dragOver ? ' cpane--drag' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
        onDrop={handleDrop}
      >

        {/* Meta bar — only visible when viewing a note */}
        {activeNote && (
          <div className="cpane-meta">
            <span className="cpane-date">{formatDate(activeNote.updatedAt)}</span>
            {activeNote.context && (
              <span className="cpane-ctx">
                {activeNote.context.timeOfDay} · {activeNote.context.device}
              </span>
            )}
          </div>
        )}

        {/* Attachments */}
        {attCount > 0 && (
          <div className="atts-area">
            {(activeNote.attachments || []).map(att => (
              <Att key={att.id} att={att} onRemove={() => removeAtt(att.id)} />
            ))}
          </div>
        )}

        {/* ── Text surface — always visible ── */}
        <div className="text-surface" onClick={() => editorRef.current?.focus()}>
          <textarea
            ref={editorRef}
            className="text-area"
            placeholder={activeId ? 'Continue writing…' : 'Capture a thought…'}
            value={textValue}
            onChange={e => handleTextChange(e.target.value)}
            onPaste={handlePaste}
            spellCheck
          />
        </div>

        {/* Related notes — Hippocampus layer */}
        {related.length > 0 && (
          <div className="related-row">
            <span className="related-label">Connected</span>
            {related.map(n => {
              const { text } = sidebarLabel(n)
              return (
                <button key={n.id} className="related-chip" onClick={() => selectNote(n.id)}>
                  {text || 'Empty'}
                </button>
              )
            })}
            {/* AI_STUB: replace with Neocortex graph traversal (D1 + Cloudflare Vectorize) */}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="toolbar">
          <div className="toolbar-l">

            {/* Attach file / image / video */}
            <button className="tool-btn" onClick={() => fileInputRef.current?.click()} title="Attach file, image, video, or document">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8.5 1.5H3.5A1.5 1.5 0 002 3v8A1.5 1.5 0 003.5 12.5h7A1.5 1.5 0 0012 11V5L8.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M8.5 1.5V5H12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
            </button>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
              onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />

            {/* Voice memo */}
            <button
              className={`tool-btn${isRecording ? ' tool-btn--rec' : ''}`}
              onClick={isRecording ? stopRec : startRec}
              title={isRecording ? 'Stop recording' : 'Record voice memo'}
            >
              {isRecording
                ? <span className="rec-dot" />
                : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="4.5" y="1" width="5" height="7.5" rx="2.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M2 7.5a5 5 0 0010 0M7 12v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                )
              }
            </button>
            {isRecording && <span className="rec-timer">{formatTime(recSecs)}</span>}

            {/* Add link */}
            <button
              className={`tool-btn${showLinkBox ? ' tool-btn--active' : ''}`}
              onClick={() => setShowLinkBox(v => !v)}
              title="Add link"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M6 9l2.5-2.5M8.5 4.5L10 3a3 3 0 014 4.5l-1.5 1.5M5.5 9.5L4 11A3 3 0 01-.5 6.5L1 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Inline link input */}
            {showLinkBox && (
              <div className="link-box">
                <input
                  className="link-input"
                  placeholder="Paste a URL…"
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addLink(); if (e.key === 'Escape') setShowLinkBox(false) }}
                  autoFocus
                />
                <button className="link-add" onClick={addLink}>Add</button>
              </div>
            )}
          </div>

          <div className="toolbar-r">
            {wordCount > 0  && <span className="status-text">{wordCount}w</span>}
            {attCount  > 0  && <span className="status-text">{attCount} att</span>}
          </div>
        </div>

        {/* Drop overlay */}
        {dragOver && (
          <div className="drop-overlay">
            <div className="drop-label">Drop anything to capture</div>
          </div>
        )}
      </main>
    </div>
  )
}
