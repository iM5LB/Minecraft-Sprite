import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileJson,
  Image,
  Moon,
  RefreshCw,
  Search,
  Sun,
} from 'lucide-react'
import { useThemePreference } from './hooks/useThemePreference'
import { COMMAND_TYPES, FOOTER_LINKS, OWNER_NAME, PAGE_SIZE, SITE_TITLE } from './lib/appConfig'
import { buildSpriteSnippets, filterSprites } from './lib/spriteFormatters'
import './App.css'

function App() {
  const { isDark, toggleTheme } = useThemePreference()
  const [manifest, setManifest] = useState(null)
  const [activeAtlas, setActiveAtlas] = useState('minecraft:blocks')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [copiedKey, setCopiedKey] = useState('')
  const [commandType, setCommandType] = useState(COMMAND_TYPES[0].key)

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
          // Fix image paths to be relative to the deployment base URL
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
        if (!ignore) setManifest({ atlases: [], sprites: [], version: 'unknown' })
      })

    return () => {
      ignore = true
    }
  }, [])

  const filtered = useMemo(
    () => filterSprites(manifest?.sprites || [], activeAtlas, query),
    [activeAtlas, manifest, query],
  )
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleSprites = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const snippets = selected ? buildSpriteSnippets(selected, commandType) : null

  function handleAtlasChange(atlasId) {
    setActiveAtlas(atlasId)
    setPage(1)
    setSelected(null)
  }

  function handleQueryChange(value) {
    setQuery(value)
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
        atlases={manifest.atlases}
        onAtlasChange={handleAtlasChange}
        onQueryChange={handleQueryChange}
        query={query}
        totalSprites={manifest.sprites.length}
      />

      <section className="content">
        <Header
          isDark={isDark}
          manifestVersion={manifest.version}
          onToggleTheme={toggleTheme}
          selected={selected}
        />

        <section className="workbench">
          <SpriteBrowser
            filteredCount={filtered.length}
            maxPage={maxPage}
            onPageChange={setPage}
            onSelectSprite={setSelected}
            page={page}
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

function Sidebar({ activeAtlas, atlases, onAtlasChange, onQueryChange, query, totalSprites }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Image size={24} />
        <div>
          <h1>{SITE_TITLE}</h1>
        </div>
      </div>

      <label className="search-box">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search Minecraft sprites"
        />
      </label>

      <nav className="atlas-list" aria-label="Minecraft atlases">
        <AtlasButton active={activeAtlas === 'all'} count={totalSprites} label="All" onClick={() => onAtlasChange('all')} />
        {atlases.map((atlas) => (
          <AtlasButton
            key={atlas.id}
            active={activeAtlas === atlas.id}
            count={atlas.count}
            label={atlas.name}
            onClick={() => onAtlasChange(atlas.id)}
          />
        ))}
      </nav>
    </aside>
  )
}

function AtlasButton({ active, count, label, onClick }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick} type="button">
      <span>{label}</span>
      <b>{count}</b>
    </button>
  )
}

function Header({ isDark, manifestVersion, onToggleTheme, selected }) {
  return (
    <header className="topbar">
      <div>
        <p>Minecraft {manifestVersion}</p>
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

function SpriteBrowser({ filteredCount, maxPage, onPageChange, onSelectSprite, page, selectedId, sprites }) {
  return (
    <section className="sprite-browser">
      <div className="browser-head">
        <div className="section-title">
          <FileJson size={17} />
          <span>Minecraft sprites</span>
        </div>
        <span>{filteredCount} sprites / Page {page} of {maxPage}</span>
      </div>

      <div className="sprite-grid">
        {sprites.map((sprite) => (
          <button
            key={sprite.id}
            className={selectedId === sprite.id ? 'sprite active' : 'sprite'}
            onClick={() => onSelectSprite(sprite)}
            title={`${sprite.atlas} / ${sprite.sprite}`}
            type="button"
          >
            <img src={sprite.image} alt="" loading="lazy" />
            <span>{sprite.sprite}</span>
          </button>
        ))}
      </div>

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
          <img src={selected.image} alt="" />
          <strong>{selected.name}</strong>
          <span>{selected.atlas} / {selected.sprite}</span>
        </div>
      ) : (
        <div className="empty-state">
          <Image size={42} />
          <strong>Select a sprite</strong>
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
