"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, Square, Upload, Play, Pause, Download, ZoomIn, ZoomOut, Trash2, Save, BarChart3, Scissors, Volume2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"

interface KeyPress {
  id: string
  key: string
  code: string
  time: number
  startTime: number
  endTime: number
  selected: boolean
}

interface AudioData {
  buffer: AudioBuffer
  samples: Float32Array
  duration: number
  sampleRate: number
}

// Enhanced keyboard layout for more realistic visualization
const KEYBOARD_LAYOUT = [
  [
    { key: "`", width: "w-10", label: "`", secondary: "~" },
    { key: "1", width: "w-10", label: "1", secondary: "!" },
    { key: "2", width: "w-10", label: "2", secondary: "@" },
    { key: "3", width: "w-10", label: "3", secondary: "#" },
    { key: "4", width: "w-10", label: "4", secondary: "$" },
    { key: "5", width: "w-10", label: "5", secondary: "%" },
    { key: "6", width: "w-10", label: "6", secondary: "^" },
    { key: "7", width: "w-10", label: "7", secondary: "&" },
    { key: "8", width: "w-10", label: "8", secondary: "*" },
    { key: "9", width: "w-10", label: "9", secondary: "(" },
    { key: "0", width: "w-10", label: "0", secondary: ")" },
    { key: "-", width: "w-10", label: "-", secondary: "_" },
    { key: "=", width: "w-10", label: "=", secondary: "+" },
    { key: "Backspace", width: "w-20", label: "Backspace", secondary: "" }
  ],
  [
    { key: "Tab", width: "w-16", label: "Tab", secondary: "" },
    { key: "q", width: "w-10", label: "Q", secondary: "" },
    { key: "w", width: "w-10", label: "W", secondary: "" },
    { key: "e", width: "w-10", label: "E", secondary: "" },
    { key: "r", width: "w-10", label: "R", secondary: "" },
    { key: "t", width: "w-10", label: "T", secondary: "" },
    { key: "y", width: "w-10", label: "Y", secondary: "" },
    { key: "u", width: "w-10", label: "U", secondary: "" },
    { key: "i", width: "w-10", label: "I", secondary: "" },
    { key: "o", width: "w-10", label: "O", secondary: "" },
    { key: "p", width: "w-10", label: "P", secondary: "" },
    { key: "[", width: "w-10", label: "[", secondary: "{" },
    { key: "]", width: "w-10", label: "]", secondary: "}" },
    { key: "\\", width: "w-14", label: "\\", secondary: "|" }
  ],
  [
    { key: "CapsLock", width: "w-20", label: "Caps Lock", secondary: "" },
    { key: "a", width: "w-10", label: "A", secondary: "" },
    { key: "s", width: "w-10", label: "S", secondary: "" },
    { key: "d", width: "w-10", label: "D", secondary: "" },
    { key: "f", width: "w-10", label: "F", secondary: "" },
    { key: "g", width: "w-10", label: "G", secondary: "" },
    { key: "h", width: "w-10", label: "H", secondary: "" },
    { key: "j", width: "w-10", label: "J", secondary: "" },
    { key: "k", width: "w-10", label: "K", secondary: "" },
    { key: "l", width: "w-10", label: "L", secondary: "" },
    { key: ";", width: "w-10", label: ";", secondary: ":" },
    { key: "'", width: "w-10", label: "'", secondary: "\"" },
    { key: "Enter", width: "w-24", label: "Enter", secondary: "" }
  ],
  [
    { key: "ShiftLeft", width: "w-28", label: "Shift", secondary: "" },
    { key: "z", width: "w-10", label: "Z", secondary: "" },
    { key: "x", width: "w-10", label: "X", secondary: "" },
    { key: "c", width: "w-10", label: "C", secondary: "" },
    { key: "v", width: "w-10", label: "V", secondary: "" },
    { key: "b", width: "w-10", label: "B", secondary: "" },
    { key: "n", width: "w-10", label: "N", secondary: "" },
    { key: "m", width: "w-10", label: "M", secondary: "" },
    { key: ",", width: "w-10", label: ",", secondary: "<" },
    { key: ".", width: "w-10", label: ".", secondary: ">" },
    { key: "/", width: "w-10", label: "/", secondary: "?" },
    { key: "ShiftRight", width: "w-28", label: "Shift", secondary: "" }
  ],
  [
    { key: "ControlLeft", width: "w-16", label: "Ctrl", secondary: "" },
    { key: "MetaLeft", width: "w-14", label: "⊞", secondary: "" },
    { key: "AltLeft", width: "w-16", label: "Alt", secondary: "" },
    { key: " ", width: "w-72", label: "Space", secondary: "" },
    { key: "AltRight", width: "w-16", label: "Alt", secondary: "" },
    { key: "MetaRight", width: "w-14", label: "⊞", secondary: "" },
    { key: "ContextMenu", width: "w-14", label: "☰", secondary: "" },
    { key: "ControlRight", width: "w-16", label: "Ctrl", secondary: "" }
  ]
]

export default function AudioWaveformAnalyzer() {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const recordingStartTimeRef = useRef<number>(0)
  const animationFrameRef = useRef<number>(0)

  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioData, setAudioData] = useState<AudioData | null>(null)
  const [keyPresses, setKeyPresses] = useState<KeyPress[]>([])
  const [selectedKeyPresses, setSelectedKeyPresses] = useState<Set<string>>(new Set())
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())
  const [currentTime, setCurrentTime] = useState(0)
  const [showSpectrogram, setShowSpectrogram] = useState(false)
  const [trimStart, setTrimStart] = useState<number | null>(null)
  const [trimEnd, setTrimEnd] = useState<number | null>(null)

  // Zoom and pan
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [lastMouseX, setLastMouseX] = useState(0)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (event: KeyboardEvent) => {
      // Don't interfere with recording mode
      if (isRecording) return
      
      // Only handle shortcuts when not in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'r':
            event.preventDefault()
            if (!isRecording) {
              startRecording()
            }
            break
          case ' ':
            event.preventDefault()
            if (audioData) {
              togglePlayback()
            }
            break
          case 's':
            event.preventDefault()
            if (selectedKeyPresses.size > 0) {
              exportSelectedSegments()
            }
            break
          case 'a':
            event.preventDefault()
            if (keyPresses.length > 0) {
              const allIds = new Set(keyPresses.map(kp => kp.id))
              setSelectedKeyPresses(allIds)
              setKeyPresses(prev => prev.map(kp => ({ ...kp, selected: true })))
            }
            break
          case 'd':
            event.preventDefault()
            setSelectedKeyPresses(new Set())
            setKeyPresses(prev => prev.map(kp => ({ ...kp, selected: false })))
            break
        }
      } else {
        // Single key shortcuts
        switch (event.key.toLowerCase()) {
          case 'escape':
            if (isRecording) {
              stopRecording()
            }
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcuts)
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts)
  }, [isRecording, audioData, selectedKeyPresses, keyPresses])

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Update playhead position during playback
  const updatePlayhead = useCallback(() => {
    if (audioRef.current && isPlaying && audioData) {
      setCurrentTime(audioRef.current.currentTime)
      animationFrameRef.current = requestAnimationFrame(updatePlayhead)
    }
  }, [isPlaying, audioData])

  useEffect(() => {
    if (isPlaying) {
      updatePlayhead()
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, updatePlayhead])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isRecording) return

      // Prevent duplicate events for held keys
      if (event.repeat) return

      const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000
      const keyPress: KeyPress = {
        id: `key-${Date.now()}-${Math.random()}`,
        key: event.key,
        code: event.code,
        time: currentTime,
        startTime: Math.max(0, currentTime - 0.5),
        endTime: currentTime + 0.5,
        selected: false,
      }

      setKeyPresses((prev) => [...prev, keyPress])
      setActiveKeys((prev) => new Set([...prev, event.code]))

      // Remove active key after a short delay
      setTimeout(() => {
        setActiveKeys((prev) => {
          const newSet = new Set(prev)
          newSet.delete(event.code)
          return newSet
        })
      }, 150)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      setActiveKeys((prev) => {
        const newSet = new Set(prev)
        newSet.delete(event.code)
        return newSet
      })
    }

    if (isRecording) {
      window.addEventListener("keydown", handleKeyDown)
      window.addEventListener("keyup", handleKeyUp)
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isRecording])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      recordingStartTimeRef.current = Date.now()
      setKeyPresses([]) // Clear previous key presses

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/wav" })
        await processAudioBlob(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start(100)
      setIsRecording(true)
      setRecordedChunks(chunks)

      toast({
        title: "Recording started",
        description: "Start typing to capture key presses with audio",
      })
    } catch (error) {
      toast({
        title: "Recording failed",
        description: "Could not access microphone",
        variant: "destructive",
      })
    }
  }, [toast])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setActiveKeys(new Set()) // Clear active keys
      toast({
        title: "Recording stopped",
        description: "Processing audio...",
      })
    }
  }, [isRecording, toast])

  // Process audio blob
  const processAudioBlob = useCallback(
    async (blob: Blob) => {
      if (!audioContextRef.current) return

      try {
        const arrayBuffer = await blob.arrayBuffer()
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)

        const samples = audioBuffer.getChannelData(0)
        const audioData: AudioData = {
          buffer: audioBuffer,
          samples,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
        }

        setAudioData(audioData)

        setKeyPresses((prev) =>
          prev.map((kp) => ({
            ...kp,
            endTime: Math.min(kp.endTime, audioData.duration),
          })),
        )

        // Create audio element for playback
        const audioUrl = URL.createObjectURL(blob)
        if (audioRef.current) {
          audioRef.current.src = audioUrl
        }
      } catch (error) {
        toast({
          title: "Audio processing failed",
          description: "Could not process audio file",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  // Handle file upload
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const validTypes = ["audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/flac"]
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a WAV, MP3, OGG, or FLAC file",
          variant: "destructive",
        })
        return
      }

      await processAudioBlob(file)
    },
    [processAudioBlob, toast],
  )

  // Draw waveform with enhanced visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !audioData) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas
    const { samples, duration } = audioData

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, "#f8fafc")
    gradient.addColorStop(1, "#f1f5f9")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Calculate visible range based on zoom and pan
    const visibleDuration = duration / zoomLevel
    const startTime = panOffset
    const endTime = Math.min(duration, startTime + visibleDuration)

    const startSample = Math.floor(startTime * audioData.sampleRate)
    const endSample = Math.floor(endTime * audioData.sampleRate)
    const visibleSamples = endSample - startSample

    // Draw waveform with enhanced styling
    if (showSpectrogram) {
      // Simple spectrogram visualization
      ctx.fillStyle = "#3b82f6"
      for (let x = 0; x < width; x += 2) {
        const sampleIndex = startSample + Math.floor((x / width) * visibleSamples)
        if (sampleIndex < samples.length) {
          const amplitude = Math.abs(samples[sampleIndex])
          const barHeight = amplitude * height * 0.8
          const hue = 220 + amplitude * 60
          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`
          ctx.fillRect(x, height / 2 - barHeight / 2, 2, barHeight)
        }
      }
    } else {
      // Traditional waveform
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2
      ctx.beginPath()

      // Draw filled waveform
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)"
      ctx.beginPath()
      ctx.moveTo(0, height / 2)

      for (let x = 0; x < width; x++) {
        const sampleIndex = startSample + Math.floor((x / width) * visibleSamples)
        if (sampleIndex < samples.length) {
          const amplitude = samples[sampleIndex]
          const y = height / 2 - (amplitude * height) / 2
          ctx.lineTo(x, y)
        }
      }
      ctx.lineTo(width, height / 2)
      ctx.closePath()
      ctx.fill()

      // Draw waveform outline
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 1.5
      ctx.beginPath()

      for (let x = 0; x < width; x++) {
        const sampleIndex = startSample + Math.floor((x / width) * visibleSamples)
        if (sampleIndex < samples.length) {
          const amplitude = samples[sampleIndex]
          const y = height / 2 - (amplitude * height) / 2

          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
      }
      ctx.stroke()
    }

    // Draw trim markers
    if (trimStart !== null && trimStart >= startTime && trimStart <= endTime) {
      const x = ((trimStart - startTime) / visibleDuration) * width
      ctx.strokeStyle = "#10b981"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      
      ctx.fillStyle = "#10b981"
      ctx.font = "12px monospace"
      ctx.fillText("Start", x + 5, 20)
    }

    if (trimEnd !== null && trimEnd >= startTime && trimEnd <= endTime) {
      const x = ((trimEnd - startTime) / visibleDuration) * width
      ctx.strokeStyle = "#f59e0b"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      
      ctx.fillStyle = "#f59e0b"
      ctx.font = "12px monospace"
      ctx.fillText("End", x + 5, 20)
    }

    // Draw playhead
    if (currentTime >= startTime && currentTime <= endTime) {
      const x = ((currentTime - startTime) / visibleDuration) * width
      
      // Playhead line with glow effect
      ctx.shadowColor = "#ef4444"
      ctx.shadowBlur = 10
      ctx.strokeStyle = "#ef4444"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      
      // Reset shadow
      ctx.shadowBlur = 0
      
      // Playhead indicator
      ctx.fillStyle = "#ef4444"
      ctx.beginPath()
      ctx.arc(x, 10, 6, 0, Math.PI * 2)
      ctx.fill()
      
      // Time display
      ctx.fillStyle = "#ef4444"
      ctx.font = "bold 14px monospace"
      const timeText = `${currentTime.toFixed(2)}s`
      const textWidth = ctx.measureText(timeText).width
      ctx.fillText(timeText, x - textWidth / 2, height - 10)
    }

    // Draw key press markers with enhanced styling
    keyPresses.forEach((keyPress, index) => {
      if (keyPress.time >= startTime && keyPress.time <= endTime) {
        const x = ((keyPress.time - startTime) / visibleDuration) * width

        // Key press line
        ctx.strokeStyle = keyPress.selected ? "#dc2626" : "#8b5cf6"
        ctx.lineWidth = keyPress.selected ? 3 : 2
        ctx.setLineDash(keyPress.selected ? [] : [5, 3])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
        ctx.setLineDash([])

        // Enhanced key label with background
        const keyLabel = keyPress.key === " " ? "Space" : keyPress.key
        ctx.font = "12px monospace"
        const labelWidth = ctx.measureText(keyLabel).width
        
        // Label background
        ctx.fillStyle = keyPress.selected ? "#dc2626" : "#8b5cf6"
        ctx.fillRect(x - labelWidth / 2 - 4, 25, labelWidth + 8, 18)
        
        // Label text
        ctx.fillStyle = "white"
        ctx.fillText(keyLabel, x - labelWidth / 2, 37)

        // Selection highlight with animation
        if (keyPress.selected) {
          ctx.fillStyle = "rgba(220, 38, 38, 0.15)"
          const selectionStart = ((keyPress.startTime - startTime) / visibleDuration) * width
          const selectionEnd = ((keyPress.endTime - startTime) / visibleDuration) * width
          ctx.fillRect(selectionStart, 0, selectionEnd - selectionStart, height)
          
          // Animated border
          const time = Date.now() / 1000
          const alpha = 0.3 + 0.2 * Math.sin(time * 4)
          ctx.strokeStyle = `rgba(220, 38, 38, ${alpha})`
          ctx.lineWidth = 2
          ctx.strokeRect(selectionStart, 0, selectionEnd - selectionStart, height)
        }
      }
    })

    // Enhanced time markers
    ctx.fillStyle = "#64748b"
    ctx.font = "11px monospace"
    const timeStep = visibleDuration / 10
    for (let i = 0; i <= 10; i++) {
      const time = startTime + i * timeStep
      const x = (i / 10) * width
      
      // Time marker line
      ctx.strokeStyle = "#e2e8f0"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, height - 30)
      ctx.lineTo(x, height)
      ctx.stroke()
      
      // Time text
      ctx.fillText(`${time.toFixed(1)}s`, x - 15, height - 5)
    }
  }, [audioData, keyPresses, zoomLevel, panOffset, currentTime, showSpectrogram, trimStart, trimEnd])

  // Redraw when dependencies change
  useEffect(() => {
    drawWaveform()
  }, [drawWaveform])

  // Handle canvas click for key selection
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!audioData) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const clickTime = panOffset + (x / canvas.width) * (audioData.duration / zoomLevel)

      // Find closest key press
      let closestKey: KeyPress | null = null
      let minDistance = Number.POSITIVE_INFINITY

      for (const keyPress of keyPresses) {
        const distance = Math.abs(keyPress.time - clickTime)
        if (distance < minDistance && distance < 0.1) {
          minDistance = distance
          closestKey = keyPress
        }
      }

      if (closestKey) {
        const newSelected = new Set(selectedKeyPresses)
        if (newSelected.has(closestKey.id)) {
          newSelected.delete(closestKey.id)
        } else {
          newSelected.add(closestKey.id)
        }
        setSelectedKeyPresses(newSelected)

        setKeyPresses((prev) =>
          prev.map((kp) => ({
            ...kp,
            selected: newSelected.has(kp.id),
          })),
        )
      }
    },
    [audioData, keyPresses, selectedKeyPresses, panOffset, zoomLevel],
  )

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
    setZoomLevel((prev) => Math.max(1, Math.min(20, prev * zoomFactor)))
  }, [])

  // Handle mouse drag for pan
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setLastMouseX(event.clientX)
  }, [])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !audioData) return

      const deltaX = event.clientX - lastMouseX
      const canvas = canvasRef.current
      if (!canvas) return

      const panDelta = -(deltaX / canvas.width) * (audioData.duration / zoomLevel)
      setPanOffset((prev) =>
        Math.max(0, Math.min(audioData.duration - audioData.duration / zoomLevel, prev + panDelta)),
      )
      setLastMouseX(event.clientX)
    },
    [isDragging, lastMouseX, audioData, zoomLevel],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Play/pause audio
  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  // Export selected segments
  const exportSelectedSegments = useCallback(async () => {
    if (!audioData || selectedKeyPresses.size === 0) {
      toast({
        title: "No segments selected",
        description: "Please select some key press segments to export",
        variant: "destructive",
      })
      return
    }

    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    const metadata: any[] = []

    const selectedKeys = keyPresses.filter((kp) => selectedKeyPresses.has(kp.id))

    for (let i = 0; i < selectedKeys.length; i++) {
      const keyPress = selectedKeys[i]
      const filename = `keypress_${keyPress.key}_${keyPress.time.toFixed(3)}s.wav`

      // Extract 1-second segment
      const startSample = Math.floor(keyPress.startTime * audioData.sampleRate)
      const endSample = Math.floor(keyPress.endTime * audioData.sampleRate)
      const segmentLength = endSample - startSample

      // Create new audio buffer for segment
      const segmentBuffer = audioContextRef.current!.createBuffer(1, segmentLength, audioData.sampleRate)

      const segmentData = segmentBuffer.getChannelData(0)
      for (let j = 0; j < segmentLength; j++) {
        segmentData[j] = audioData.samples[startSample + j] || 0
      }

      // Convert to WAV blob
      const wavBlob = audioBufferToWav(segmentBuffer)
      zip.file(filename, wavBlob)

      metadata.push({
        filename,
        key: keyPress.key,
        code: keyPress.code,
        originalTime: keyPress.time,
        startTime: keyPress.startTime,
        endTime: keyPress.endTime,
        duration: keyPress.endTime - keyPress.startTime,
      })
    }

    // Add metadata JSON
    zip.file("metadata.json", JSON.stringify(metadata, null, 2))

    // Generate and download zip
    const zipBlob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `keyboard_segments_${new Date().toISOString().slice(0, 19)}.zip`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Export complete",
      description: `Exported ${selectedKeys.length} segments`,
    })
  }, [audioData, selectedKeyPresses, keyPresses, toast])

  // Convert AudioBuffer to WAV blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length
    const arrayBuffer = new ArrayBuffer(44 + length * 2)
    const view = new DataView(arrayBuffer)

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, "RIFF")
    view.setUint32(4, 36 + length * 2, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, buffer.sampleRate, true)
    view.setUint32(28, buffer.sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, "data")
    view.setUint32(40, length * 2, true)

    const samples = buffer.getChannelData(0)
    let offset = 44
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(offset, sample * 0x7fff, true)
      offset += 2
    }

    return new Blob([arrayBuffer], { type: "audio/wav" })
  }

  const getKeyDisplayName = (code: string, key: string) => {
    const keyMap: { [key: string]: string } = {
      Space: "Space",
      Enter: "Enter",
      Backspace: "Backspace",
      Tab: "Tab",
      CapsLock: "Caps",
      ShiftLeft: "Shift",
      ShiftRight: "Shift",
      ControlLeft: "Ctrl",
      ControlRight: "Ctrl",
      AltLeft: "Alt",
      AltRight: "Alt",
    }
    return keyMap[code] || key.toUpperCase()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-4 relative">
          {/* Theme Toggle */}
          <div className="absolute top-0 right-0">
            <ThemeToggle />
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Audio Waveform Analyzer
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Record audio and type to capture keyboard key presses with precise timing. 
            Analyze, visualize, and export your typing patterns with professional-grade audio analysis.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <Badge variant="outline" className="px-4 py-2 text-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              🎙️ Real-time Recording
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              ⌨️ Keyboard Tracking
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              📊 Waveform Analysis
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              💾 Export Tools
            </Badge>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-800">
          <h3 className="text-lg font-bold mb-3 bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
            ⌨️ Keyboard Shortcuts
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg">
              <kbd className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded font-mono text-xs">Ctrl+R</kbd>
              <div className="mt-1 text-gray-600 dark:text-gray-400">Start Recording</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg">
              <kbd className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded font-mono text-xs">Ctrl+Space</kbd>
              <div className="mt-1 text-gray-600 dark:text-gray-400">Play/Pause</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg">
              <kbd className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded font-mono text-xs">Ctrl+A</kbd>
              <div className="mt-1 text-gray-600 dark:text-gray-400">Select All</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg">
              <kbd className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded font-mono text-xs">Ctrl+S</kbd>
              <div className="mt-1 text-gray-600 dark:text-gray-400">Export Selected</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg">
              <kbd className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded font-mono text-xs">Ctrl+D</kbd>
              <div className="mt-1 text-gray-600 dark:text-gray-400">Deselect All</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg">
              <kbd className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded font-mono text-xs">Escape</kbd>
              <div className="mt-1 text-gray-600 dark:text-gray-400">Stop Recording</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg">
              <kbd className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded font-mono text-xs">Mouse Wheel</kbd>
              <div className="mt-1 text-gray-600 dark:text-gray-400">Zoom In/Out</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 p-3 rounded-lg">
              <kbd className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded font-mono text-xs">Click+Drag</kbd>
              <div className="mt-1 text-gray-600 dark:text-gray-400">Pan Waveform</div>
            </div>
          </div>
        </Card>

        {/* Enhanced Controls */}
        <Card className="p-6 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-gray-800 dark:to-blue-900 border-2 dark:border-gray-700">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              className={`flex items-center gap-2 px-6 py-3 text-lg font-semibold rounded-xl ${
                isRecording 
                  ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
              }`}
            >
              {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>

            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline" 
              className="flex items-center gap-2 px-6 py-3 text-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-2 rounded-xl shadow-md"
            >
              <Upload className="w-5 h-5" />
              Upload Audio
            </Button>

            {audioData && (
              <>
                <Button 
                  onClick={togglePlayback} 
                  variant="outline" 
                  className={`flex items-center gap-2 px-6 py-3 text-lg rounded-xl shadow-md ${
                    isPlaying 
                      ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                      : "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                  }`}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isPlaying ? "Pause" : "Play"}
                </Button>

                <Button
                  onClick={() => setShowSpectrogram(!showSpectrogram)}
                  variant="outline"
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-md ${
                    showSpectrogram 
                      ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  {showSpectrogram ? "Waveform" : "Spectrogram"}
                </Button>

                <Button
                  onClick={() => {
                    setTrimStart(null)
                    setTrimEnd(null)
                    setSelectedKeyPresses(new Set())
                    setKeyPresses(prev => prev.map(kp => ({ ...kp, selected: false })))
                  }}
                  variant="outline"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl shadow-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Trash2 className="w-5 h-5" />
                  Clear Selection
                </Button>

                <Button
                  onClick={exportSelectedSegments}
                  variant="outline"
                  className="flex items-center gap-2 px-6 py-3 text-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-xl shadow-md"
                  disabled={selectedKeyPresses.size === 0}
                >
                  <Download className="w-5 h-5" />
                  Export Selected ({selectedKeyPresses.size})
                </Button>
              </>
            )}
          </div>

          {/* Audio progress bar */}
          {audioData && (
            <div className="mt-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}
                </span>
                <div className="flex-1 relative">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <div 
                      className="h-2 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-full transition-all"
                      style={{ width: `${(currentTime / audioData.duration) * 100}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={audioData.duration}
                    step="0.1"
                    value={currentTime}
                    onChange={(e) => {
                      const time = parseFloat(e.target.value)
                      setCurrentTime(time)
                      if (audioRef.current) {
                        audioRef.current.currentTime = time
                      }
                    }}
                    className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                  {Math.floor(audioData.duration / 60)}:{(audioData.duration % 60).toFixed(0).padStart(2, '0')}
                </span>
                <Button
                  onClick={() => {
                    setCurrentTime(0)
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0
                    }
                  }}
                  size="sm"
                  variant="outline"
                  className="px-3 py-1"
                >
                  Reset
                </Button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.ogg,.flac,audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <audio
            ref={audioRef}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={() => {
              if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime)
              }
            }}
          />
        </Card>

        <Card className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 border-2 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-8 text-center bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            ⌨️ Professional Mechanical Keyboard
          </h3>
          
          {/* Keyboard Container with realistic background */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-950 dark:to-black p-8 rounded-2xl shadow-2xl border-4 border-gray-700 dark:border-gray-600">
            <div className="space-y-2">
              {KEYBOARD_LAYOUT.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-1 justify-center">
                  {row.map((keyData, keyIndex) => {
                    // Create unique key using row and column index
                    const uniqueKey = `${rowIndex}-${keyIndex}-${keyData.key}`
                    
                    // Check if key is active
                    const isActive =
                      activeKeys.has(`Key${keyData.key.toUpperCase()}`) ||
                      activeKeys.has(keyData.key) ||
                      activeKeys.has(`Digit${keyData.key}`) ||
                      (keyData.key === "ShiftLeft" && activeKeys.has("ShiftLeft")) ||
                      (keyData.key === "ShiftRight" && activeKeys.has("ShiftRight")) ||
                      (keyData.key === "ControlLeft" && activeKeys.has("ControlLeft")) ||
                      (keyData.key === "ControlRight" && activeKeys.has("ControlRight")) ||
                      (keyData.key === "AltLeft" && activeKeys.has("AltLeft")) ||
                      (keyData.key === "AltRight" && activeKeys.has("AltRight")) ||
                      (keyData.key === "MetaLeft" && activeKeys.has("MetaLeft")) ||
                      (keyData.key === "MetaRight" && activeKeys.has("MetaRight"))

                    // Count key presses
                    const keyPressCount = keyPresses.filter(
                      (kp) =>
                        kp.key.toLowerCase() === keyData.key.toLowerCase() ||
                        (keyData.key === " " && kp.key === " ") ||
                        kp.code === keyData.key ||
                        (keyData.key === "ShiftLeft" && kp.code === "ShiftLeft") ||
                        (keyData.key === "ShiftRight" && kp.code === "ShiftRight") ||
                        (keyData.key === "ControlLeft" && kp.code === "ControlLeft") ||
                        (keyData.key === "ControlRight" && kp.code === "ControlRight") ||
                        (keyData.key === "AltLeft" && kp.code === "AltLeft") ||
                        (keyData.key === "AltRight" && kp.code === "AltRight"),
                    ).length

                    return (
                      <div
                        key={uniqueKey}
                        className={`
                          ${keyData.width} h-12 relative transition-all duration-150 transform
                          ${isActive ? 'scale-95' : 'hover:scale-105'}
                        `}
                      >
                        {/* Key Shadow/Base */}
                        <div className={`
                          absolute inset-0 rounded-lg bg-gradient-to-b from-gray-600 to-gray-800 
                          ${isActive ? 'translate-y-1' : 'translate-y-2'}
                          transition-transform duration-150
                        `} />
                        
                        {/* Key Cap */}
                        <div className={`
                          absolute inset-0 rounded-lg border-2 transition-all duration-150 flex flex-col items-center justify-center text-xs font-bold
                          ${isActive 
                            ? 'bg-gradient-to-b from-red-400 to-red-600 border-red-700 text-white shadow-lg transform translate-y-1' 
                            : keyPressCount > 0
                              ? 'bg-gradient-to-b from-blue-200 to-blue-400 border-blue-500 text-blue-900 shadow-md'
                              : 'bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-300 dark:to-gray-400 border-gray-300 dark:border-gray-500 text-gray-800 shadow-md hover:from-gray-200 hover:to-gray-300'
                          }
                        `}>
                          {/* Secondary character (top) */}
                          {keyData.secondary && (
                            <div className="text-[9px] leading-none opacity-70 mb-0.5">
                              {keyData.secondary}
                            </div>
                          )}
                          
                          {/* Main character */}
                          <div className={`leading-none ${keyData.key.length > 4 ? 'text-[10px]' : 'text-xs'}`}>
                            {keyData.label}
                          </div>
                          
                          {/* Key press counter */}
                          {keyPressCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold shadow-lg animate-pulse">
                              {keyPressCount}
                            </div>
                          )}
                        </div>

                        {/* Active glow effect */}
                        {isActive && (
                          <div className="absolute inset-0 rounded-lg bg-red-400 opacity-30 blur-md animate-pulse" />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            
            {/* Keyboard branding */}
            <div className="flex justify-between items-center mt-6 px-4">
              <div className="text-gray-400 text-xs font-mono">AUDIO ANALYZER v2.0</div>
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <div className="text-gray-400 text-xs">CONNECTED</div>
              </div>
            </div>
          </div>

          {isRecording && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-2 rounded-full border border-red-300 dark:border-red-700">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold">RECORDING - Start typing to see keys light up!</span>
              </div>
            </div>
          )}
        </Card>

        {/* Enhanced Waveform Display */}
        {audioData && (
          <Card className="p-6 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-800 dark:to-indigo-900 border-2 dark:border-gray-700">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                  Audio Waveform {showSpectrogram ? "Spectrogram" : "Analysis"}
                </h3>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    Duration: {audioData.duration.toFixed(2)}s
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    Keys: {keyPresses.length}
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                    Zoom: {zoomLevel.toFixed(1)}x
                  </Badge>
                  {selectedKeyPresses.size > 0 && (
                    <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                      Selected: {selectedKeyPresses.size}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="relative bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
                <canvas
                  ref={canvasRef}
                  width={1200}
                  height={350}
                  className="w-full cursor-crosshair"
                  onClick={handleCanvasClick}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />

                <div className="absolute top-4 right-4 flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setZoomLevel((prev) => Math.min(20, prev * 1.2))}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setZoomLevel((prev) => Math.max(1, prev / 1.2))}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setZoomLevel(1)
                      setPanOffset(0)
                    }}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800"
                  >
                    Reset View
                  </Button>
                </div>

                {/* Keyboard shortcuts help */}
                <div className="absolute bottom-4 left-4 bg-black/80 dark:bg-white/80 text-white dark:text-black px-3 py-2 rounded-lg text-xs">
                  <div className="font-semibold mb-1">Controls:</div>
                  <div>• Mouse wheel: Zoom in/out</div>
                  <div>• Click & drag: Pan view</div>
                  <div>• Click markers: Select segments</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-lg border dark:border-gray-700">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{keyPresses.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Key Presses</div>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-lg border dark:border-gray-700">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedKeyPresses.size}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Selected Segments</div>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-lg border dark:border-gray-700">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(audioData.duration / 60).toFixed(1)}m</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Duration</div>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 text-center bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg">
                <strong>Interactive Waveform:</strong> Click on red/purple markers to select key press segments. 
                Use mouse wheel to zoom, drag to pan. Selected segments can be exported as separate audio files.
                {showSpectrogram && " Spectrogram view shows frequency content over time."}
              </p>
            </div>
          </Card>
        )}

        {keyPresses.length > 0 && (
          <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-teal-900 border-2 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                Key Press Timeline
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const allIds = new Set(keyPresses.map(kp => kp.id))
                    setSelectedKeyPresses(allIds)
                    setKeyPresses(prev => prev.map(kp => ({ ...kp, selected: true })))
                  }}
                  size="sm"
                  variant="outline"
                  className="bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  Select All
                </Button>
                <Button
                  onClick={() => {
                    setSelectedKeyPresses(new Set())
                    setKeyPresses(prev => prev.map(kp => ({ ...kp, selected: false })))
                  }}
                  size="sm"
                  variant="outline"
                  className="bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Clear All
                </Button>
              </div>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
              {keyPresses.map((keyPress, index) => (
                <div
                  key={keyPress.id}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 transform hover:scale-[1.02] ${
                    keyPress.selected 
                      ? "border-red-400 dark:border-red-600 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 shadow-lg ring-2 ring-red-200 dark:ring-red-800" 
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 shadow-md"
                  }`}
                  onClick={() => {
                    const newSelected = new Set(selectedKeyPresses)
                    if (newSelected.has(keyPress.id)) {
                      newSelected.delete(keyPress.id)
                    } else {
                      newSelected.add(keyPress.id)
                    }
                    setSelectedKeyPresses(newSelected)
                    setKeyPresses((prev) =>
                      prev.map((kp) => ({
                        ...kp,
                        selected: newSelected.has(kp.id),
                      })),
                    )
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-12 border-2 rounded-lg flex items-center justify-center text-sm font-bold ${
                        keyPress.selected 
                          ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
                          : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                      }`}>
                        {getKeyDisplayName(keyPress.code, keyPress.key)}
                      </div>
                      <div className="text-sm">
                        <div className="font-semibold text-gray-800 dark:text-gray-200">Key Press #{index + 1}</div>
                        <div className="text-gray-600 dark:text-gray-400">Code: <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{keyPress.code}</span></div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-bold text-lg text-blue-600 dark:text-blue-400">{keyPress.time.toFixed(3)}s</div>
                      <div className="text-gray-600 dark:text-gray-400 font-mono">
                        {keyPress.startTime.toFixed(3)}s - {keyPress.endTime.toFixed(3)}s
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mt-1">
                        Duration: {(keyPress.endTime - keyPress.startTime).toFixed(3)}s
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
