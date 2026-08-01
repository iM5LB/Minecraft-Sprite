import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileJson,
  Image,
  Moon,
  Play,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react'
import { AnimatedSprite } from './components/AnimatedSprite'
import { useThemePreference } from './hooks/useThemePreference'
import { COMMAND_TYPES, FOOTER_LINKS, OWNER_NAME, PAGE_SIZE, SITE_TITLE } from './lib/appConfig'
import { buildSpriteSnippets, filterSprites } from './lib/spriteFormatters'
import './App.css'

function App() {
  const { isDark, toggleTheme } = useThemePreference()
  const [manifest, setManifest] = useState(null)
  const [activeAtlas, setActiveAtlas] = useState('all')
  const [query, setQuery] = useState('')
  const [animatedOnly, setAnimatedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [copiedKey, setCopiedKey] = useState('')
  const [commandType, setCommandType] = useState(COMMAND_TYPES[0].key)
  const searchRef = useRef(null)

  useEffect(() => {
    let ignore = false

    fetch(`${import.meta.env.BASE_URL}minecraft-sprites/manifest.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Manifest request failed: ${response.status}`)
        }

        return response.json()
      })
      .then((data) => {
        if (!ignore) {
          const base = import.meta.env.BASE_URL.replace(/\/$/, '')
          const fixed = {
            ...data,
            sprites: data.sprites.map((s) => ({
              ...s,
              image: base + s.image,
            })),
          }
          setManifest(fixed)
        }
      })
      .catch((error) => {
        console.error(error)
        if (!ignore) setManifest({ atlases: [], sprites: [], version: 'unknown', animatedCount: 0 })
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const tag = event.target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) {
          return
        }
        event.preventDefault()
        searchRef.current?.focus()
      }

      if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        if (query) setQuery('')
        else searchRef.current?.blur()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [query])

  const filtered = useMemo(
    () => filterSprites(manifest?.sprites || [], activeAtlas, query, { animatedOnly }),
    [activeAtlas, animatedOnly, manifest, query],
  )
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, maxPage)
  const visibleSprites = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const snippets = selected ? buildSpriteSnippets(selected, commandType) : null
  const activeAtlasMeta = activeAtlas === 'all'
    ? null
    : manifest?.atlases.find((atlas) => atlas.id === activeAtlas)

  function handleAtlasChange(atlasId) {
    setActiveAtlas(atlasId)
    setPage(1)
    setSelected(null)
  }

  function handleQueryChange(value) {
    setQuery(value)
    setPage(1)
  }

  function handleAnimatedOnlyChange(value) {
    setAnimatedOnly(value)
    setPage(1)
  }

  async function copyText(key, text) {
    await navigator.clipboard?.writeText(text)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(''), 1200)
  }

  if (!manifest) {
    return (
      <main className="loading-screen">
        <RefreshCw className="spin" />
        <span>Loading Minecraft sprite atlases</span>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Sidebar
        activeAtlas={activeAtlas}
        animatedCount={manifest.animatedCount || 0}
        animatedOnly={animatedOnly}
        atlases={manifest.atlases}
        onAnimatedOnlyChange={handleAnimatedOnlyChange}
        onAtlasChange={handleAtlasChange}
        onQueryChange={handleQueryChange}
        query={query}
        searchRef={searchRef}
        totalSprites={manifest.sprites.length}
      />

      <section className="content">
        <Header
          activeAtlasLabel={activeAtlasMeta?.name || 'All atlases'}
          filteredCount={filtered.length}
          isDark={isDark}
          manifestVersion={manifest.version}
          onToggleTheme={toggleTheme}
          selected={selected}
        />

        <section className="workbench">
          <SpriteBrowser
            filteredCount={filtered.length}
            hasQuery={Boolean(query.trim()) || animatedOnly}
            maxPage={maxPage}
            onClearFilters={() => {
              setQuery('')
              setAnimatedOnly(false)
              setPage(1)
            }}
            onPageChange={setPage}
            onSelectSprite={setSelected}
            page={safePage}
            selectedId={selected?.id}
            sprites={visibleSprites}
          />
          <SpritePreview selected={selected} />
          <CopyPanel
            commandType={commandType}
            copiedKey={copiedKey}
            onCommandTypeChange={setCommandType}
            onCopy={copyText}
            snippets={snippets}
          />
        </section>

        <SiteFooter />
      </section>
    </main>
  )
}

function Sidebar({
  activeAtlas,
  animatedCount,
  animatedOnly,
  atlases,
  onAnimatedOnlyChange,
  onAtlasChange,
  onQueryChange,
  query,
  searchRef,
  totalSprites,
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Image size={24} />
        <div>
          <h1>{SITE_TITLE}</h1>
          <span>{totalSprites.toLocaleString()} sprites</span>
        </div>
      </div>

      <div className="search-panel">
        <label className="search-box">
          <Search size={18} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search name, path, atlas…"
            aria-label="Search sprites"
          />
          {query ? (
            <button
              className="search-clear"
              onClick={() => onQueryChange('')}
              type="button"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          ) : (
            <kbd className="search-hint">/</kbd>
          )}
        </label>

        <button
          className={animatedOnly ? 'filter-chip active' : 'filter-chip'}
          onClick={() => onAnimatedOnlyChange(!animatedOnly)}
          type="button"
        >
          <Play size={14} />
          Animated only
          <b>{animatedCount}</b>
        </button>
      </div>

      <nav className="atlas-list" aria-label="Minecraft atlases">
        <AtlasButton
          active={activeAtlas === 'all'}
          count={totalSprites}
          label="All"
          onClick={() => onAtlasChange('all')}
        />
        {atlases.map((atlas) => (
          <AtlasButton
            key={atlas.id}
            active={activeAtlas === atlas.id}
            animatedCount={atlas.animatedCount}
            count={atlas.count}
            label={atlas.name}
            onClick={() => onAtlasChange(atlas.id)}
          />
        ))}
      </nav>
    </aside>
  )
}

function AtlasButton({ active, animatedCount = 0, count, label, onClick }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick} type="button">
      <span>
        {label}
        {animatedCount > 0 ? <i className="anim-dot" title={`${animatedCount} animated`} /> : null}
      </span>
      <b>{count}</b>
    </button>
  )
}

function Header({ activeAtlasLabel, filteredCount, isDark, manifestVersion, onToggleTheme, selected }) {
  return (
    <header className="topbar">
      <div>
        <p>
          Minecraft {manifestVersion}
          <span className="topbar-sep">·</span>
          {activeAtlasLabel}
          <span className="topbar-sep">·</span>
          {filteredCount.toLocaleString()} shown
        </p>
        <h2>{selected ? selected.name : 'Minecraft sprites'}</h2>
      </div>
      <div className="top-actions">
        <a className="toolbar-button" href={`${import.meta.env.BASE_URL}minecraft-sprites/manifest.json`} download>
          <Download size={17} />
          Manifest
        </a>
        <button className="toolbar-button icon-only" onClick={onToggleTheme} type="button" aria-label="Toggle theme">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}

function SpriteBrowser({
  filteredCount,
  hasQuery,
  maxPage,
  onClearFilters,
  onPageChange,
  onSelectSprite,
  page,
  selectedId,
  sprites,
}) {
  return (
    <section className="sprite-browser">
      <div className="browser-head">
        <div className="section-title">
          <FileJson size={17} />
          <span>Minecraft sprites</span>
        </div>
        <span>
          {filteredCount.toLocaleString()} sprites / Page {page} of {maxPage}
        </span>
      </div>

      {sprites.length === 0 ? (
        <div className="empty-state empty-state--browser">
          <Search size={36} />
          <strong>No sprites match</strong>
          <span>Try another search term or atlas filter.</span>
          {hasQuery ? (
            <button className="toolbar-button" onClick={onClearFilters} type="button">
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="sprite-grid">
          {sprites.map((sprite) => (
            <button
              key={sprite.id}
              className={selectedId === sprite.id ? 'sprite active' : 'sprite'}
              onClick={() => onSelectSprite(sprite)}
              title={`${sprite.atlas} / ${sprite.sprite}${sprite.animated ? ' (animated)' : ''}`}
              type="button"
            >
              <span className="sprite-thumb">
                <AnimatedSprite sprite={sprite} size={34} />
                {sprite.animated ? <i className="sprite-anim-badge" title="Animated">▶</i> : null}
              </span>
              <span>{sprite.sprite.split('/').at(-1)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="pager">
        <button disabled={page === 1} onClick={() => onPageChange((value) => Math.max(1, value - 1))} type="button">
          Previous
        </button>
        <button disabled={page === maxPage} onClick={() => onPageChange((value) => Math.min(maxPage, value + 1))} type="button">
          Next
        </button>
      </div>
    </section>
  )
}

function SpritePreview({ selected }) {
  return (
    <div className="preview-panel">
      {selected ? (
        <div className="game-preview">
          <AnimatedSprite className="preview-sprite" sprite={selected} size={160} />
          <strong>{selected.name}</strong>
          <span>{selected.atlas} / {selected.sprite}</span>
          {selected.animated ? (
            <em className="anim-meta">
              Animated · {selected.animation.frames.length} frames · {selected.animation.frametime} tick
              {selected.animation.frametime === 1 ? '' : 's'}/frame
            </em>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">
          <Image size={42} />
          <strong>Select a sprite</strong>
          <span>Browse all atlases or search by name</span>
        </div>
      )}
    </div>
  )
}

function CopyPanel({ commandType, copiedKey, onCommandTypeChange, onCopy, snippets }) {
  return (
    <div className="copy-panel">
      <div className="section-title">
        <Clipboard size={17} />
        <span>Copy formats</span>
      </div>
      {snippets ? (
        <>
          <Snippet copiedKey={copiedKey} onCopy={onCopy} snippet={snippets.minimessage} />
          <Snippet copiedKey={copiedKey} onCopy={onCopy} snippet={snippets.json} />
          <article className="snippet command-snippet">
            <div className="snippet-head">
              <select value={commandType} onChange={(event) => onCommandTypeChange(event.target.value)} aria-label="Command type">
                {COMMAND_TYPES.map((type) => (
                  <option key={type.key} value={type.key}>{type.label}</option>
                ))}
              </select>
              <CopyButton copied={copiedKey === snippets.command.key} label="Copy command" onClick={() => onCopy(snippets.command.key, snippets.command.value)} />
            </div>
            <pre>{snippets.command.value}</pre>
          </article>
        </>
      ) : (
        <div className="empty-state empty-state--small">
          <Clipboard size={32} />
          <strong>Pick a sprite to show formats</strong>
        </div>
      )}
    </div>
  )
}

function Snippet({ copiedKey, onCopy, snippet }) {
  return (
    <article className="snippet">
      <div className="snippet-head">
        <span>{snippet.label}</span>
        <CopyButton copied={copiedKey === snippet.key} label={`Copy ${snippet.label}`} onClick={() => onCopy(snippet.key, snippet.value)} />
      </div>
      <pre>{snippet.value}</pre>
    </article>
  )
}

function CopyButton({ copied, label, onClick }) {
  return (
    <button onClick={onClick} type="button" aria-label={label}>
      {copied ? <Check size={16} /> : <Clipboard size={16} />}
    </button>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-links">
        {FOOTER_LINKS.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
            <ExternalLink size={13} />
          </a>
        ))}
      </div>
      <span>&copy; 2026 {OWNER_NAME}</span>
    </footer>
  )
}

export default App
