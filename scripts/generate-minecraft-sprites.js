import AdmZip from 'adm-zip'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const manifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const root = process.cwd()
const outputRoot = path.join(root, 'public', 'minecraft-sprites')
const cacheRoot = path.join(root, '.cache', 'minecraft')
const requestedVersion = process.env.MINECRAFT_VERSION

async function main() {
  await fs.mkdir(outputRoot, { recursive: true })
  await fs.mkdir(cacheRoot, { recursive: true })

  const versions = await getJson(manifestUrl)
  const versionId = requestedVersion || versions.latest.release
  const versionMeta = versions.versions.find((version) => version.id === versionId)

  if (!versionMeta) {
    throw new Error(`Minecraft version ${versionId} was not found in Mojang's version manifest.`)
  }

  const version = await getJson(versionMeta.url)
  const client = version.downloads.client
  const jarPath = path.join(cacheRoot, `${versionId}.jar`)

  await downloadFile(client.url, jarPath, client.sha1)

  const zip = new AdmZip(jarPath)
  const entries = zip.getEntries()
  const byName = new Map(entries.map((entry) => [normalize(entry.entryName), entry]))
  const atlasEntries = entries.filter((entry) => /^assets\/minecraft\/atlases\/.+\.json$/.test(normalize(entry.entryName)))
  const manifest = {
    version: versionId,
    generatedAt: new Date().toISOString(),
    source: 'Mojang client jar',
    compatibility: 'Minecraft Java 1.21.9+ sprite text components. Some atlas source types are listed as unsupported.',
    atlases: [],
    sprites: [],
    unsupportedSources: {},
    animatedCount: 0,
  }

  for (const atlasEntry of atlasEntries) {
    const atlasName = path.basename(atlasEntry.entryName, '.json')
    const atlasId = `minecraft:${atlasName}`
    const atlasJson = JSON.parse(atlasEntry.getData().toString('utf8'))
    const spriteMap = new Map()
    const unsupported = {}

    for (const source of atlasJson.sources || []) {
      const type = collectSourceSprites(source, byName, spriteMap)
      if (type) unsupported[type] = (unsupported[type] || 0) + 1
    }

    const spriteList = [...spriteMap.values()].sort((a, b) => a.sprite.localeCompare(b.sprite))
    const atlasOutput = path.join(outputRoot, atlasName)
    await fs.rm(atlasOutput, { recursive: true, force: true })
    await fs.mkdir(atlasOutput, { recursive: true })

    let atlasAnimated = 0

    for (const sprite of spriteList) {
      const entry = byName.get(sprite.texturePath)
      if (!entry) continue

      const pngBuffer = entry.getData()
      const imageName = `${sprite.sprite.replaceAll('/', '__')}.png`
      const imagePath = path.join(atlasOutput, imageName)
      await fs.writeFile(imagePath, pngBuffer)

      const animation = readAnimationMeta(byName, sprite.texturePath, pngBuffer)
      if (animation) atlasAnimated += 1

      const record = {
        id: `${atlasName}:${sprite.sprite}`,
        name: titleCase(sprite.sprite.split('/').at(-1) || sprite.sprite),
        atlas: atlasId,
        atlasName,
        sprite: sprite.sprite,
        image: `/minecraft-sprites/${atlasName}/${imageName}`,
        animated: Boolean(animation),
      }

      if (animation) record.animation = animation

      manifest.sprites.push(record)
    }

    manifest.animatedCount += atlasAnimated

    manifest.atlases.push({
      id: atlasId,
      name: titleCase(atlasName),
      key: atlasName,
      count: spriteList.length,
      animatedCount: atlasAnimated,
      unsupported,
    })

    if (Object.keys(unsupported).length > 0) {
      manifest.unsupportedSources[atlasId] = unsupported
    }
  }

  manifest.atlases.sort((a, b) => a.name.localeCompare(b.name))
  manifest.sprites.sort((a, b) => `${a.atlas}:${a.sprite}`.localeCompare(`${b.atlas}:${b.sprite}`))

  await fs.writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(
    `Generated ${manifest.sprites.length} sprites (${manifest.animatedCount} animated) from Minecraft ${versionId}.`,
  )
}

function collectSourceSprites(source, byName, spriteMap) {
  const type = stripMinecraftNamespace(source.type)

  if (type === 'directory') {
    const sourceDir = `assets/minecraft/textures/${stripMinecraftNamespace(source.source)}/`
    const prefix = source.prefix || ''

    for (const [entryName, entry] of byName) {
      if (entry.isDirectory || !entryName.startsWith(sourceDir) || !entryName.endsWith('.png')) continue

      const relative = entryName.slice(sourceDir.length, -4)
      const sprite = `${prefix}${relative}`.replaceAll('\\', '/')
      spriteMap.set(sprite, { sprite, texturePath: entryName })
    }

    return null
  }

  if (type === 'single' && source.resource) {
    const resource = stripMinecraftNamespace(source.resource)
    const sprite = stripMinecraftNamespace(source.sprite || resource)
    const texturePath = `assets/minecraft/textures/${resource}.png`
    spriteMap.set(sprite, { sprite, texturePath })
    return null
  }

  return type || 'unknown'
}

function readAnimationMeta(byName, texturePath, pngBuffer) {
  const metaEntry = byName.get(`${texturePath}.mcmeta`)
  if (!metaEntry) return null

  let meta
  try {
    meta = JSON.parse(metaEntry.getData().toString('utf8'))
  } catch {
    return null
  }

  if (!meta?.animation) return null

  const size = readPngSize(pngBuffer)
  if (!size) return null

  const animation = meta.animation
  const frameWidth = Number(animation.width) || size.width
  const frameHeight = Number(animation.height) || frameWidth
  if (!frameWidth || !frameHeight || size.width % frameWidth !== 0) return null

  const columns = Math.max(1, Math.floor(size.width / frameWidth))
  const rows = Math.max(1, Math.floor(size.height / frameHeight))
  const frameCount = columns * rows
  if (frameCount < 2) return null

  const defaultFrametime = Math.max(1, Number(animation.frametime) || 1)
  const frames = normalizeAnimationFrames(animation.frames, frameCount, defaultFrametime)

  return {
    frametime: defaultFrametime,
    interpolate: Boolean(animation.interpolate),
    frameWidth,
    frameHeight,
    frameCount,
    frames,
  }
}

function normalizeAnimationFrames(rawFrames, frameCount, defaultFrametime) {
  if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
    return Array.from({ length: frameCount }, (_, index) => ({
      index,
      time: defaultFrametime,
    }))
  }

  return rawFrames
    .map((frame) => {
      if (typeof frame === 'number') {
        return { index: frame, time: defaultFrametime }
      }

      if (frame && typeof frame === 'object' && Number.isInteger(frame.index)) {
        return {
          index: frame.index,
          time: Math.max(1, Number(frame.time) || defaultFrametime),
        }
      }

      return null
    })
    .filter((frame) => frame && frame.index >= 0 && frame.index < frameCount)
}

function readPngSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`)
  return response.json()
}

async function downloadFile(url, destination, expectedSha1) {
  try {
    const existing = await fs.readFile(destination)
    if (!expectedSha1 || sha1(existing) === expectedSha1) return
  } catch {
    // Missing cache file, download below.
  }

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  if (expectedSha1 && sha1(buffer) !== expectedSha1) {
    throw new Error('Downloaded client jar failed SHA-1 verification.')
  }

  await fs.writeFile(destination, buffer)
}

function sha1(buffer) {
  return createHash('sha1').update(buffer).digest('hex')
}

function normalize(value) {
  return value.replaceAll('\\', '/')
}

function stripMinecraftNamespace(value = '') {
  return value.replace(/^minecraft:/, '')
}

function titleCase(value) {
  return value
    .replace(/^minecraft:/, '')
    .replaceAll('_', ' ')
    .replaceAll('/', ' / ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
