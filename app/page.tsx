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

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !audioData) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas
    const { samples, duration } = audioData

    // Clear canvas
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)

    // Calculate visible range based on zoom and pan
    const visibleDuration = duration / zoomLevel
    const startTime = panOffset
    const endTime = Math.min(duration, startTime + visibleDuration)

    const startSample = Math.floor(startTime * audioData.sampleRate)
    const endSample = Math.floor(endTime * audioData.sampleRate)
    const visibleSamples = endSample - startSample

    // Draw waveform
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 1
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

    keyPresses.forEach((keyPress, index) => {
      if (keyPress.time >= startTime && keyPress.time <= endTime) {
        const x = ((keyPress.time - startTime) / visibleDuration) * width

        ctx.strokeStyle = keyPress.selected ? "#dc2626" : "#ef4444"
        ctx.lineWidth = keyPress.selected ? 3 : 2
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()

        // Draw key label
        ctx.fillStyle = keyPress.selected ? "#dc2626" : "#ef4444"
        ctx.font = "12px monospace"
        const keyLabel = keyPress.key === " " ? "Space" : keyPress.key
        const labelWidth = ctx.measureText(keyLabel).width
        ctx.fillText(keyLabel, x - labelWidth / 2, 20)

        // Draw timing info
        ctx.fillStyle = "#6b7280"
        ctx.font = "10px monospace"
        const timeLabel = `${keyPress.time.toFixed(2)}s`
        const timeLabelWidth = ctx.measureText(timeLabel).width
        ctx.fillText(timeLabel, x - timeLabelWidth / 2, height - 10)

        // Draw selection highlight
        if (keyPress.selected) {
          ctx.fillStyle = "rgba(220, 38, 38, 0.1)"
          const selectionStart = ((keyPress.startTime - startTime) / visibleDuration) * width
          const selectionEnd = ((keyPress.endTime - startTime) / visibleDuration) * width
          ctx.fillRect(selectionStart, 0, selectionEnd - selectionStart, height)
        }
      }
    })

    // Draw time markers
    ctx.fillStyle = "#6b7280"
    ctx.font = "12px monospace"
    const timeStep = visibleDuration / 10
    for (let i = 0; i <= 10; i++) {
      const time = startTime + i * timeStep
      const x = (i / 10) * width
      ctx.fillText(`${time.toFixed(1)}s`, x, height - 25)
    }
  }, [audioData, keyPresses, zoomLevel, panOffset])

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

        {/* Controls */}
        <Card className="p-6">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              className="flex items-center gap-2"
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isRecording ? "Stop Recording" : "Record"}
            </Button>

            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Audio
            </Button>

            {audioData && (
              <>
                <Button onClick={togglePlayback} variant="outline" className="flex items-center gap-2 bg-transparent">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? "Pause" : "Play"}
                </Button>

                <Button
                  onClick={exportSelectedSegments}
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                  disabled={selectedKeyPresses.size === 0}
                >
                  <Download className="w-4 h-4" />
                  Export Selected ({selectedKeyPresses.size})
                </Button>
              </>
            )}
          </div>

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
          />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Keyboard Visualization</h3>
          <div className="space-y-2">
            {KEYBOARD_LAYOUT.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1 justify-center">
                {row.map((key) => {
                  const isActive =
                    activeKeys.has(`Key${key.toUpperCase()}`) ||
                    activeKeys.has(key === " " ? "Space" : key) ||
                    activeKeys.has(`Digit${key}`) ||
                    (key === "Shift" && (activeKeys.has("ShiftLeft") || activeKeys.has("ShiftRight"))) ||
                    (key === "Ctrl" && (activeKeys.has("ControlLeft") || activeKeys.has("ControlRight"))) ||
                    (key === "Alt" && (activeKeys.has("AltLeft") || activeKeys.has("AltRight")))

                  const keyPressCount = keyPresses.filter(
                    (kp) =>
                      kp.key.toLowerCase() === key.toLowerCase() ||
                      (key === " " && kp.key === " ") ||
                      (key === "Shift" && (kp.code === "ShiftLeft" || kp.code === "ShiftRight")) ||
                      (key === "Ctrl" && (kp.code === "ControlLeft" || kp.code === "ControlRight")) ||
                      (key === "Alt" && (kp.code === "AltLeft" || kp.code === "AltRight")),
                  ).length

                  return (
                    <div
                      key={key}
                      className={`
                        px-2 py-1 text-xs border rounded transition-all duration-150
                        ${key === " " ? "w-32" : key.length > 3 ? "w-16" : "w-8"}
                        ${
                          isActive
                            ? "bg-red-500 text-white border-red-600 shadow-lg transform scale-105"
                            : keyPressCount > 0
                              ? "bg-blue-100 border-blue-300 text-blue-800"
                              : "bg-gray-100 border-gray-300 text-gray-700"
                        }
                      `}
                    >
                      <div className="text-center">
                        {key === " " ? "Space" : key}
                        {keyPressCount > 0 && <div className="text-xs opacity-75">({keyPressCount})</div>}
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

        {/* Waveform Display */}
        {audioData && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Waveform</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Duration: {audioData.duration.toFixed(2)}s</Badge>
                  <Badge variant="secondary">Keys: {keyPresses.length}</Badge>
                  <Badge variant="secondary">Zoom: {zoomLevel.toFixed(1)}x</Badge>
                </div>
              </div>

              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={1200}
                  height={300}
                  className="w-full border rounded cursor-crosshair"
                  onClick={handleCanvasClick}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />

                <div className="absolute top-2 right-2 flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setZoomLevel((prev) => Math.min(20, prev * 1.2))}>
                    <ZoomIn className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setZoomLevel((prev) => Math.max(1, prev / 1.2))}>
                    <ZoomOut className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Click on red markers to select key press segments. Use mouse wheel to zoom, drag to pan.
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
