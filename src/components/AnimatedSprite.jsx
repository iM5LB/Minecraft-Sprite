import { useEffect, useRef } from 'react'

const TICK_MS = 50

/**
 * Renders a Minecraft texture strip as a looping frame animation.
 * Falls back to a static <img> when animation metadata is missing.
 */
export function AnimatedSprite({ sprite, size = 34, className = '', alt = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!sprite?.animated || !sprite.animation) return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const { animation } = sprite
    const image = new Image()
    let framePointer = 0
    let elapsed = 0
    let lastTs = 0
    let rafId = 0
    let disposed = false

    image.decoding = 'async'
    image.src = sprite.image

    function drawFrame(index) {
      const columns = Math.max(1, Math.floor(image.naturalWidth / animation.frameWidth))
      const column = index % columns
      const row = Math.floor(index / columns)
      const sx = column * animation.frameWidth
      const sy = row * animation.frameHeight

      ctx.clearRect(0, 0, size, size)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(
        image,
        sx,
        sy,
        animation.frameWidth,
        animation.frameHeight,
        0,
        0,
        size,
        size,
      )
    }

    function tick(ts) {
      if (disposed) return

      if (!lastTs) lastTs = ts
      elapsed += ts - lastTs
      lastTs = ts

      const frames = animation.frames
      let current = frames[framePointer]
      let safety = frames.length + 1

      while (current && elapsed >= current.time * TICK_MS && safety > 0) {
        elapsed -= current.time * TICK_MS
        framePointer = (framePointer + 1) % frames.length
        current = frames[framePointer]
        safety -= 1
      }

      if (current) drawFrame(current.index)
      rafId = window.requestAnimationFrame(tick)
    }

    image.onload = () => {
      if (disposed) return
      canvas.width = size
      canvas.height = size
      drawFrame(animation.frames[0]?.index ?? 0)
      rafId = window.requestAnimationFrame(tick)
    }

    image.onerror = () => {
      // Keep blank canvas if the strip fails to load.
    }

    return () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
    }
  }, [sprite, size])

  if (!sprite) return null

  if (!sprite.animated || !sprite.animation) {
    return (
      <img
        className={className}
        src={sprite.image}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className={`animated-sprite ${className}`.trim()}
      width={size}
      height={size}
      aria-label={alt || sprite.name}
      role="img"
    />
  )
}
