const TICK_MS = 50

/**
 * Ranked, multi-token sprite search with optional atlas + animated filters.
 * Tokens must all match as whole path/name segments (AND).
 * Results are sorted by relevance when a query is present.
 */
export function filterSprites(sprites, activeAtlas, query, { animatedOnly = false } = {}) {
  const tokens = tokenize(query)

  const matched = []

  for (const sprite of sprites) {
    if (activeAtlas !== 'all' && sprite.atlas !== activeAtlas) continue
    if (animatedOnly && !sprite.animated) continue

    const score = scoreSprite(sprite, tokens)
    if (score < 0) continue

    matched.push({ sprite, score })
  }

  if (tokens.length > 0) {
    matched.sort((a, b) => b.score - a.score || a.sprite.sprite.localeCompare(b.sprite.sprite))
  }

  return matched.map((entry) => entry.sprite)
}

export function buildSpriteSnippets(sprite, commandType) {
  const component = JSON.stringify({ atlas: sprite.atlas, sprite: sprite.sprite })
  const richComponent = JSON.stringify([{ text: 'Sprite: ' }, { atlas: sprite.atlas, sprite: sprite.sprite }])

  return {
    minimessage: {
      key: 'minimessage',
      label: 'MiniMessage',
      value: `<sprite:"${sprite.atlas}":${sprite.sprite}>`,
    },
    json: {
      key: 'json',
      label: 'JSON component',
      value: JSON.stringify({ atlas: sprite.atlas, sprite: sprite.sprite }, null, 2),
    },
    command: {
      key: `command-${commandType}`,
      label: 'Command',
      value: buildCommand(commandType, component, richComponent),
    },
  }
}

export function getAnimationDurationMs(animation) {
  if (!animation?.frames?.length) return 0
  return animation.frames.reduce((total, frame) => total + frame.time * TICK_MS, 0)
}

function tokenize(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/[\s,/|:]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function getSearchParts(sprite) {
  const name = sprite.name.toLowerCase()
  const path = sprite.sprite.toLowerCase()
  const leaf = path.split('/').at(-1) || path
  const atlas = `${sprite.atlas || ''} ${sprite.atlasName || ''}`.toLowerCase()
  const segments = `${path} ${name} ${atlas} ${sprite.id || ''}`
    .toLowerCase()
    .split(/[\s,/_:.-]+/)
    .filter(Boolean)

  return { name, path, leaf, atlas, segments }
}

function tokenMatches(parts, token) {
  if (parts.segments.some((segment) => segment === token || segment.startsWith(token))) {
    return true
  }

  // Allow searching atlas ids like "minecraft:blocks"
  if (parts.atlas.includes(token) || parts.path.includes(`/${token}`)) {
    return true
  }

  if (spriteHasAnimatedAlias(parts, token)) {
    return true
  }

  return false
}

function spriteHasAnimatedAlias(parts, token) {
  return (token === 'animated' || token === 'animation') && parts.segments.includes('animated')
}

function scoreSprite(sprite, tokens) {
  if (tokens.length === 0) return 0

  const parts = getSearchParts(sprite)
  if (sprite.animated) {
    parts.segments.push('animated', 'animation')
  }

  let score = 0

  for (const token of tokens) {
    if (!tokenMatches(parts, token)) return -1

    if (parts.leaf === token || parts.name === token || parts.segments.includes(token)) score += 120
    else if (parts.leaf.startsWith(token) || parts.name.startsWith(token)) score += 80
    else if (parts.segments.some((segment) => segment.startsWith(token))) score += 60
    else if (parts.path.includes(`/${token}`) || parts.path.startsWith(token)) score += 45
    else score += 15
  }

  if (sprite.animated) score += 2
  return score
}

function buildCommand(commandType, component, richComponent) {
  const commands = {
    chat: `/tellraw @s ${richComponent}`,
    actionbar: `/title @s actionbar ${richComponent}`,
    title: `/title @s title ${component}`,
    subtitle: `/title @s subtitle ${component}`,
  }

  return commands[commandType] || commands.chat
}
