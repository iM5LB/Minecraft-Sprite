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

    for (const sprite of spriteList) {
      const entry = byName.get(sprite.texturePath)
      if (!entry) continue

      const imageName = `${sprite.sprite.replaceAll('/', '__')}.png`
      const imagePath = path.join(atlasOutput, imageName)
      await fs.writeFile(imagePath, entry.getData())

      manifest.sprites.push({
        id: `${atlasName}:${sprite.sprite}`,
        name: titleCase(sprite.sprite.split('/').at(-1) || sprite.sprite),
        atlas: atlasId,
        atlasName,
        sprite: sprite.sprite,
        image: `/minecraft-sprites/${atlasName}/${imageName}`,
      })
    }

    manifest.atlases.push({
      id: atlasId,
      name: titleCase(atlasName),
      key: atlasName,
      count: spriteList.length,
      unsupported,
    })

    if (Object.keys(unsupported).length > 0) {
      manifest.unsupportedSources[atlasId] = unsupported
    }
  }

  manifest.atlases.sort((a, b) => a.name.localeCompare(b.name))
  manifest.sprites.sort((a, b) => `${a.atlas}:${a.sprite}`.localeCompare(`${b.atlas}:${b.sprite}`))

  await fs.writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Generated ${manifest.sprites.length} sprites from Minecraft ${versionId}.`)
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
