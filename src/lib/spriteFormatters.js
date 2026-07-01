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

export function filterSprites(sprites, activeAtlas, query) {
  const search = query.trim().toLowerCase()

  return sprites.filter((sprite) => {
    const matchesAtlas = activeAtlas === 'all' || sprite.atlas === activeAtlas
    const matchesSearch = `${sprite.name} ${sprite.sprite} ${sprite.atlas}`.toLowerCase().includes(search)
    return matchesAtlas && matchesSearch
  })
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
