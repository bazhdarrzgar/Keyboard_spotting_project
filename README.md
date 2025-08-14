# 🎵 Audio Waveform Analyzer

A professional-grade web application for recording audio while tracking keyboard input, providing precise timing analysis and visualization of typing patterns with synchronized audio playback.

## ✨ Features

### 🎙️ **Audio Recording & Analysis**
- **Real-time Audio Recording**: Capture high-quality audio with microphone access
- **File Upload Support**: Import existing audio files (WAV, MP3, OGG, FLAC)
- **Waveform Visualization**: Interactive waveform display with zoom and pan capabilities
- **Spectrogram View**: Toggle between waveform and frequency analysis views

### ⌨️ **Keyboard Tracking**
- **Real-time Key Detection**: Capture every keystroke with precise timing
- **Professional Keyboard Layout**: Realistic mechanical keyboard visualization
- **Key Press Analytics**: Count and display key usage statistics
- **Visual Feedback**: Keys light up during recording and show press counts

### 📊 **Advanced Analysis Tools**
- **Timeline Visualization**: Interactive timeline with key press markers
- **Segment Selection**: Click to select specific key press segments
- **Export Functionality**: Export selected segments as separate audio files
- **Metadata Export**: Generate detailed JSON metadata for analysis

### 🎨 **User Experience**
- **Dark/Light Mode**: Seamless theme switching with system preference detection
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Shortcuts**: Professional-grade shortcuts for power users
- **Smooth Animations**: Beautiful transitions and visual effects

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Modern web browser with microphone access
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Keyboard_spotting_project2
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Usage Guide

### Recording Audio
1. **Start Recording**: Click "Start Recording" or press `Ctrl+R`
2. **Type Away**: Begin typing while recording - keys will light up in real-time
3. **Stop Recording**: Click "Stop Recording" or press `Escape`
4. **Analyze**: View the waveform with synchronized key press markers

### Analyzing Waveforms
- **Zoom**: Use mouse wheel or zoom buttons to focus on specific time ranges
- **Pan**: Click and drag to navigate through the audio timeline
- **Select Segments**: Click on key press markers to select them for export
- **Toggle Views**: Switch between waveform and spectrogram visualization

### Exporting Data
1. **Select Segments**: Click on key press markers to select them
2. **Export**: Click "Export Selected" or press `Ctrl+S`
3. **Download**: Get a ZIP file with individual audio segments and metadata

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|---------|
| `Ctrl+R` | Start/Stop Recording |
| `Ctrl+Space` | Play/Pause Audio |
| `Ctrl+A` | Select All Segments |
| `Ctrl+D` | Deselect All Segments |
| `Ctrl+S` | Export Selected Segments |
| `Escape` | Stop Recording |
| `Mouse Wheel` | Zoom In/Out |
| `Click+Drag` | Pan Waveform |

## 🛠️ Technical Details

### Built With
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **next-themes** - Dark mode support
- **Web Audio API** - Audio processing and analysis
- **Canvas API** - Custom waveform rendering

### Architecture
- **Client-Side Rendering**: Full client-side audio processing
- **Component-Based**: Modular React components with hooks
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Theme System**: CSS variables with smooth transitions

### Audio Processing
- **Real-time Recording**: MediaRecorder API for audio capture
- **Buffer Analysis**: Web Audio API for sample processing
- **WAV Export**: Custom WAV encoder for segment export
- **Synchronization**: Precise timing between audio and keyboard events

## 📁 Project Structure

```
Keyboard_spotting_project2/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles and CSS variables
│   ├── layout.tsx         # Root layout with theme provider
│   └── page.tsx           # Main application component
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components (buttons, cards, etc.)
│   ├── theme-provider.tsx # Theme context provider
│   └── theme-toggle.tsx  # Dark/light mode toggle
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── public/               # Static assets
├── styles/               # Additional CSS files
└── types/                # TypeScript type definitions
```

## 🎨 Customization

### Adding New Audio Formats
The application supports multiple audio formats through the Web Audio API. To add support for additional formats:

1. Update the `validTypes` array in `handleFileUpload`
2. Ensure the browser supports the format
3. Test with sample files

### Customizing Keyboard Layout
Modify the `KEYBOARD_LAYOUT` constant in `page.tsx` to:
- Add new keys
- Change key sizes
- Modify visual styling
- Add custom key behaviors

### Theme Customization
- **CSS Variables**: Modify colors in `globals.css`
- **Tailwind Classes**: Update dark mode variants throughout components
- **New Themes**: Extend the theme system in `theme-provider.tsx`

## 🐛 Troubleshooting

### Common Issues

**Microphone Access Denied**
- Ensure browser permissions are granted
- Check if microphone is connected and working
- Try refreshing the page

**Audio Not Playing**
- Verify audio file format is supported
- Check browser console for errors
- Ensure audio context is properly initialized

**Performance Issues**
- Reduce zoom level for large audio files
- Close other browser tabs
- Check system audio drivers

### Browser Compatibility
- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Limited support (some audio features)
- **Mobile**: Responsive design with touch support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Web Audio API** for audio processing capabilities
- **Next.js Team** for the excellent React framework
- **Tailwind CSS** for the utility-first CSS approach
- **Lucide Icons** for beautiful, consistent iconography

## 📞 Support

If you encounter any issues or have questions:
- Check the troubleshooting section above
- Review browser console for error messages
- Ensure all dependencies are properly installed
- Verify browser compatibility

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS** 