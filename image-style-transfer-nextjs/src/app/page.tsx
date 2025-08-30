'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, Download, RotateCcw, Camera, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import the StyleTransfer component to avoid SSR issues
const StyleTransferApp = dynamic(() => import('../components/StyleTransferApp'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600">
      <div className="text-white text-xl">Loading WebAssembly...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            AI Style Transfer
          </h1>
          <p className="text-xl text-white/90 mb-6">
            Rust + WebAssembly + Next.js • Privacy-First • Client-Side Processing
          </p>
          <div className="inline-flex items-center bg-white/10 backdrop-blur-md rounded-full px-6 py-3 text-white">
            <Zap className="w-5 h-5 mr-2" />
            <span>WebAssembly Powered</span>
          </div>
        </header>

        <StyleTransferApp />
      </div>
    </div>
  );
}
