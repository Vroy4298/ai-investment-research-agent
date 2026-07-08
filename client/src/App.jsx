import { useState, useEffect, useRef } from 'react';
import { analyzeCompany } from './services/api';

// ─── Agent console steps ──────────────────────────────────────────────────────
const CONSOLE_STEPS = [
  { id: 1, text: 'Initializing autonomous research agent...' },
  { id: 2, text: 'Connecting to Tavily Intelligence API...' },
  { id: 3, text: 'Dispatching multi-query web search cycle...' },
  { id: 4, text: 'Extracting financial statements & growth metrics...' },
  { id: 5, text: 'Evaluating competitive moat & market positioning...' },
  { id: 6, text: 'Assessing regulatory & operational risk vectors...' },
  { id: 7, text: 'Running LangGraph ReAct decision loop...' },
  { id: 8, text: 'Synthesizing structured investment recommendation...' },
];

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar() {
  return (
    <header className="topbar">
      <div className="logo">
        <div className="logo-dot" />
        SIGNAL
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Investment Intelligence Engine
        </span>
        <span className="topbar-badge">v1.0 · BETA</span>
      </div>
    </header>
  );
}

// ─── Landing / Search ─────────────────────────────────────────────────────────
function LandingSearch({ onSubmit, loading }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim().length >= 2) onSubmit(value.trim());
  };

  return (
    <main className="landing">
      <p className="landing-eyebrow">Powered by Gemini · LangGraph · Tavily</p>
      <h1 className="landing-title">
        Find the <span>Signal</span><br />in the Noise
      </h1>
      <p className="landing-sub">
        Autonomous AI agent that researches any public or private company
        across 5 dimensions and delivers a data-backed INVEST or PASS verdict.
      </p>

      <form className="search-container" onSubmit={handleSubmit}>
        <span className="terminal-prefix">&gt;</span>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Analyze: Apple, Tesla, Nvidia..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          autoComplete="off"
          spellCheck="false"
          minLength={2}
        />
        <button
          type="submit"
          className="search-btn"
          disabled={loading || value.trim().length < 2}
        >
          {loading ? '···' : 'RUN →'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {['Apple Inc', 'Tesla', 'Nvidia', 'Microsoft'].map((c) => (
          <button
            key={c}
            onClick={() => onSubmit(c)}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              padding: '0.35rem 0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            {c}
          </button>
        ))}
      </div>
    </main>
  );
}

// ─── Console Loading ──────────────────────────────────────────────────────────
function ConsoleLoading({ company }) {
  const [visibleSteps, setVisibleSteps] = useState([0]);

  useEffect(() => {
    const timers = CONSOLE_STEPS.slice(1).map((_, i) =>
      setTimeout(() => {
        setVisibleSteps((prev) => [...prev, i + 1]);
      }, (i + 1) * 2800)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
        Researching · {company}
      </p>

      <div className="console-panel animate-fade-in-up">
        <div className="console-topbar">
          <div className="console-dot" style={{ background: '#ff5f57' }} />
          <div className="console-dot" style={{ background: '#febc2e' }} />
          <div className="console-dot" style={{ background: '#28c840' }} />
          <span className="console-title">signal — autonomous-research-agent</span>
        </div>

        <div className="console-body">
          {CONSOLE_STEPS.map((step, i) => {
            const isVisible = visibleSteps.includes(i);
            const isActive  = i === visibleSteps[visibleSteps.length - 1];
            const isDone    = visibleSteps.includes(i) && !isActive;

            if (!isVisible) return null;

            return (
              <div
                key={step.id}
                className={`console-line ${isDone ? 'done' : 'active'}`}
              >
                <span className="console-line-prefix">
                  {isDone ? '✓' : '$'}
                </span>
                <span>{step.text}</span>
                {isActive && <span className="cursor-blink" />}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// ─── Results Two-Panel ────────────────────────────────────────────────────────
const TABS = ['Overview', 'Financials', 'Risks', 'Reasoning'];

function ResultsLayout({ result, onReset }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [query, setQuery] = useState(result.companyName);

  const isInvest = result.decision.decision === 'INVEST';
  const colorMain = isInvest ? 'var(--invest)' : 'var(--pass)';

  return (
    <div className="results-layout animate-fade-in-up">
      {/* Top search bar (re-search) */}
      <div className="results-search-bar">
        <span className="terminal-prefix">&gt;</span>
        <input
          className="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim().length >= 2) {
              onReset(query.trim());
            }
          }}
          spellCheck="false"
        />
        <button
          className="search-btn"
          onClick={() => query.trim().length >= 2 && onReset(query.trim())}
        >
          RUN →
        </button>
      </div>

      {/* Left: Verdict panel */}
      <aside className="verdict-panel">
        <div>
          <p className="verdict-label">Research Target</p>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
            {result.companyName}
          </p>
        </div>

        <div>
          <p className="verdict-label" style={{ marginBottom: '0.75rem' }}>Verdict</p>
          <div className={`verdict-badge ${isInvest ? 'verdict-invest' : 'verdict-pass'}`}>
            {isInvest ? '▲ INVEST' : '▼ PASS'}
          </div>
        </div>

        <div className="confidence-block">
          <div className="confidence-label">
            <span>Confidence</span>
            <span className="confidence-value">{result.decision.confidence}%</span>
          </div>
          <div className="confidence-track">
            <div
              className="confidence-fill"
              style={{
                width: `${result.decision.confidence}%`,
                background: isInvest
                  ? 'linear-gradient(90deg, #00a854, var(--invest))'
                  : 'linear-gradient(90deg, #cc4400, var(--pass))',
              }}
            />
          </div>
        </div>

        <div className="verdict-meta">
          <div className="meta-row">
            <span className="meta-key">searches</span>
            <span className="meta-value">{result.metadata.searchesPerformed}</span>
          </div>
          <div className="meta-row">
            <span className="meta-key">duration</span>
            <span className="meta-value">{(result.metadata.researchDurationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="meta-row">
            <span className="meta-key">model</span>
            <span className="meta-value">llama-3.3-70b (Groq)</span>
          </div>
          <div className="meta-row">
            <span className="meta-key">generated</span>
            <span className="meta-value">{new Date(result.metadata.generatedAt).toLocaleTimeString()}</span>
          </div>
        </div>

        <button className="btn-new-analysis" onClick={() => onReset(null)}>
          ← New Analysis
        </button>
      </aside>

      {/* Right: Tabbed brief */}
      <section className="brief-panel">
        <div className="brief-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`brief-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="brief-content">
          {activeTab === 'Overview' && (
            <>
              <div>
                <p className="section-label">Executive Summary</p>
                <p className="summary-text">{result.decision.summary}</p>
              </div>
              <div>
                <p className="section-label">Key Strengths</p>
                <ul className="brief-list list-invest">
                  {result.decision.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </>
          )}

          {activeTab === 'Financials' && (
            <div>
              <p className="section-label">Financial Highlights</p>
              <table className="metrics-table">
                <tbody>
                  {result.decision.financialHighlights.map((h, i) => (
                    <tr key={i}>
                      <td>{h.metric}</td>
                      <td>{h.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Risks' && (
            <div>
              <p className="section-label">Primary Risk Factors</p>
              <ul className="brief-list list-pass">
                {result.decision.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {activeTab === 'Reasoning' && (
            <>
              <div>
                <p className="section-label">Analyst Reasoning</p>
                <p className="reasoning-text">{result.decision.reasoning}</p>
              </div>
              {result.decision.sources?.length > 0 && (
                <div>
                  <p className="section-label">Sources</p>
                  <div className="sources-list">
                    {result.decision.sources.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="source-link">
                        {src}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────
function ErrorState({ error, onReset }) {
  const hints = {
    LLM_RATE_LIMIT: 'The AI service rate limit was reached (free tier). Please wait 1–2 minutes before retrying.',
    RECURSION_LIMIT_EXCEEDED: 'The research agent timed out. Try a more widely-covered company.',
    NETWORK_ERROR: 'Cannot reach the server. Make sure the backend is running on port 5000.',
    VALIDATION_ERROR: 'Company name must be between 2 and 100 characters.',
  };

  return (
    <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="error-panel animate-fade-in-up">
        <p className="error-code">ERROR · {error.code || 'UNKNOWN'}</p>
        <p className="error-msg">{error.message}</p>
        {hints[error.code] && (
          <p className="error-hint">{hints[error.code]}</p>
        )}
        <button className="btn-retry" onClick={() => onReset(null)}>
          ← Try Again
        </button>
      </div>
    </main>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [status, setStatus] = useState('idle');   // idle | loading | success | error
  const [company, setCompany] = useState('');
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const runAnalysis = async (companyName) => {
    if (!companyName) { setStatus('idle'); return; }
    setCompany(companyName);
    setStatus('loading');
    setError(null);
    setResult(null);

    try {
      const data = await analyzeCompany(companyName);
      setResult(data);
      setStatus('success');
    } catch (err) {
      setError({ message: err.message, code: err.code, fields: err.fields });
      setStatus('error');
    }
  };

  return (
    <div className="app-shell">
      <Topbar />

      {status === 'idle' && (
        <LandingSearch onSubmit={runAnalysis} loading={false} />
      )}

      {status === 'loading' && (
        <ConsoleLoading company={company} />
      )}

      {status === 'success' && result && (
        <ResultsLayout result={result} onReset={runAnalysis} />
      )}

      {status === 'error' && (
        <ErrorState error={error} onReset={runAnalysis} />
      )}
    </div>
  );
}
