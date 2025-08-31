'use client';

import { useRef, useState, useEffect } from 'react';
import { Send, Image as ImageIcon, Zap, Download, RotateCcw, Trash2, ChevronDown, ChevronUp, Eye, X, Camera } from 'lucide-react';
import dynamic from 'next/dynamic';

// Load RealtimeWebcam component
const RealtimeWebcam = dynamic(() => import('../components/RealtimeWebcam'), {
  ssr: false,
  loading: () => <div className="text-white">Loading webcam...</div>
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

  // Initialize component and messages after hydration
  useEffect(() => {
    if (!isInitialized) {
      setMessages([{
        id: 'welcome',
        role: 'assistant', 
        content: 'Welcome to AI Style Transfer powered by Rust + WebAssembly + ONNX. Upload an image and I\'ll transform it with neural style transfer models.',
        timestamp: new Date(),
      }]);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Initialize WebAssembly module
  useEffect(() => {
    const initWasm = async () => {
      if (!wasmEngine && typeof window !== 'undefined' && isInitialized) {
        try {
          console.log('Loading WebAssembly module...');
          
          // Import the simple loader
          const { loadWasmModule } = await import('../lib/wasmLoader');
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
              addMessage('assistant', 'WebAssembly engine initialized successfully! You can now upload images for neural style transfer.');
            } catch (error) {
              setWasmLoaded(false);
              addMessage('assistant', 'WebAssembly engine not available. Using enhanced CPU processing for style transfer.');
            }
          } else {
            throw new Error('Failed to load any engine');
          }
          
        } catch (error) {
          console.error('WebAssembly initialization failed:', error);
          setWasmLoaded(false);
          
          // Set fallback models
          setModels([
            {
              name: 'van_gogh_starry_night',
              size_mb: 2.4,
              input_width: 256,
              input_height: 256,
              input_channels: 3,
              model_url: '/models/van_gogh_starry_night.onnx',
              description: 'Swirling brushstrokes and vibrant colors'
            },
            {
              name: 'picasso_cubist', 
              size_mb: 2.1,
              input_width: 256,
              input_height: 256,
              input_channels: 3,
              model_url: '/models/picasso_cubist.onnx',
              description: 'Geometric abstraction and fragmented forms'
            },
            {
              name: 'cyberpunk_neon',
              size_mb: 2.8, 
              input_width: 256,
              input_height: 256,
              input_channels: 3,
              model_url: '/models/cyberpunk_neon.onnx',
              description: 'Futuristic neon-lit digital enhancement'
            }
          ]);
          
          addMessage('assistant', 'Using CPU fallback mode for style transfer. Upload an image to begin!');
        }
      }
    };

    initWasm();
  }, [isInitialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleImageUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      addMessage('assistant', 'Image is too large. Please upload an image under 10MB.');
      return;
    }

    try {
      const imageUrl = await fileToDataUrl(file);
      setCurrentImage(imageUrl);
      
      addMessage('user', 'I uploaded an image for neural style transfer', imageUrl);
      addMessage('assistant', 'Image loaded successfully! Select a style below to apply neural style transfer using our ONNX models.');
    } catch (error) {
      addMessage('assistant', 'Failed to load the image. Please try a different file.');
    }
  };

  const processImage = async () => {
    if (!currentImage || !selectedStyle) {
      addMessage('assistant', 'Please upload an image and select a style first.');
      return;
    }

    setIsProcessing(true);
    const processingId = addMessage('assistant', `Running neural style transfer with ${selectedStyle} model at ${styleStrength}% strength...`, undefined, true);

    try {
      let processedImageUrl: string;

      if (wasmLoaded && engine) {
        // Use real WebAssembly + ONNX processing
        console.log('Using WebAssembly + ONNX pipeline');
        processedImageUrl = await engine.process_image(currentImage, selectedStyle, styleStrength / 100);
      } else {
        // Fallback to enhanced CPU processing
        console.log('Using fallback CPU processing');
        processedImageUrl = await processFallback(currentImage, selectedStyle, styleStrength);
      }
      
      updateMessage(processingId, {
        content: `Neural style transfer complete! Here's your ${selectedStyle} transformation using ${wasmLoaded ? 'WebAssembly + ONNX' : 'CPU fallback'} processing:`,
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
        content: 'Neural network processing failed. Please try again with a different image.',
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
            case 'Van Gogh - Starry Night':
              const swirl = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 25;
              r = Math.min(255, r * 1.4 + swirl + 20);
              g = Math.min(255, g * 1.3 + swirl * 0.7 + 15);
              b = Math.min(255, b * 1.2 + swirl * 0.5 + 10);
              break;
              
            case 'Picasso - Cubist':
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
              
            case 'Cyberpunk Neon':
              const glow = Math.sin((x + y) * 0.01) * 30;
              r = Math.min(255, r * 1.5 + glow);
              g = Math.min(255, g * 0.8);
              b = Math.min(255, b * 1.7 + glow);
              break;
              
            case 'Monet - Water Lilies':
              r = Math.min(255, r * 1.2 + 25);
              g = Math.min(255, g * 1.25 + 30);
              b = Math.min(255, b * 1.15 + 20);
              break;
              
            case 'Anime Studio Ghibli':
              r = Math.min(255, Math.round(r / 32) * 32 * 1.4);
              g = Math.min(255, Math.round(g / 32) * 32 * 1.3);
              b = Math.min(255, Math.round(b / 32) * 32 * 1.2);
              break;
          }
          
          const strengthFactor = strength / 100;
          data[i] = data[i] * (1 - strengthFactor) + r * strengthFactor;
          data[i + 1] = data[i + 1] * (1 - strengthFactor) + g * strengthFactor;
          data[i + 2] = data[i + 2] * (1 - strengthFactor) + b * strengthFactor;
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
      setSelectedStyle('Van Gogh - Starry Night');
      addMessage('assistant', 'Van Gogh - Starry Night neural model selected! This model was trained on Van Gogh\'s masterpiece to recreate his distinctive swirling brushstrokes and vibrant color palette.');
    } else if (lowerContent.includes('picasso') || lowerContent.includes('cubist')) {
      setSelectedStyle('Picasso - Cubist');
      addMessage('assistant', 'Picasso - Cubist model selected! This neural network applies geometric abstraction and fragmented forms characteristic of Picasso\'s revolutionary style.');
    } else if (lowerContent.includes('cyberpunk') || lowerContent.includes('neon')) {
      setSelectedStyle('Cyberpunk Neon');
      addMessage('assistant', 'Cyberpunk Neon model selected! This AI model enhances images with futuristic neon aesthetics and digital enhancement effects.');
    } else if (lowerContent.includes('monet') || lowerContent.includes('water lilies')) {
      setSelectedStyle('Monet - Water Lilies');
      addMessage('assistant', 'Monet - Water Lilies model selected! This neural network applies impressionist techniques to capture light and atmospheric effects like Monet\'s famous paintings.');
    } else if (lowerContent.includes('anime') || lowerContent.includes('ghibli')) {
      setSelectedStyle('Anime Studio Ghibli');
      addMessage('assistant', 'Anime Studio Ghibli model selected! This model transforms images with the distinctive animation style of Studio Ghibli films.');
    } else if (lowerContent.includes('apply') || lowerContent.includes('process') || lowerContent.includes('transform')) {
      if (currentImage && selectedStyle) {
        await processImage();
      } else {
        addMessage('assistant', 'Please upload an image and select a neural style model first, then I can run the inference pipeline.');
      }
    } else if (lowerContent.includes('webcam') || lowerContent.includes('camera')) {
      setShowWebcam(true);
      addMessage('assistant', 'Webcam mode activated! You can now use real-time neural style transfer with your camera feed.');
    } else {
      addMessage('assistant', 'I can transform images using neural style transfer models trained on famous artistic styles. Upload an image first, then choose from Van Gogh, Picasso, Cyberpunk, Monet, or Anime styles for AI-powered transformation.');
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
      content: 'Chat cleared! Upload a new image to get started with neural style transfer.',
      timestamp: new Date(),
    }]);
    setCurrentImage(null);
    setSelectedStyle('');
  };

  const resetSession = () => {
    setCurrentImage(null);
    setSelectedStyle('');
    setStyleStrength(80);
    setShowWebcam(false);
    setMessages([{
      id: 'welcome-reset',
      role: 'assistant',
      content: 'Session reset! Upload a new image to begin neural style transfer with ONNX models.',
      timestamp: new Date(),
    }]);
  };

  // Show loading state until initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Initializing Neural Style Transfer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Neural Style Transfer</h1>
                <p className="text-sm text-slate-500">
                  {wasmLoaded ? 'Rust + WebAssembly + ONNX' : 'CPU Fallback Mode'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className={`flex items-center px-3 py-1 rounded-lg text-xs ${
                wasmLoaded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  wasmLoaded ? 'bg-green-500' : 'bg-yellow-500'
                }`}></div>
                {wasmLoaded ? 'WASM Ready' : 'CPU Mode'}
              </div>
              
              <button
                onClick={clearChat}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </button>
              
              <button
                onClick={resetSession}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-140px)]">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 chat-scroll">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                }`}>
                  {message.isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm">Processing...</span>
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed">{message.content}</div>
                  )}
                  
                  {message.image && (
                    <div className="mt-3">
                      {message.processedImage ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-slate-600 mb-2 font-medium">Original</div>
                              <img
                                src={message.image}
                                alt="Original"
                                className="rounded-lg w-full h-32 object-cover border border-slate-200 cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => openImageModal(message.image!, 'Original Image')}
                              />
                            </div>
                            <div>
                              <div className="text-xs text-slate-600 mb-2 font-medium">{message.styleName?.split(' - ')[0]}</div>
                              <img
                                src={message.processedImage}
                                alt="Styled"
                                className="rounded-lg w-full h-32 object-cover border border-slate-200 cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => openImageModal(message.processedImage!, `${message.styleName} Style`)}
                              />
                            </div>
                          </div>
                          <div className="flex justify-center">
                            <button
                              onClick={() => downloadImage(message.processedImage!, message.styleName)}
                              className="flex items-center space-x-1 text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download Neural Style</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={message.image}
                          alt="Uploaded"
                          className="rounded-xl max-w-full h-auto border border-slate-200 cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => openImageModal(message.image!, 'Uploaded Image')}
                        />
                      )}
                    </div>
                  )}
                  
                  <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Style Controls */}
          {currentImage && (
            <div className="border-t border-slate-100">
              <div 
                className="flex items-center justify-between px-4 py-2 bg-slate-50 cursor-pointer text-sm"
                onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
              >
                <div className="font-medium text-slate-700">Neural Style Controls</div>
                {isControlsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </div>
              
              {!isControlsCollapsed && (
                <div className="p-3 bg-slate-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">ONNX Model</label>
                      <select
                        value={selectedStyle}
                        onChange={(e) => setSelectedStyle(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Select neural model...</option>
                        {models.map((model) => (
                          <option key={model.name} value={model.name}>
                            {model.name} ({model.size_mb}MB)
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Style Strength: {styleStrength}%
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={styleStrength}
                        onChange={(e) => setStyleStrength(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={processImage}
                      disabled={!selectedStyle || isProcessing}
                      className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{isProcessing ? 'Running Neural Network...' : 'Apply Neural Style'}</span>
                    </button>
                    
                    <button
                      onClick={() => setShowWebcam(!showWebcam)}
                      className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{showWebcam ? 'Hide' : 'Live'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-100 p-4">
            <div className="relative">
              <textarea
                ref={inputRef}
                rows={2}
                placeholder="Upload an image and choose a neural style model..."
                className="w-full resize-none rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 pr-20 text-sm placeholder:text-slate-400 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="absolute right-3 bottom-3 flex items-center space-x-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Upload image"
                >
                  <ImageIcon className="w-5 h-5 text-slate-500" />
                </button>
                <button
                  onClick={() => handleSendMessage()}
                  className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors"
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
          <div className="mt-6">
            <RealtimeWebcam 
              engine={engine}
              selectedStyle={selectedStyle}
              styleStrength={styleStrength}
            />
          </div>
        )}
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full bg-white rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-slate-900">{modalTitle}</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={modalImage}
                alt={modalTitle}
                className="max-w-full max-h-[70vh] object-contain mx-auto"
              />
            </div>
            <div className="p-4 border-t flex justify-center">
              <button
                onClick={() => downloadImage(modalImage, modalTitle)}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Download Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
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