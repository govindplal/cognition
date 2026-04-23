import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Landing.css'

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.1"/>
        <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.1"/>
        <line x1="10" y1="1.5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        <line x1="10" y1="15" x2="10" y2="18.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        <line x1="1.5" y1="10" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        <line x1="15" y1="10" x2="18.5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Capture anything',
    body: 'Text, images, voice memos, PDFs, video, links — every format of thought in one place. Drop it and go. No friction, no overhead, no decisions.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 6c2-2 4-2 7 0s5 2 7 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M3 10c2-2 4-2 7 0s5 2 7 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M3 14c2-2 4-2 7 0s5 2 7 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Organise nothing',
    body: 'No folders. No tags. No taxonomy. The AI builds all structure silently every time you save. Your only job is to notice something worth saving.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.1"/>
        <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M6 8.5h5M8.5 6v5" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Search like memory',
    body: 'Search by keyword, concept, or association. Notee finds what you meant — not just what you typed. The longer you use it, the more it reads like your mind.',
  },
]

const PILLARS = [
  { label: 'Local AI', sub: 'Runs on your device via WebGPU' },
  { label: 'Zero telemetry', sub: 'No data leaves without your action' },
  { label: 'Open source', sub: 'Apache 2.0 — read every line' },
  { label: 'Self-hostable', sub: 'Deploy on your own Cloudflare account' },
]

export default function Landing() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [heroLoaded, setHeroLoaded] = useState(false)

  // Nav transparency
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Scroll-reveal
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('sr-in'); obs.unobserve(e.target) }
      }),
      { threshold: 0.08 }
    )
    document.querySelectorAll('.sr').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="land">
      {/* Grain overlay */}
      <div className="land-grain" aria-hidden />

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className={`lnav${scrolled ? ' lnav--scrolled' : ''}`}>
        <span className="lnav-logo">notee</span>
        <div className="lnav-right">
          <a href="https://github.com" className="lnav-link" target="_blank" rel="noopener noreferrer">GitHub</a>
          <button className="lnav-btn" onClick={() => navigate('/app')}>
            Open app
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5h7M6 3l2.5 2.5L6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Hero landscape ──────────────────────────────────────────── */}
      <section className="hero-section">
        <div className={`hero-img-wrap${heroLoaded ? ' hero-img-wrap--loaded' : ''}`}>
          <img
            src="/hero.jpg"
            alt="A calm painted landscape — rolling hills, soft sky, reflective water"
            className="hero-img"
            onLoad={() => setHeroLoaded(true)}
          />
          {/* Bottom fade blends into the cream page */}
          <div className="hero-fade-btm" />
          {/* Subtle vignette */}
          <div className="hero-vignette" />
        </div>
      </section>

      {/* ── Headline ────────────────────────────────────────────────── */}
      <section className="headline-sec">
        <div className="lcontainer lcontainer--narrow">
          <p className="eyebrow sr">A privacy-first second brain</p>
          <h1 className="land-h1 sr">
            Capture everything.<br />Organise nothing.
          </h1>
          <p className="land-sub sr">
            The AI builds all structure silently in the background.<br />
            Search the way memory works — by association, not by folder.
          </p>
          <div className="headline-actions sr">
            <button className="land-cta-primary" onClick={() => navigate('/app')}>
              Start capturing
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5h8M7.5 4l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="cta-aside">Free · Open source · No account needed</span>
          </div>
        </div>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div className="land-divider" />

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="features-sec">
        <div className="lcontainer">
          <p className="section-eyebrow sr">How it works</p>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="feature-card sr"
                style={{ transitionDelay: `${i * 0.11}s` }}
              >
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tagline band ────────────────────────────────────────────── */}
      <section className="tagline-sec sr">
        <div className="lcontainer lcontainer--narrow">
          <div className="tagline-rule" />
          <blockquote className="tagline-quote">
            "The longer you use it, the more it feels like it reads your mind —
            because it has been learning how your mind works the entire time."
          </blockquote>
          <div className="tagline-rule" />
        </div>
      </section>

      {/* ── Privacy ─────────────────────────────────────────────────── */}
      <section className="privacy-sec">
        <div className="lcontainer">
          <div className="privacy-grid">
            <div className="privacy-left sr">
              <p className="eyebrow">Privacy first · Open source</p>
              <h2 className="land-h2">Your memory stays yours.</h2>
              <p className="land-body">
                No analytics. No data selling. No ads. All AI runs on your device —
                no text is sent to any external service. The core is Apache 2.0:
                read the code, fork it, run your own instance. Trust nothing on faith.
              </p>
              <p className="land-body" style={{ marginTop: '14px' }}>
                Self-hostable on your own Cloudflare account. Near-zero cost at
                early scale — Cloudflare's generous free tiers cover everything.
              </p>
            </div>
            <div className="privacy-right sr" style={{ transitionDelay: '0.12s' }}>
              {PILLARS.map(p => (
                <div key={p.label} className="pillar-row">
                  <div className="pillar-dot" />
                  <div>
                    <div className="pillar-label">{p.label}</div>
                    <div className="pillar-sub">{p.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="final-sec sr">
        <div className="lcontainer lcontainer--narrow final-inner">
          <h2 className="land-h2">Ready to stop forgetting?</h2>
          <p className="land-body">
            Every capture makes notee understand you better.
            In a year, it will feel like an extension of your mind.
          </p>
          <button className="land-cta-primary land-cta-primary--large" onClick={() => navigate('/app')}>
            Open notee
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5h8M7.5 4l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="lfooter">
        <div className="lcontainer lfooter-inner">
          <span className="lnav-logo" style={{ fontSize: '14px' }}>notee</span>
          <span className="lfooter-text">
            Privacy-first · Open source · Apache 2.0
          </span>
        </div>
      </footer>
    </div>
  )
}
