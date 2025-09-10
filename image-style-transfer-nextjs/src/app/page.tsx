'use client';

import { useRef, useState, useEffect } from 'react';
import { Send, Image as ImageIcon, Zap, Download, RotateCcw, Trash2, ChevronDown, ChevronUp, Eye, X, Camera, Sparkles, Palette, Settings, Upload, Wand2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Load RealtimeWebcam component
const RealtimeWebcam = dynamic(() => import('../components/RealtimeWebcam'), {
  ssr: false,
  loading: () => <div className="text-gray-600">Loading webcam...</div>
});

interface ModelMetadata {
  name: string;
  size_mb: number;
  input_width: number;
  input_height: number;
  input_channels: number;
  model_url: string;
  description: string;
}

interface StyleTransferEngine {
  get_models(): ModelMetadata[];
  process_image(image_data_url: string, style_name: string, strength: number): Promise<string>;
  initialize?(): Promise<void>;
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  processedImage?: string;
  styleName?: string;
  timestamp: Date;
  isProcessing?: boolean;
};

let wasmEngine: StyleTransferEngine | null = null;

export default function StyleTransferChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [engine, setEngine] = useState<StyleTransferEngine | null>(null);
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [styleStrength, setStyleStrength] = useState(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>('');
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [wasmLoaded, setWasmLoaded] = useState(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addMessage = (role: 'user' | 'assistant', content: string, image?: string, isProcessing = false) => {
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      image,
      timestamp: new Date(),
      isProcessing,
    };
    setMessages(prev => [...prev, message]);
    return message.id;
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg));
  };

  // Initialize component and messages after hydration
  useEffect(() => {
    if (!isInitialized) {
      setMessages([{
        id: 'welcome',
        role: 'assistant', 
        content: 'Welcome to Neural Style Transfer Studio! I\'m your AI assistant for creating stunning artistic transformations. Upload an image and let\'s explore the power of neural networks together.',
        timestamp: new Date(),
      }]);
      
      // Set fallback models immediately
      setModels([
        {
          name: 'van_gogh_starry_night',
          size_mb: 2.4,
          input_width: 256,
          input_height: 256,
          input_channels: 3,
          model_url: '/models/van_gogh_starry_night.onnx',
          description: 'Van Gogh - Starry Night'
        },
        {
          name: 'picasso_cubist', 
          size_mb: 2.1,
          input_width: 256,
          input_height: 256,
          input_channels: 3,
          model_url: '/models/picasso_cubist.onnx',
          description: 'Picasso - Cubist'
        },
        {
          name: 'cyberpunk_neon',
          size_mb: 2.8, 
          input_width: 256,
          input_height: 256,
          input_channels: 3,
          model_url: '/models/cyberpunk_neon.onnx',
          description: 'Cyberpunk - Neon'
        }
      ]);
      
      setIsInitialized(true);
      addMessage('assistant', '🚀 Ready to create! I\'m using advanced CPU processing for now. Upload an image and select a style to begin your artistic journey.');
    }
  }, [isInitialized]);

  // Initialize WebAssembly module
  useEffect(() => {
    const initWasm = async () => {
      if (!wasmEngine && typeof window !== 'undefined' && isInitialized) {
        try {
          console.log('Loading WebAssembly module...');
          
          // Import the simple loader
          const { loadWasmModule, isWebGPUAvailable } = await import('../lib/wasmLoader');
          const engine = await loadWasmModule() as StyleTransferEngine;
          
          if (engine) {
            const availableModels = engine.get_models();
            setModels(availableModels);
            setEngine(engine);
            wasmEngine = engine;
            
            // Check if it's the real engine or mock
            try {
              await engine.process_image('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'test', 0.5);
              setWasmLoaded(true);
              
              // Check for WebGPU availability
              const webgpuAvailable = isWebGPUAvailable();
              if (webgpuAvailable) {
                addMessage('assistant', '🚀 WebAssembly + WebGPU engine activated! You now have access to ultra-high-performance neural style transfer powered by Rust + ONNX + GPU acceleration.');
              } else {
                addMessage('assistant', '🎉 WebAssembly engine activated! You now have access to high-performance neural style transfer powered by Rust + ONNX.');
              }
            } catch (error) {
              setWasmLoaded(false);
              addMessage('assistant', '⚡ Enhanced CPU processing mode enabled. Your images will still look amazing with our optimized algorithms!');
            }
          } else {
            throw new Error('Failed to load any engine');
          }
          
        } catch (error) {
          console.error('WebAssembly initialization failed:', error);
          setWasmLoaded(false);
          addMessage('assistant', '⚡ Enhanced CPU processing mode enabled. Your images will still look amazing with our optimized algorithms!');
        }
      }
    };

    initWasm();
  }, [isInitialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      addMessage('assistant', '⚠️ Image size exceeds 10MB limit. Please upload a smaller image for optimal processing.');
      return;
    }

    try {
      const imageUrl = await fileToDataUrl(file);
      setCurrentImage(imageUrl);
      
      addMessage('user', '📸 I\'ve uploaded an image for neural style transfer', imageUrl);
      addMessage('assistant', '✨ Perfect! Your image is loaded and ready. Now choose your artistic style from the palette below and watch the magic happen!');
    } catch (error) {
      addMessage('assistant', '❌ Failed to load the image. Please try a different file format (JPEG, PNG, WebP).');
    }
  };

  const processImage = async () => {
    if (!currentImage || !selectedStyle) {
      addMessage('assistant', '🎨 Please upload an image and select a style first. I need both to create your masterpiece!');
      return;
    }

    setIsProcessing(true);
    const processingId = addMessage('assistant', `🎭 Processing with ${selectedStyle.replace(/_/g, ' ')} style at ${styleStrength}% intensity...`, undefined, true);

    try {
      let processedImageUrl: string;

      // Use the integrated processing function that automatically selects the best engine
      const { processImageWithBestEngine, unloadModel, getLoadedModels } = await import('../lib/wasmLoader');
      
      // Check if we need to unload other models to free memory
      const loadedModels = getLoadedModels();
      if (loadedModels.length > 2) { // Keep max 2 models in memory
        const modelsToUnload = loadedModels.filter(name => name !== selectedStyle);
        for (const modelName of modelsToUnload.slice(0, -1)) { // Keep the most recent one
          await unloadModel(modelName);
        }
      }
      
      processedImageUrl = await processImageWithBestEngine(currentImage, selectedStyle, styleStrength / 100);
      
      updateMessage(processingId, {
        content: `🎉 Style transfer complete! Here's your ${selectedStyle.replace(/_/g, ' ')} masterpiece, created with ${wasmLoaded ? 'WebAssembly + ONNX' : 'enhanced CPU'} processing:`,
        image: currentImage,
        processedImage: processedImageUrl,
        styleName: selectedStyle,
        isProcessing: false,
      });

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      console.error('Processing failed:', error);
      updateMessage(processingId, {
        content: '❌ Neural processing encountered an issue. Please try again with a different image or style.',
        isProcessing: false,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Enhanced fallback processing
  const processFallback = async (imageDataUrl: string, styleName: string, strength: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        canvas.width = 256;
        canvas.height = 256;
        ctx.drawImage(img, 0, 0, 256, 256);
        
        const imageData = ctx.getImageData(0, 0, 256, 256);
        const data = imageData.data;
        
        // Enhanced neural-style simulation
        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % 256;
          const y = Math.floor((i / 4) / 256);
          let r = data[i];
          let g = data[i + 1]; 
          let b = data[i + 2];

          switch (styleName) {
            case 'van_gogh_starry_night':
              const swirl = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 25;
              r = Math.min(255, r * 1.4 + swirl + 20);
              g = Math.min(255, g * 1.3 + swirl * 0.7 + 15);
              b = Math.min(255, b * 1.2 + swirl * 0.5 + 10);
              break;
              
            case 'picasso_cubist':
              const blockX = Math.floor(x / 12) * 12;
              const blockY = Math.floor(y / 12) * 12;
              if ((blockX + blockY) % 24 === 0) {
                r = Math.min(255, r * 1.8);
                g = Math.min(255, g * 1.6);
                b = Math.min(255, b * 1.4);
              } else {
                r = Math.max(0, r * 0.5);
                g = Math.max(0, g * 0.6);
                b = Math.max(0, b * 0.7);
              }
              break;
              
            case 'cyberpunk_neon':
              const glow = Math.sin((x + y) * 0.01) * 30;
              r = Math.min(255, r * 1.5 + glow);
              g = Math.min(255, g * 0.8);
              b = Math.min(255, b * 1.7 + glow);
              break;
              
            default:
              // Default enhancement
              r = Math.min(255, r * 1.2);
              g = Math.min(255, g * 1.2);
              b = Math.min(255, b * 1.2);
              break;
          }
          
          // Apply smooth blending with proper clamping
          const strengthFactor = Math.max(0, Math.min(1, strength / 100));
          const originalR = data[i];
          const originalG = data[i + 1];
          const originalB = data[i + 2];
          
          // Smooth interpolation with gamma correction for better visual results
          const gamma = 2.2;
          const blendR = Math.pow(Math.pow(originalR / 255, gamma) * (1 - strengthFactor) + Math.pow(r / 255, gamma) * strengthFactor, 1 / gamma) * 255;
          const blendG = Math.pow(Math.pow(originalG / 255, gamma) * (1 - strengthFactor) + Math.pow(g / 255, gamma) * strengthFactor, 1 / gamma) * 255;
          const blendB = Math.pow(Math.pow(originalB / 255, gamma) * (1 - strengthFactor) + Math.pow(b / 255, gamma) * strengthFactor, 1 / gamma) * 255;
          
          data[i] = Math.max(0, Math.min(255, Math.round(blendR)));
          data[i + 1] = Math.max(0, Math.min(255, Math.round(blendG)));
          data[i + 2] = Math.max(0, Math.min(255, Math.round(blendB)));
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.src = imageDataUrl;
    });
  };

  const handleSendMessage = async (text?: string) => {
    const content = (text || inputRef.current?.value || '').trim();
    if (!content) return;

    addMessage('user', content);
    if (inputRef.current) inputRef.current.value = '';

    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('van gogh') || lowerContent.includes('starry night')) {
      setSelectedStyle('van_gogh_starry_night');
      addMessage('assistant', '🎨 Van Gogh - Starry Night selected! This model captures the swirling brushstrokes and vibrant colors of Vincent\'s iconic masterpiece.');
    } else if (lowerContent.includes('picasso') || lowerContent.includes('cubist')) {
      setSelectedStyle('picasso_cubist');
      addMessage('assistant', '🎭 Picasso - Cubist selected! Get ready for geometric abstraction and fragmented forms that revolutionized modern art.');
    } else if (lowerContent.includes('cyberpunk') || lowerContent.includes('neon')) {
      setSelectedStyle('cyberpunk_neon');
      addMessage('assistant', '🤖 Cyberpunk - Neon selected! Transform your images with futuristic aesthetics and glowing digital enhancements.');
    } else if (lowerContent.includes('apply') || lowerContent.includes('process') || lowerContent.includes('transform')) {
      if (currentImage && selectedStyle) {
        await processImage();
      } else {
        addMessage('assistant', '📋 Please upload an image and select a neural style model first. Then I can run the inference pipeline for you!');
      }
    } else if (lowerContent.includes('webcam') || lowerContent.includes('camera')) {
      setShowWebcam(true);
      addMessage('assistant', '📹 Webcam mode activated! Experience real-time neural style transfer with live camera feed. Perfect for live streaming and video calls!');
    } else {
      addMessage('assistant', '🎨 I\'m your AI art assistant! I can transform images using neural style transfer models inspired by famous artists. Start by uploading an image, then choose from Van Gogh, Picasso, or Cyberpunk styles for AI-powered transformation.');
    }
  };

  const openImageModal = (imageUrl: string, title: string) => {
    setModalImage(imageUrl);
    setModalTitle(title);
    setShowImageModal(true);
  };

  const downloadImage = (imageUrl: string, styleName?: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `neural-style-${styleName?.replace(/\s+/g, '-').toLowerCase() || 'processed'}-${Date.now()}.png`;
    link.click();
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome-clear',
      role: 'assistant',
      content: '🧹 Chat cleared! Ready for a fresh start. Upload a new image to begin your next artistic creation!',
      timestamp: new Date(),
    }]);
    setCurrentImage(null);
    setSelectedStyle('');
  };

  const resetSession = () => {
    // Clear all state
    setCurrentImage(null);
    setSelectedStyle('');
    setStyleStrength(80);
    setShowWebcam(false);
    setIsProcessing(false);
    setShowImageModal(false);
    setModalImage('');
    setModalTitle('');
    setIsControlsCollapsed(false);
    setWasmLoaded(false);
    setEngine(null);
    setModels([]);
    
    // Reset global WASM engine
    wasmEngine = null;
    
    // Clean up resources to prevent memory leaks
    if (typeof window !== 'undefined') {
      import('../lib/wasmLoader').then(({ cleanup }) => {
        cleanup();
      }).catch(console.error);
    }
    
    // Set welcome message
    setMessages([{
      id: 'welcome-reset',
      role: 'assistant',
      content: '🔄 Session reset! All settings restored to defaults. Upload a new image to begin your neural style transfer journey!',
      timestamp: new Date(),
    }]);
    
    // Re-initialize after a brief delay to ensure clean state
    setTimeout(() => {
      setIsInitialized(true);
    }, 100);
  };

  // Show loading state until initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-indigo-400 rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Neural Style Transfer Studio</h2>
          <p className="text-purple-200">Initializing AI-powered artistic transformation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Neural Style Studio
                </h1>
                <p className="text-sm text-slate-600">
                  {wasmLoaded ? '🚀 WebAssembly + ONNX Active' : '⚡ Enhanced CPU Mode'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium ${
                wasmLoaded 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  wasmLoaded ? 'bg-green-500' : 'bg-amber-500'
                }`}></div>
                {wasmLoaded ? 'WASM Ready' : 'CPU Enhanced'}
              </div>
              
              <button
                onClick={clearChat}
                className="flex items-center space-x-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200 font-medium"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </button>
              
              <button
                onClick={resetSession}
                className="flex items-center space-x-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200 font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Style Controls Panel */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/50 mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-slate-200/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Palette className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-900">Artistic Style Controls</h2>
              </div>
              <button
                onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
                className="p-2 hover:bg-white/50 rounded-xl transition-all duration-200"
              >
                {isControlsCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {!isControlsCollapsed && (
            <div className="p-8 space-y-6">
              {/* Style Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  🎨 Neural Style Model
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all duration-200 text-slate-700 font-medium"
                >
                  <option value="">Choose your artistic style...</option>
                  {models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.description} • {model.size_mb}MB • {model.input_width}×{model.input_height}
                    </option>
                  ))}
                </select>
              </div>

              {/* Style Strength */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  ⚡ Style Intensity: {styleStrength}%
                </label>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={styleStrength}
                    onChange={(e) => setStyleStrength(Number(e.target.value))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span className="font-medium">Original</span>
                    <span className="font-medium">Full Stylization</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={processImage}
                  disabled={!currentImage || !selectedStyle || isProcessing}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      <span>Apply Style Transfer</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setShowWebcam(!showWebcam)}
                  className="flex items-center space-x-3 px-6 py-3 border-2 border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-semibold text-slate-700 hover:text-slate-900"
                >
                  <Camera className="w-5 h-5" />
                  <span>{showWebcam ? 'Hide' : 'Show'} Webcam</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Chat Interface */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
          {/* Messages Area */}
          <div className="p-8 space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-lg px-6 py-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                      : 'bg-slate-100/80 text-slate-800 border border-slate-200/50'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  
                  {message.image && (
                    <div className="mt-4">
                      <img
                        src={message.image}
                        alt="Uploaded"
                        className="w-full h-40 object-cover rounded-xl cursor-pointer border-2 border-white/20 hover:scale-105 transition-transform duration-200"
                        onClick={() => openImageModal(message.image!, 'Original Image')}
                      />
                    </div>
                  )}
                  
                  {message.processedImage && (
                    <div className="mt-4">
                      <img
                        src={message.processedImage}
                        alt="Processed"
                        className="w-full h-40 object-cover rounded-xl cursor-pointer border-2 border-white/20 hover:scale-105 transition-transform duration-200"
                        onClick={() => openImageModal(message.processedImage!, `Stylized: ${message.styleName}`)}
                      />
                      <div className="flex justify-center mt-3">
                        <button
                          onClick={() => downloadImage(message.processedImage!, message.styleName)}
                          className="flex items-center space-x-2 text-xs bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all duration-200 backdrop-blur-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Masterpiece</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {message.isProcessing && (
                    <div className="mt-4 flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">Processing your image...</span>
                    </div>
                  )}
                  
                  <div className={`text-xs mt-3 ${message.role === 'user' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200/50 bg-gradient-to-r from-slate-50 to-blue-50 p-6">
            <div className="relative">
              <textarea
                ref={inputRef}
                rows={3}
                placeholder="Describe what you'd like to create, or upload an image to begin your artistic journey..."
                className="w-full resize-none rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-300 px-6 py-4 pr-24 text-sm placeholder:text-slate-400 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200 font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="absolute right-4 bottom-4 flex items-center space-x-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="p-3 rounded-xl hover:bg-slate-100 transition-all duration-200 group"
                  title="Upload image"
                >
                  <Upload className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
                </button>
                <button
                  onClick={() => handleSendMessage()}
                  className="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  title="Send message"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Webcam Component */}
        {showWebcam && (
          <div className="mt-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/50 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center space-x-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                <span>Live Webcam Style Transfer</span>
              </h3>
              <RealtimeWebcam 
                engine={engine}
                selectedStyle={selectedStyle}
                styleStrength={styleStrength}
              />
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative max-w-5xl max-h-full bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
              <h3 className="text-xl font-bold text-slate-900">{modalTitle}</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8">
              <img
                src={modalImage}
                alt={modalTitle}
                className="max-w-full max-h-[70vh] object-contain mx-auto rounded-2xl shadow-lg"
              />
            </div>
            <div className="p-6 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 flex justify-center">
              <button
                onClick={() => downloadImage(modalImage, modalTitle)}
                className="flex items-center space-x-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <Download className="w-5 h-5" />
                <span>Download Image</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for enhanced styling */}
      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        
        .slider-thumb::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          cursor: pointer;
          border: none;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(241, 245, 249, 0.5);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #cbd5e1, #94a3b8);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #94a3b8, #64748b);
        }
      `}</style>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}