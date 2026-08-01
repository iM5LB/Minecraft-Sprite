import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileJson,
  Image,
  Menu,
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const searchRef = useRef(null)
  const detailRef = useRef(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

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

      if (event.key === 'Escape') {
        if (filtersOpen) {
          setFiltersOpen(false)
          return
        }
        if (document.activeElement === searchRef.current) {
          if (query) setQuery('')
          else searchRef.current?.blur()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filtersOpen, query])

  useEffect(() => {
    document.body.classList.toggle('filters-open', filtersOpen)
    return () => document.body.classList.remove('filters-open')
  }, [filtersOpen])

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
    setFiltersOpen(false)
  }

  function handleQueryChange(value) {
    setQuery(value)
    setPage(1)
  }

  function handleAnimatedOnlyChange(value) {
    setAnimatedOnly(value)
    setPage(1)
  }

  function handleSelectSprite(sprite) {
    setSelected(sprite)
    window.requestAnimationFrame(() => {
      if (isMobile) {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
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
    <main className={filtersOpen ? 'app-shell filters-open' : 'app-shell'}>
      <button
        className="sidebar-backdrop"
        onClick={() => setFiltersOpen(false)}
        type="button"
        aria-label="Close filters"
        tabIndex={filtersOpen ? 0 : -1}
      />

      <Sidebar
        activeAtlas={activeAtlas}
        animatedCount={manifest.animatedCount || 0}
        animatedOnly={animatedOnly}
        atlases={manifest.atlases}
        filtersOpen={filtersOpen}
        onAnimatedOnlyChange={handleAnimatedOnlyChange}
        onAtlasChange={handleAtlasChange}
        onCloseFilters={() => setFiltersOpen(false)}
        onQueryChange={handleQueryChange}
        query={query}
        searchRef={isMobile ? null : searchRef}
        totalSprites={manifest.sprites.length}
      />

      <section className="content">
        <Header
          activeAtlasLabel={activeAtlasMeta?.name || 'All atlases'}
          filteredCount={filtered.length}
          filtersOpen={filtersOpen}
          isDark={isDark}
          manifestVersion={manifest.version}
          onOpenFilters={() => setFiltersOpen(true)}
          onToggleTheme={toggleTheme}
          selected={selected}
        />

        <MobileToolbar
          activeAtlas={activeAtlas}
          animatedCount={manifest.animatedCount || 0}
          animatedOnly={animatedOnly}
          atlases={manifest.atlases}
          onAnimatedOnlyChange={handleAnimatedOnlyChange}
          onAtlasChange={handleAtlasChange}
          onOpenFilters={() => setFiltersOpen(true)}
          onQueryChange={handleQueryChange}
          query={query}
          searchRef={isMobile ? searchRef : null}
          totalSprites={manifest.sprites.length}
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
            onSelectSprite={handleSelectSprite}
            page={safePage}
            selectedId={selected?.id}
            sprites={visibleSprites}
          />
          <div className="detail-stack" ref={detailRef}>
            <SpritePreview selected={selected} />
            <CopyPanel
              commandType={commandType}
              copiedKey={copiedKey}
              onCommandTypeChange={setCommandType}
              onCopy={copyText}
              snippets={snippets}
            />
          </div>
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
  filtersOpen,
  onAnimatedOnlyChange,
  onAtlasChange,
  onCloseFilters,
  onQueryChange,
  query,
  searchRef,
  totalSprites,
}) {
  return (
    <aside className={filtersOpen ? 'sidebar open' : 'sidebar'} id="filters-drawer">
      <div className="brand">
        <Image size={24} />
        <div>
          <h1>{SITE_TITLE}</h1>
          <span>{totalSprites.toLocaleString()} sprites</span>
        </div>
        <button
          className="drawer-close"
          onClick={onCloseFilters}
          type="button"
          aria-label="Close filters"
        >
          <X size={18} />
        </button>
      </div>

      <div className="search-panel desktop-search">
        <SearchField onQueryChange={onQueryChange} query={query} searchRef={searchRef} />
        <AnimatedFilter
          active={animatedOnly}
          count={animatedCount}
          onToggle={() => onAnimatedOnlyChange(!animatedOnly)}
        />
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

function MobileToolbar({
  activeAtlas,
  animatedCount,
  animatedOnly,
  atlases,
  onAnimatedOnlyChange,
  onAtlasChange,
  onOpenFilters,
  onQueryChange,
  query,
  searchRef,
  totalSprites,
}) {
  return (
    <div className="mobile-toolbar">
      <SearchField onQueryChange={onQueryChange} query={query} searchRef={searchRef} />
      <div className="mobile-filter-row">
        <AnimatedFilter
          active={animatedOnly}
          count={animatedCount}
          onToggle={() => onAnimatedOnlyChange(!animatedOnly)}
        />
        <button className="toolbar-button filters-trigger" onClick={onOpenFilters} type="button">
          <Menu size={16} />
          Atlases
        </button>
      </div>
      <nav className="atlas-chips" aria-label="Minecraft atlases">
        <AtlasChip active={activeAtlas === 'all'} label="All" onClick={() => onAtlasChange('all')} />
        {atlases.map((atlas) => (
          <AtlasChip
            key={atlas.id}
            active={activeAtlas === atlas.id}
            animated={atlas.animatedCount > 0}
            label={atlas.name}
            onClick={() => onAtlasChange(atlas.id)}
          />
        ))}
        <span className="atlas-chip-spacer" aria-hidden="true" />
      </nav>
      <p className="mobile-count">{totalSprites.toLocaleString()} sprites available</p>
    </div>
  )
}

function SearchField({ onQueryChange, query, searchRef }) {
  return (
    <label className="search-box">
      <Search size={18} />
      <input
        ref={searchRef || undefined}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search name, path, atlas…"
        aria-label="Search sprites"
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
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
  )
}

function AnimatedFilter({ active, count, onToggle }) {
  return (
    <button
      className={active ? 'filter-chip active' : 'filter-chip'}
      onClick={onToggle}
      type="button"
    >
      <Play size={14} />
      Animated
      <b>{count}</b>
    </button>
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

function AtlasChip({ active, animated = false, label, onClick }) {
  return (
    <button className={active ? 'atlas-chip active' : 'atlas-chip'} onClick={onClick} type="button">
      {label}
      {animated ? <i className="anim-dot" /> : null}
    </button>
  )
}

function Header({
  activeAtlasLabel,
  filteredCount,
  filtersOpen,
  isDark,
  manifestVersion,
  onOpenFilters,
  onToggleTheme,
  selected,
}) {
  return (
    <header className="topbar">
      <div className="topbar-copy">
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
        <button
          className="toolbar-button mobile-only-flex"
          onClick={onOpenFilters}
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="filters-drawer"
        >
          <Menu size={17} />
          Filters
        </button>
        <a className="toolbar-button" href={`${import.meta.env.BASE_URL}minecraft-sprites/manifest.json`} download>
          <Download size={17} />
          <span className="button-label">Manifest</span>
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
          {filteredCount.toLocaleString()} / p. {page}/{maxPage}
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
          <div className="preview-copy">
            <strong>{selected.name}</strong>
            <span>{selected.atlas} / {selected.sprite}</span>
            {selected.animated ? (
              <em className="anim-meta">
                Animated · {selected.animation.frames.length} frames · {selected.animation.frametime} tick
                {selected.animation.frametime === 1 ? '' : 's'}/frame
              </em>
            ) : null}
          </div>
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
