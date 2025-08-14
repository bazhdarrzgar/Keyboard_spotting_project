"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, Square, Upload, Play, Pause, Download, ZoomIn, ZoomOut, Trash2, Save, BarChart3, Scissors, Volume2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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

// Keyboard layout for visualization with unique keys
const KEYBOARD_LAYOUT = [
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Backspace"],
  ["Tab", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
  ["CapsLock", "a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "Enter"],
  ["ShiftLeft", "z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "ShiftRight"],
  ["ControlLeft", "AltLeft", " ", "AltRight", "ControlRight"],
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
      ctx.font = "14px monospace"
      ctx.fontWeight = "bold"
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

      keyPresses.forEach((keyPress) => {
        const distance = Math.abs(keyPress.time - clickTime)
        if (distance < minDistance && distance < 0.1) {
          minDistance = distance
          closestKey = keyPress
        }
      })

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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Audio Waveform Analyzer</h1>
          <p className="text-muted-foreground">
            Record audio and type to capture keyboard key presses with precise timing
          </p>
        </div>

        {/* Enhanced Controls */}
        <Card className="p-6 bg-gradient-to-r from-slate-50 to-blue-50 border-2">
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
              className="flex items-center gap-2 px-6 py-3 text-lg bg-white hover:bg-gray-50 border-2 rounded-xl shadow-md"
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
                      ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                      : "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
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
                      ? "bg-purple-50 border-purple-300 text-purple-700"
                      : "bg-white border-gray-300"
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
                  className="flex items-center gap-2 px-4 py-3 rounded-xl shadow-md bg-white hover:bg-gray-50"
                >
                  <Trash2 className="w-5 h-5" />
                  Clear Selection
                </Button>

                <Button
                  onClick={exportSelectedSegments}
                  variant="outline"
                  className="flex items-center gap-2 px-6 py-3 text-lg bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100 rounded-xl shadow-md"
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
                <span className="text-sm font-mono text-gray-600">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}
                </span>
                <div className="flex-1 relative">
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
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
                <span className="text-sm font-mono text-gray-600">
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

        <Card className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 border-2">
          <h3 className="text-xl font-bold mb-6 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Live Keyboard Visualization
          </h3>
          <div className="space-y-2">
            {KEYBOARD_LAYOUT.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1 justify-center">
                {row.map((keyCode, keyIndex) => {
                  // Create unique key using row and column index
                  const uniqueKey = `${rowIndex}-${keyIndex}-${keyCode}`
                  
                  // Get display name for the key
                  const getKeyDisplayName = (code: string) => {
                    const keyMap: { [key: string]: string } = {
                      ShiftLeft: "Shift",
                      ShiftRight: "Shift", 
                      ControlLeft: "Ctrl",
                      ControlRight: "Ctrl",
                      AltLeft: "Alt",
                      AltRight: "Alt",
                      " ": "Space"
                    }
                    return keyMap[code] || code
                  }
                  
                  const displayName = getKeyDisplayName(keyCode)
                  
                  const isActive =
                    activeKeys.has(`Key${keyCode.toUpperCase()}`) ||
                    activeKeys.has(keyCode) ||
                    activeKeys.has(`Digit${keyCode}`) ||
                    (keyCode === "ShiftLeft" && activeKeys.has("ShiftLeft")) ||
                    (keyCode === "ShiftRight" && activeKeys.has("ShiftRight")) ||
                    (keyCode === "ControlLeft" && activeKeys.has("ControlLeft")) ||
                    (keyCode === "ControlRight" && activeKeys.has("ControlRight")) ||
                    (keyCode === "AltLeft" && activeKeys.has("AltLeft")) ||
                    (keyCode === "AltRight" && activeKeys.has("AltRight"))

                  const keyPressCount = keyPresses.filter(
                    (kp) =>
                      kp.key.toLowerCase() === keyCode.toLowerCase() ||
                      (keyCode === " " && kp.key === " ") ||
                      kp.code === keyCode ||
                      (keyCode === "ShiftLeft" && kp.code === "ShiftLeft") ||
                      (keyCode === "ShiftRight" && kp.code === "ShiftRight") ||
                      (keyCode === "ControlLeft" && kp.code === "ControlLeft") ||
                      (keyCode === "ControlRight" && kp.code === "ControlRight") ||
                      (keyCode === "AltLeft" && kp.code === "AltLeft") ||
                      (keyCode === "AltRight" && kp.code === "AltRight"),
                  ).length

                  return (
                    <div
                      key={uniqueKey}
                      className={`
                        px-3 py-2 text-sm border-2 rounded-lg transition-all duration-200 transform font-medium
                        ${keyCode === " " ? "w-32" : keyCode.length > 5 ? "w-20" : "w-10"}
                        ${
                          isActive
                            ? "bg-gradient-to-br from-red-500 to-red-600 text-white border-red-700 shadow-xl scale-110 ring-4 ring-red-200"
                            : keyPressCount > 0
                              ? "bg-gradient-to-br from-blue-400 to-blue-500 border-blue-600 text-white shadow-lg"
                              : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 text-gray-700 hover:from-gray-100 hover:to-gray-200 hover:border-gray-400"
                        }
                      `}
                    >
                      <div className="text-center">
                        <div className="font-bold">{displayName}</div>
                        {keyPressCount > 0 && (
                          <div className="text-xs opacity-90 mt-1 bg-white bg-opacity-20 rounded px-1">
                            {keyPressCount}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {isRecording && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Start typing to see key presses highlighted in real-time
            </p>
          )}
        </Card>

        {/* Enhanced Waveform Display */}
        {audioData && (
          <Card className="p-6 bg-gradient-to-br from-slate-50 to-indigo-50 border-2">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Audio Waveform {showSpectrogram ? "Spectrogram" : "Analysis"}
                </h3>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-800">
                    Duration: {audioData.duration.toFixed(2)}s
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-green-100 text-green-800">
                    Keys: {keyPresses.length}
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-purple-100 text-purple-800">
                    Zoom: {zoomLevel.toFixed(1)}x
                  </Badge>
                  {selectedKeyPresses.size > 0 && (
                    <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-red-100 text-red-800">
                      Selected: {selectedKeyPresses.size}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="relative bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg">
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
                    className="bg-white/90 backdrop-blur-sm hover:bg-white"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setZoomLevel((prev) => Math.max(1, prev / 1.2))}
                    className="bg-white/90 backdrop-blur-sm hover:bg-white"
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
                    className="bg-white/90 backdrop-blur-sm hover:bg-white"
                  >
                    Reset View
                  </Button>
                </div>

                {/* Keyboard shortcuts help */}
                <div className="absolute bottom-4 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-xs">
                  <div className="font-semibold mb-1">Controls:</div>
                  <div>• Mouse wheel: Zoom in/out</div>
                  <div>• Click & drag: Pan view</div>
                  <div>• Click markers: Select segments</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg border">
                  <div className="text-2xl font-bold text-blue-600">{keyPresses.length}</div>
                  <div className="text-sm text-gray-600">Total Key Presses</div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg border">
                  <div className="text-2xl font-bold text-green-600">{selectedKeyPresses.size}</div>
                  <div className="text-sm text-gray-600">Selected Segments</div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg border">
                  <div className="text-2xl font-bold text-purple-600">{(audioData.duration / 60).toFixed(1)}m</div>
                  <div className="text-sm text-gray-600">Total Duration</div>
                </div>
              </div>

              <p className="text-sm text-gray-600 text-center bg-white/50 p-3 rounded-lg">
                <strong>Interactive Waveform:</strong> Click on red/purple markers to select key press segments. 
                Use mouse wheel to zoom, drag to pan. Selected segments can be exported as separate audio files.
                {showSpectrogram && " Spectrogram view shows frequency content over time."}
              </p>
            </div>
          </Card>
        )}

        {keyPresses.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Key Press Timeline</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {keyPresses.map((keyPress, index) => (
                <div
                  key={keyPress.id}
                  className={`p-3 border rounded cursor-pointer transition-colors flex items-center justify-between ${
                    keyPress.selected ? "border-red-500 bg-red-50 dark:bg-red-950" : "border-border hover:bg-muted"
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
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-8 bg-gray-100 border rounded flex items-center justify-center text-sm font-mono">
                      {getKeyDisplayName(keyPress.code, keyPress.key)}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">Key Press #{index + 1}</div>
                      <div className="text-muted-foreground">Code: {keyPress.code}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{keyPress.time.toFixed(3)}s</div>
                    <div className="text-muted-foreground">
                      {keyPress.startTime.toFixed(3)}s - {keyPress.endTime.toFixed(3)}s
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Duration: {(keyPress.endTime - keyPress.startTime).toFixed(3)}s
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
