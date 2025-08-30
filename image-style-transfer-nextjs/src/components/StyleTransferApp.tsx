'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Download, RotateCcw, Camera, Play, Square } from 'lucide-react';

interface StyleMetadata {
  name: string;
  size_mb: number;
  input_width: number;
  input_height: number;
  model_url: string;
  description: string;
}

let wasmModule: any = null;

export default function StyleTransferApp() {
  const [engine, setEngine] = useState<any>(null);
  const [styles, setStyles] = useState<StyleMetadata[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StyleMetadata | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [styledImage, setStyledImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [styleStrength, setStyleStrength] = useState(80);
  const [status, setStatus] = useState('Initializing...');
  const [webcamActive, setWebcamActive] = useState(false);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize WebAssembly module
  useEffect(() => {
    const initWasm = async () => {
      try {
        if (!wasmModule) {
          // Load WebAssembly files at runtime to avoid build-time parsing
          const script = document.createElement('script');
          script.src = '/wasm/style_transfer_wasm.js';
          script.type = 'text/javascript';
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          
          // Wait for the global wasm_bindgen to be available
          while (!(window as any).wasm_bindgen) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          // Initialize the WebAssembly module
          await (window as any).wasm_bindgen('/wasm/style_transfer_wasm_bg.wasm');
          wasmModule = (window as any).wasm_bindgen;
        }
        
        const styleEngine = new wasmModule.StyleTransferEngine();
        
        const availableStyles = styleEngine.get_styles();
        setStyles(availableStyles);
        setEngine(styleEngine);
        setStatus('Ready - Upload an image to begin');
      } catch (error) {
        console.error('Failed to initialize WebAssembly:', error);
        setStatus('WebAssembly initialization failed. Check browser compatibility.');
      }
    };

    initWasm();
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Please choose an image under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setStyledImage(null);
      setStatus('Image loaded - Select a style to process');
    };
    reader.readAsDataURL(file);
  }, []);

  const processImage = useCallback(async () => {
    if (!engine || !originalImage || !selectedStyle || isProcessing) return;

    setIsProcessing(true);
    setStatus('Processing image...');
    const startTime = performance.now();

    try {
      // Convert data URL to ArrayBuffer
      const response = await fetch(originalImage);
      const imageData = await response.arrayBuffer();
      
      // Preprocess image
      const preprocessed = engine.preprocess_image(
        new Uint8Array(imageData),
        selectedStyle.input_width,
        selectedStyle.input_height
      );

      // Run inference
      const result = await engine.run_inference(selectedStyle.name, preprocessed);

      // Apply style strength blending
      const blended = engine.blend_images(preprocessed, result, styleStrength / 100);

      // Postprocess to get final image
      const outputImageData = engine.postprocess_image(
        blended,
        selectedStyle.input_width,
        selectedStyle.input_height
      );

      // Convert to canvas and display
      const canvas = document.createElement('canvas');
      canvas.width = selectedStyle.input_width;
      canvas.height = selectedStyle.input_height;
      const ctx = canvas.getContext('2d')!;
      
      const imgData = new ImageData(
        new Uint8ClampedArray(outputImageData),
        selectedStyle.input_width,
        selectedStyle.input_height
      );
      
      ctx.putImageData(imgData, 0, 0);
      setStyledImage(canvas.toDataURL());

      const endTime = performance.now();
      setProcessingTime(Math.round(endTime - startTime));
      setStatus('Style transfer completed!');
    } catch (error) {
      console.error('Processing failed:', error);
      setStatus('Processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [engine, originalImage, selectedStyle, styleStrength, isProcessing]);

  const downloadImage = () => {
    if (!styledImage) return;
    
    const link = document.createElement('a');
    link.download = `styled-image-${Date.now()}.png`;
    link.href = styledImage;
    link.click();
  };

  const reset = () => {
    setOriginalImage(null);
    setStyledImage(null);
    setSelectedStyle(null);
    setProcessingTime(null);
    setStatus('Ready - Upload an image to begin');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleWebcam = async () => {
    if (webcamActive) {
      // Stop webcam
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      setWebcamActive(false);
    } else {
      // Start webcam
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setWebcamActive(true);
        }
      } catch (error) {
        console.error('Failed to access webcam:', error);
        alert('Failed to access webcam');
      }
    }
  };

  const captureFromWebcam = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d')!;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL();
    setOriginalImage(dataUrl);
    setStyledImage(null);
    setStatus('Webcam image captured - Select a style to process');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Controls Panel */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 lg:col-span-1">
          <h2 className="text-2xl font-bold text-white mb-6">Controls</h2>
          
          {/* Status */}
          <div className="bg-white/20 rounded-lg p-4 mb-6">
            <div className="text-white text-sm">{status}</div>
            {processingTime && (
              <div className="text-white/70 text-xs mt-1">
                Processing time: {processingTime}ms
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-white/20 hover:bg-white/30 border-2 border-dashed border-white/50 rounded-lg p-8 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-white" />
              <div className="text-white font-medium">Upload Image</div>
              <div className="text-white/70 text-sm">JPG, PNG up to 10MB</div>
            </button>
          </div>

          {/* Style Selection */}
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3">Select Style</h3>
            <div className="space-y-2">
              {styles.map((style, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedStyle(style)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedStyle?.name === style.name
                      ? 'bg-blue-500/50 border border-blue-300'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <div className="text-white font-medium">{style.name}</div>
                  <div className="text-white/70 text-sm">
                    {style.size_mb}MB • {style.input_width}×{style.input_height}
                  </div>
                  <div className="text-white/60 text-xs mt-1">{style.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style Strength */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">
              Style Strength: {styleStrength}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={styleStrength}
              onChange={(e) => setStyleStrength(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={processImage}
              disabled={!originalImage || !selectedStyle || isProcessing}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Apply Style Transfer
                </>
              )}
            </button>

            <button
              onClick={downloadImage}
              disabled={!styledImage}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Result
            </button>

            <button
              onClick={reset}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </button>
          </div>

          {/* Webcam Controls */}
          <div className="mt-6 pt-6 border-t border-white/20">
            <h3 className="text-white font-semibold mb-3">Webcam Mode</h3>
            <div className="space-y-3">
              <button
                onClick={toggleWebcam}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <Camera className="w-5 h-5 mr-2" />
                {webcamActive ? 'Stop Webcam' : 'Start Webcam'}
              </button>
              
              {webcamActive && (
                <button
                  onClick={captureFromWebcam}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capture Image
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Image Display */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-2xl font-bold text-white mb-6">Preview</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Original Image */}
            <div>
              <h3 className="text-white font-medium mb-3">Original</h3>
              <div className="bg-white/5 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                {originalImage ? (
                  <img
                    src={originalImage}
                    alt="Original"
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : (
                  <div className="text-white/50 text-center">
                    Upload an image to get started
                  </div>
                )}
              </div>
            </div>

            {/* Styled Image */}
            <div>
              <h3 className="text-white font-medium mb-3">Stylized Result</h3>
              <div className="bg-white/5 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                {styledImage ? (
                  <img
                    src={styledImage}
                    alt="Stylized"
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : (
                  <div className="text-white/50 text-center">
                    Processed image will appear here
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Webcam Video */}
          {webcamActive && (
            <div className="mt-6">
              <h3 className="text-white font-medium mb-3">Live Webcam</h3>
              <div className="flex justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="rounded-lg max-w-md"
                />
              </div>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  );
}
