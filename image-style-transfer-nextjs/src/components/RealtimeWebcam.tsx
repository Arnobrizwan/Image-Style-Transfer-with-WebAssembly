'use client';

import { useRef, useState, useEffect } from 'react';
import { Camera, Square, Play, Download, X } from 'lucide-react';

interface RealtimeWebcamProps {
  engine: any;
  selectedStyle: string;
  styleStrength: number;
}

export default function RealtimeWebcam({ engine, selectedStyle, styleStrength }: RealtimeWebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string>('');

  // Start webcam stream
  const startStream = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      setError('Failed to access camera. Please check permissions.');
      console.error('Camera access error:', err);
    }
  };

  // Stop webcam stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsProcessing(false);
  };

  // Capture current frame
  const captureFrame = async () => {
    console.log('Capture button clicked');
    
    if (!videoRef.current || !canvasRef.current || !processedCanvasRef.current) {
      console.log('Missing refs:', {
        video: !!videoRef.current,
        canvas: !!canvasRef.current,
        processedCanvas: !!processedCanvasRef.current
      });
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.log('No canvas context');
      return;
    }

    console.log('Video dimensions:', video.videoWidth, video.videoHeight);

    // Set canvas size to match video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageDataUrl);
    
    console.log('Image captured, size:', imageDataUrl.length);

    // Process with style transfer
    if (selectedStyle) {
      console.log('Processing with style:', selectedStyle);
      await processImage(imageDataUrl);
    } else {
      console.log('No style selected, showing original');
      // If no style selected, just show the captured frame
      const processedCanvas = processedCanvasRef.current;
      const processedCtx = processedCanvas.getContext('2d');
      if (processedCtx) {
        processedCanvas.width = canvas.width;
        processedCanvas.height = canvas.height;
        processedCtx.drawImage(canvas, 0, 0);
      }
    }
  };

  // Process image with style transfer
  const processImage = async (imageDataUrl: string) => {
    if (!processedCanvasRef.current) return;
    
    setIsProcessing(true);
    
    try {
      let processedImageUrl: string;
      
      if (engine && selectedStyle) {
        // Use WebAssembly engine
        processedImageUrl = await engine.process_image(imageDataUrl, selectedStyle, styleStrength / 100);
      } else {
        // Fallback CPU processing
        processedImageUrl = await processFallback(imageDataUrl);
      }
      
      // Display processed image
      const img = new Image();
      img.onload = () => {
        const canvas = processedCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = processedImageUrl;
      
    } catch (error) {
      console.error('Processing failed:', error);
      setError('Style transfer processing failed');
      
      // Show original image if processing fails
      const img = new Image();
      img.onload = () => {
        const canvas = processedCanvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = imageDataUrl;
    } finally {
      setIsProcessing(false);
    }
  };

  // Fallback processing for when WASM engine is not available
  const processFallback = async (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        canvas.width = 320;
        canvas.height = 240;
        ctx.drawImage(img, 0, 0, 320, 240);
        
        const imageData = ctx.getImageData(0, 0, 320, 240);
        const data = imageData.data;
        
        // Apply simple style effects based on selected style
        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % 320;
          const y = Math.floor((i / 4) / 320);
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          switch (selectedStyle) {
            case 'van_gogh_starry_night':
              const swirl = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 25;
              r = Math.min(255, r * 1.4 + swirl + 20);
              g = Math.min(255, g * 1.3 + swirl * 0.7 + 15);
              b = Math.min(255, b * 1.2 + swirl * 0.5 + 10);
              break;
              
            case 'cyberpunk_neon':
              const glow = Math.sin((x + y) * 0.01) * 30;
              r = Math.min(255, r * 1.5 + glow);
              g = Math.min(255, g * 0.8);
              b = Math.min(255, b * 1.7 + glow);
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
              
            default:
              r = Math.min(255, r * 1.2);
              g = Math.min(255, g * 1.1);
              b = Math.min(255, b * 1.3);
          }
          
          const strengthFactor = styleStrength / 100;
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

  // Download processed image
  const downloadImage = () => {
    if (!processedCanvasRef.current) return;
    
    const canvas = processedCanvasRef.current;
    const link = document.createElement('a');
    link.download = `webcam-style-${selectedStyle?.replace(/_/g, '-').toLowerCase()}-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  // Auto-start stream when component mounts
  useEffect(() => {
    startStream();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">Real-time Style Transfer</h3>
          </div>
          <div className={`flex items-center px-3 py-1 rounded-full text-xs ${
            isStreaming ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}></div>
            {isStreaming ? 'Live' : 'Stopped'}
          </div>
        </div>
        
        {selectedStyle && (
          <p className="text-sm text-slate-600 mt-1">
            Current style: <span className="font-medium">{selectedStyle.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span> ({styleStrength}% strength)
          </p>
        )}
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Original Video Feed */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Live Camera Feed</h4>
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-600">Camera not active</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Processed Output */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Style Transfer Output</h4>
            <div className="relative bg-slate-100 rounded-lg overflow-hidden aspect-video">
              <canvas
                ref={processedCanvasRef}
                className="w-full h-full object-cover"
              />
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="text-center text-white">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm">Processing...</p>
                  </div>
                </div>
              )}
              {!selectedStyle && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-slate-600 text-sm">Select a style to begin processing</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-3 mt-6">
          <button
            onClick={isStreaming ? stopStream : startStream}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isStreaming
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isStreaming ? (
              <>
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </>
            )}
          </button>

          <button
            onClick={captureFrame}
            disabled={!isStreaming || isProcessing}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span>{isProcessing ? 'Processing...' : 'Capture'}</span>
          </button>

          <button
            onClick={downloadImage}
            disabled={!processedCanvasRef.current?.width}
            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>

        {/* Hidden canvases for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}