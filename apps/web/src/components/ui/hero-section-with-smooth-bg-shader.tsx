"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"

interface HeroSectionProps {
  title?: string
  highlightText?: string
  description?: string
  buttonText?: string
  onButtonClick?: () => void
  colors?: string[]
  distortion?: number
  swirl?: number
  speed?: number
  offsetX?: number
  className?: string
  titleClassName?: string
  descriptionClassName?: string
  buttonClassName?: string
  maxWidth?: string
  veilOpacity?: string
  fontFamily?: string
  fontWeight?: number
  children?: React.ReactNode
}

export function HeroSection({
  title,
  highlightText,
  description,
  buttonText,
  onButtonClick,
  colors = ["#1a0533", "#2d1b69", "#8B5CF6", "#1e1b4b", "#3b1578", "#0f0a1e"],
  distortion = 0.8,
  swirl = 0.6,
  speed = 0.42,
  offsetX = 0.08,
  className = "",
  titleClassName = "",
  descriptionClassName = "",
  buttonClassName = "",
  maxWidth = "max-w-6xl",
  veilOpacity = "bg-black/25",
  fontFamily,
  fontWeight,
  children,
}: HeroSectionProps) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick()
    }
  }

  return (
    <section className={`relative w-full min-h-screen overflow-hidden flex items-center justify-center ${className}`}>
      <div className="fixed inset-0 w-screen h-screen">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={colors}
              distortion={distortion}
              swirl={swirl}
              grainMixer={0}
              grainOverlay={0}
              speed={speed}
              offsetX={offsetX}
            />
            <div className={`absolute inset-0 pointer-events-none ${veilOpacity}`} />
          </>
        )}
      </div>

      <div className={`relative z-10 ${maxWidth} mx-auto px-6 w-full`}>
        {children ? (
          children
        ) : (
          <div className="text-center">
            {title && (
              <h1
                className={`font-normal text-white text-balance text-4xl sm:text-5xl md:text-6xl xl:text-[80px] leading-tight sm:leading-tight md:leading-tight lg:leading-tight xl:leading-[1.1] mb-6 lg:text-7xl ${titleClassName}`}
                style={{ fontFamily, fontWeight }}
              >
                {title} {highlightText && <span className="text-[#8B5CF6]">{highlightText}</span>}
              </h1>
            )}
            {description && (
              <p className={`text-lg sm:text-xl text-white/70 text-pretty max-w-2xl mx-auto leading-relaxed mb-10 px-4 ${descriptionClassName}`}>
                {description}
              </p>
            )}
            {buttonText && (
              <button
                onClick={handleButtonClick}
                className={`px-6 py-4 sm:px-8 sm:py-6 rounded-full border-4 bg-[rgba(63,63,63,1)] border-white/10 text-sm sm:text-base text-white hover:bg-[rgba(63,63,63,0.9)] transition-colors ${buttonClassName}`}
              >
                {buttonText}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Standalone fullscreen mesh gradient background.
 * Drop-in replacement for SmokeBackground — just renders the shader as a fixed layer.
 */
export function MeshGradientBackground({
  colors = ["#0f0515", "#1a0a2e", "#2a1045", "#120822", "#1f0d35", "#0a0310"],
  distortion = 1.0,
  swirl = 0.5,
  speed = 0.3,
}: {
  colors?: string[]
  distortion?: number
  swirl?: number
  speed?: number
}) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  if (!mounted) return <div className="fixed inset-0 z-0 bg-[#0a0a0f]" />

  return (
    <div className="fixed inset-0 z-0">
      <MeshGradient
        width={dimensions.width}
        height={dimensions.height}
        colors={colors}
        distortion={distortion}
        swirl={swirl}
        grainMixer={0}
        grainOverlay={0}
        speed={speed}
        offsetX={0.08}
      />
      <div className="absolute inset-0 pointer-events-none bg-black/30" />
    </div>
  )
}
