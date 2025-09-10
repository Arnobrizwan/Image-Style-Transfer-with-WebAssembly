let wasmModule = null;
let isLoading = false;
let loadPromise = null;
let registryModels = null;
let webgpuEngine = null;
let loadedModels = new Set(); // Track loaded models to prevent memory leaks

/**
 * Load models from registry.json
 * @returns {Promise<Array>} Models from registry or fallback
 */
async function loadRegistryModels() {
  if (registryModels) {
    return registryModels;
  }
  
  try {
    console.log('[Registry] Loading models from registry.json...');
    const response = await fetch('/models/registry.json?t=' + Date.now());
    
    if (!response.ok) {
      console.warn(`[Registry] Failed to fetch registry.json: ${response.status}`);
      return getDefaultModels();
    }
    
    const rawModels = await response.json();
    console.log('[Registry] Raw models:', rawModels);
    
    // Normalize registry models to match expected structure
    registryModels = rawModels.map(model => ({
      name: model.name,
      size_mb: model.size_mb || 2.5,
      input_width: model.input_width || 256,
      input_height: model.input_height || 256,
      input_channels: model.input_channels || 3,
      model_url: model.url, // Registry uses 'url' field
      description: model.description || model.title || model.name
    }));
    
    console.log('[Registry] Normalized models:', registryModels);
    return registryModels;
    
  } catch (error) {
    console.error('[Registry] Error loading registry.json:', error);
    return getDefaultModels();
  }
}

/**
 * Get default hardcoded models as fallback
 * @returns {Array} Default models
 */
function getDefaultModels() {
  return [
    {
      name: 'van_gogh_starry_night',
      size_mb: 2.4,
      input_width: 256,
      input_height: 256,
      input_channels: 3,
      model_url: '/models/van_gogh_starry_night.onnx',
      description: 'Swirling brushstrokes and vibrant colors inspired by Vincent van Gogh'
    },
    {
      name: 'picasso_cubist', 
      size_mb: 2.1,
      input_width: 256,
      input_height: 256,
      input_channels: 3,
      model_url: '/models/picasso_cubist.onnx',
      description: 'Geometric abstraction and fragmented forms in the style of Pablo Picasso'
    },
    {
      name: 'cyberpunk_neon',
      size_mb: 2.8, 
      input_width: 256,
      input_height: 256,
      input_channels: 3,
      model_url: '/models/cyberpunk_neon.onnx',
      description: 'Futuristic neon-lit digital enhancement with glowing highlights and high contrast'
    },
    {
      name: 'monet_water_lilies',
      size_mb: 2.6,
      input_width: 256,
      input_height: 256,
      input_channels: 3,
      model_url: '/models/monet_water_lilies.onnx',
      description: 'Soft, dreamy brushwork capturing light and movement inspired by Claude Monet'
    },
    {
      name: 'anime_studio_ghibli',
      size_mb: 3.1,
      input_width: 256,
      input_height: 256,
      input_channels: 3,
      model_url: '/models/anime_studio_ghibli.onnx',
      description: 'Japanese animation-inspired transformation with vibrant colors and bold outlines'
    }
  ];
}

/**
 * Load WebAssembly module with comprehensive error handling
 * @returns {Promise<Object>} WASM module or mock engine
 */
export async function loadWasmModule() {
  // Return cached module if already loaded
  if (wasmModule) {
    console.log('Returning cached WASM module');
    return wasmModule;
  }
  
  // Return existing promise if currently loading
  if (isLoading && loadPromise) {
    console.log('WASM loading in progress, waiting...');
    return loadPromise;
  }
  
  // Start loading process
  isLoading = true;
  loadPromise = performWasmLoad();
  
  try {
    const result = await loadPromise;
    return result;
  } finally {
    isLoading = false;
    loadPromise = null;
  }
}

/**
 * Perform the actual WASM loading process
 * @returns {Promise<Object>} WASM module or mock engine
 */
async function performWasmLoad() {
  console.log('Starting WebAssembly module loading...');
  
  try {
    // Step 1: Check if files exist
    const filesExist = await checkWasmFiles();
    if (!filesExist) {
      console.warn('WASM files not found, using mock engine');
      wasmModule = await createMockEngine();
      return wasmModule;
    }
    
    // Step 2: Load JavaScript bindings
    const jsCode = await loadWasmJavaScript();
    if (!jsCode) {
      throw new Error('Failed to load WASM JavaScript bindings');
    }
    
    // Step 3: Execute JavaScript code and get init function
    const initFunction = await executeWasmCode(jsCode);
    if (!initFunction) {
      throw new Error('WASM init function not found');
    }
    
    // Step 4: Initialize WASM with binary file
    const wasmPath = getWasmPath();
    await initFunction(wasmPath);
    console.log('WASM binary initialized successfully');
    
    // Step 5: Create and initialize the StyleTransferEngine
    const engine = await createStyleEngine();
    if (engine) {
      wasmModule = engine;
      console.log('WebAssembly StyleTransferEngine created successfully');
      
      // Step 6: Initialize WebGPU engine if available
      await initializeWebGPU();
      
      return wasmModule;
    } else {
      throw new Error('StyleTransferEngine not available');
    }
    
  } catch (error) {
    console.error('WebAssembly loading failed:', error);
    console.log('Falling back to mock engine with CPU processing');
    wasmModule = await createMockEngine();
    return wasmModule;
  }
}

/**
 * Get the WASM binary path dynamically based on the current environment
 * @returns {string} Path to the WASM binary
 */
function getWasmPath() {
  // Check if we're in a development environment
  const isDev = process.env.NODE_ENV === 'development';
  
  // Use relative path for development, absolute for production
  if (isDev) {
    return '/wasm/style_transfer_wasm_bg.wasm';
  }
  
  // For production, try to get the base path from the current location
  const basePath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
  return `${basePath}/wasm/style_transfer_wasm_bg.wasm`;
}

/**
 * Check if WASM files exist and are accessible
 * @returns {Promise<boolean>} True if files exist
 */
async function checkWasmFiles() {
  try {
    const jsPath = '/wasm/style_transfer_wasm.js';
    const wasmPath = getWasmPath();
    
    const jsResponse = await fetch(jsPath, { method: 'HEAD' });
    const wasmResponse = await fetch(wasmPath, { method: 'HEAD' });
    
    const jsExists = jsResponse.ok;
    const wasmExists = wasmResponse.ok;
    
    console.log(`WASM files check: JS=${jsExists} (${jsPath}), WASM=${wasmExists} (${wasmPath})`);
    
    if (!jsExists) {
      console.error(`WASM JavaScript file not found at ${jsPath}`);
    }
    if (!wasmExists) {
      console.error(`WASM binary file not found at ${wasmPath}`);
    }
    
    return jsExists && wasmExists;
  } catch (error) {
    console.error('Error checking WASM files:', error);
    return false;
  }
}

/**
 * Load the WASM JavaScript bindings
 * @returns {Promise<string>} JavaScript code
 */
async function loadWasmJavaScript() {
  try {
    console.log('Fetching WASM JavaScript bindings...');
    const response = await fetch('/wasm/style_transfer_wasm.js');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const jsCode = await response.text();
    console.log(`Loaded WASM JavaScript (${jsCode.length} characters)`);
    
    // Basic validation
    if (!jsCode.includes('init') && !jsCode.includes('wasm_bindgen')) {
      throw new Error('WASM JavaScript appears invalid (missing init or wasm_bindgen)');
    }
    
    return jsCode;
  } catch (error) {
    console.error('Failed to load WASM JavaScript:', error);
    return null;
  }
}

/**
 * Execute WASM JavaScript code and extract init function
 * @param {string} jsCode - JavaScript code from wasm-bindgen
 * @returns {Promise<Function>} Init function
 */
async function executeWasmCode(jsCode) {
  try {
    console.log('Executing WASM JavaScript code...');
    
    // Use proper ES module import instead of data: URLs
    // Create a blob URL for the JavaScript code
    const blob = new Blob([jsCode], { type: 'application/javascript' });
    const jsUrl = URL.createObjectURL(blob);
    
    try {
      // Import the WASM module using proper ES module syntax
      const wasmModule = await import(jsUrl);
      
      // Extract the init function and StyleTransferEngine
      const initFunc = wasmModule.init || wasmModule.wasm_bindgen || null;
      const StyleTransferEngine = wasmModule.StyleTransferEngine || null;
      
      if (typeof initFunc !== 'function') {
        throw new Error('WASM init function not found or not a function');
      }
      
      // Store the StyleTransferEngine globally for later use
      if (StyleTransferEngine) {
        window.__StyleTransferEngine = StyleTransferEngine;
      }
      
      console.log('WASM JavaScript executed successfully');
      return initFunc;
      
    } finally {
      // Clean up the blob URL
      URL.revokeObjectURL(jsUrl);
    }
    
  } catch (error) {
    console.error('Failed to execute WASM code:', error);
    throw error;
  }
}

/**
 * Create StyleTransferEngine instance
 * @returns {Promise<Object>} Engine instance or null
 */
async function createStyleEngine() {
  try {
    const StyleTransferEngine = window.__StyleTransferEngine;
    
    if (!StyleTransferEngine) {
      console.warn('StyleTransferEngine class not found in WASM module');
      return null;
    }
    
    console.log('Creating StyleTransferEngine instance...');
    const engine = new StyleTransferEngine();
    
    // Initialize the engine
    if (typeof engine.initialize === 'function') {
      await engine.initialize();
      console.log('StyleTransferEngine initialized successfully');
    } else {
      console.warn('StyleTransferEngine.initialize method not found');
    }
    
    // Validate engine has required methods
    const requiredMethods = ['get_models', 'process_image'];
    const missingMethods = requiredMethods.filter(method => typeof engine[method] !== 'function');
    
    if (missingMethods.length > 0) {
      console.warn('StyleTransferEngine missing methods:', missingMethods);
      return null;
    }
    
    return engine;
    
  } catch (error) {
    console.error('Failed to create StyleTransferEngine:', error);
    return null;
  } finally {
    // Cleanup global reference
    delete window.__StyleTransferEngine;
  }
}

/**
 * Process image with CPU-based algorithms (standalone function)
 * @param {string} imageDataUrl - Image data URL
 * @param {string} styleName - Style name
 * @param {number} strength - Style strength (0-1)
 * @returns {Promise<string>} Processed image data URL
 */
async function processImageWithCPU(imageDataUrl, styleName, strength) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Use model metadata for resolution if available
        const model = registryModels?.find(m => m.name === styleName);
        const width = model?.input_width || 256;
        const height = model?.input_height || 256;
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Apply style-specific processing
        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % width;
          const y = Math.floor((i / 4) / width);
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
              
            case 'monet_water_lilies':
              const softLight = 0.05 * (1.0 + Math.sin((x + y) * 0.001));
              r = Math.min(255, r * 1.1 + softLight * 255);
              g = Math.min(255, g * 1.1 + softLight * 255);
              b = Math.min(255, b * 1.1 + softLight * 255);
              break;
              
            case 'anime_studio_ghibli':
              const quantized = Math.round(r * 6) / 6;
              const saturated = quantized > 0.5 ? Math.min(255, quantized * 1.3 * 255) : quantized * 0.9 * 255;
              r = saturated;
              g = Math.min(255, g * 1.2);
              b = Math.min(255, b * 1.1);
              break;
              
            default:
              // Default enhancement
              r = Math.min(255, r * 1.2);
              g = Math.min(255, g * 1.2);
              b = Math.min(255, b * 1.2);
              break;
          }
          
          // Apply proper blending with gamma correction for better visual results
          const strengthFactor = Math.max(0, Math.min(1, strength));
          const originalR = data[i] / 255;
          const originalG = data[i + 1] / 255;
          const originalB = data[i + 2] / 255;
          const styledR = r / 255;
          const styledG = g / 255;
          const styledB = b / 255;
          
          // Apply gamma correction for better visual blending
          const gamma = 2.2;
          const origR_gamma = Math.pow(originalR, gamma);
          const origG_gamma = Math.pow(originalG, gamma);
          const origB_gamma = Math.pow(originalB, gamma);
          const styledR_gamma = Math.pow(styledR, gamma);
          const styledG_gamma = Math.pow(styledG, gamma);
          const styledB_gamma = Math.pow(styledB, gamma);
          
          const blendR_gamma = origR_gamma * (1 - strengthFactor) + styledR_gamma * strengthFactor;
          const blendG_gamma = origG_gamma * (1 - strengthFactor) + styledG_gamma * strengthFactor;
          const blendB_gamma = origB_gamma * (1 - strengthFactor) + styledB_gamma * strengthFactor;
          
          const finalR = Math.pow(blendR_gamma, 1 / gamma) * 255;
          const finalG = Math.pow(blendG_gamma, 1 / gamma) * 255;
          const finalB = Math.pow(blendB_gamma, 1 / gamma) * 255;
          
          data[i] = Math.max(0, Math.min(255, Math.round(finalR)));
          data[i + 1] = Math.max(0, Math.min(255, Math.round(finalG)));
          data[i + 2] = Math.max(0, Math.min(255, Math.round(finalB)));
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Initialize WebGPU engine for hardware acceleration
 * @returns {Promise<void>}
 */
async function initializeWebGPU() {
  try {
    console.log('[WebGPU] Initializing WebGPU engine...');
    
    // Check if WASM engine has WebGPU ready
    if (wasmModule && wasmModule.is_webgpu_ready && wasmModule.is_webgpu_ready()) {
      console.log('[WebGPU] WASM engine has WebGPU ready, using integrated WebGPU');
      
      // Pre-load models for WebGPU (only if not already loaded)
      const models = await loadRegistryModels();
      for (const model of models) {
        if (!loadedModels.has(model.name)) {
          try {
            await wasmModule.load_model(model.name);
            loadedModels.add(model.name);
            console.log(`[WebGPU] Model loaded via WASM: ${model.name}`);
          } catch (error) {
            console.warn(`[WebGPU] Failed to load model ${model.name}:`, error);
          }
        }
      }
      
      // Mark WebGPU as available
      webgpuEngine = { 
        isReady: true, 
        device: wasmModule.get_webgpu_device(),
        adapter: wasmModule.get_webgpu_adapter()
      };
      
    } else {
      // Fallback to separate WebGPU engine
      console.log('[WebGPU] Using separate WebGPU engine...');
      const { createInferenceEngine } = await import('./webgpu-inference');
      webgpuEngine = await createInferenceEngine();
      
      if (webgpuEngine) {
        console.log('[WebGPU] WebGPU engine initialized successfully');
        
        // Pre-load models for WebGPU (only if not already loaded)
        const models = await loadRegistryModels();
        for (const model of models) {
          if (!loadedModels.has(model.name)) {
            try {
              await webgpuEngine.loadModel(model.model_url);
              loadedModels.add(model.name);
              console.log(`[WebGPU] Model loaded: ${model.name}`);
            } catch (error) {
              console.warn(`[WebGPU] Failed to load model ${model.name}:`, error);
            }
          }
        }
      } else {
        console.log('[WebGPU] WebGPU not available, using CPU fallback');
      }
    }
  } catch (error) {
    console.warn('[WebGPU] WebGPU initialization failed:', error);
    webgpuEngine = null;
  }
}

/**
 * Create mock engine for fallback CPU processing
 * @returns {Object} Mock engine with same interface
 */
async function createMockEngine() {
  console.log('Creating mock WASM engine for CPU fallback');
  
  // Load models from registry.json for the mock engine
  const mockModels = await loadRegistryModels();
  console.log('[Mock Engine] Loaded', mockModels.length, 'models from registry');
  
  
  return {
    initialize: async function() {
      console.log('Mock WASM engine initialized');
      return Promise.resolve();
    },
    
    get_models: function() {
      console.log('[Mock Engine] get_models() called, returning', mockModels.length, 'models');
      return mockModels;
    },
    
    process_image: async function(imageDataUrl, styleName, strength) {
      console.log('[Mock Engine] process_image called with style:', styleName);
      
      try {
        // Provide real CPU-based image processing instead of throwing error
        return await processImageWithCPU(imageDataUrl, styleName, strength);
      } catch (error) {
        console.error('[Mock Engine] CPU processing failed:', error);
        throw new Error(`CPU processing failed: ${error.message}`);
      }
    },
    
    // Additional methods that might be expected
    destroy: function() {
      console.log('Mock engine destroyed');
    },
    
    is_initialized: function() {
      return true;
    }
  };
}

/**
 * Reset the WASM module (useful for development/testing)
 */
export function resetWasmModule() {
  console.log('Resetting WASM module...');
  wasmModule = null;
  registryModels = null;
  isLoading = false;
  loadPromise = null;
  
  // Clean up any global references
  if (typeof window !== 'undefined') {
    delete window.__wasmInit;
    delete window.__StyleTransferEngine;
    delete window.__wasmCodeExecuted;
    delete window.__wasmError;
  }
}

/**
 * Get current WASM module without loading
 * @returns {Object|null} Current module or null
 */
export function getWasmModule() {
  return wasmModule;
}

/**
 * Check if WASM module is loaded
 * @returns {boolean} True if loaded
 */
export function isWasmLoaded() {
  return wasmModule !== null && typeof wasmModule.process_image === 'function';
}

/**
 * Get WebGPU engine if available
 * @returns {Object|null} WebGPU engine or null
 */
export function getWebGPUEngine() {
  return webgpuEngine;
}

/**
 * Check if WebGPU is available
 * @returns {boolean} True if WebGPU is available
 */
export function isWebGPUAvailable() {
  // Check if we have a WebGPU engine available
  if (webgpuEngine && webgpuEngine.isReady) {
    return true;
  }
  
  // Check if WASM engine has WebGPU ready
  if (wasmModule && wasmModule.is_webgpu_ready && wasmModule.is_webgpu_ready()) {
    return true;
  }
  
  return false;
}

/**
 * Clean up resources to prevent memory leaks
 * @returns {void}
 */
export function cleanup() {
  console.log('[Cleanup] Cleaning up resources...');
  
  // Clear loaded models tracking
  loadedModels.clear();
  
  // Clean up WebGPU engine
  if (webgpuEngine && webgpuEngine.destroy) {
    webgpuEngine.destroy();
  }
  webgpuEngine = null;
  
  // Clean up WASM module
  if (wasmModule && wasmModule.destroy) {
    wasmModule.destroy();
  }
  wasmModule = null;
  
  // Reset loading state
  isLoading = false;
  loadPromise = null;
  
  console.log('[Cleanup] Resources cleaned up');
}

/**
 * Unload a specific model to free memory
 * @param {string} modelName - Name of the model to unload
 * @returns {Promise<void>}
 */
export async function unloadModel(modelName) {
  try {
    console.log(`[Memory] Unloading model: ${modelName}`);
    
    // Remove from tracking
    loadedModels.delete(modelName);
    
    // Unload from WASM engine if available
    if (wasmModule && wasmModule.unload_model) {
      await wasmModule.unload_model(modelName);
    }
    
    // Unload from WebGPU engine if available
    if (webgpuEngine && webgpuEngine.unloadModel) {
      await webgpuEngine.unloadModel(modelName);
    }
    
    // Force garbage collection hint
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
    
    console.log(`[Memory] Model unloaded: ${modelName}`);
  } catch (error) {
    console.warn(`[Memory] Failed to unload model ${modelName}:`, error);
  }
}

/**
 * Unload all models to free memory
 * @returns {Promise<void>}
 */
export async function unloadAllModels() {
  try {
    console.log('[Memory] Unloading all models...');
    
    // Clear tracking
    loadedModels.clear();
    
    // Unload from WASM engine if available
    if (wasmModule && wasmModule.unload_all_models) {
      await wasmModule.unload_all_models();
    }
    
    // Unload from WebGPU engine if available
    if (webgpuEngine && webgpuEngine.unloadAllModels) {
      await webgpuEngine.unloadAllModels();
    }
    
    console.log('[Memory] All models unloaded');
  } catch (error) {
    console.warn('[Memory] Failed to unload all models:', error);
  }
}

/**
 * Get currently loaded models
 * @returns {Array<string>} Array of loaded model names
 */
export function getLoadedModels() {
  return Array.from(loadedModels);
}

/**
 * Get memory usage information
 * @returns {Object} Memory usage stats
 */
export function getMemoryStats() {
  const stats = {
    loadedModels: Array.from(loadedModels),
    modelCount: loadedModels.size,
    wasmLoaded: !!wasmModule,
    webgpuLoaded: !!webgpuEngine,
    isLoading: isLoading
  };
  
  // Add performance memory info if available
  if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
    stats.memoryUsage = {
      used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
      total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
      limit: Math.round(window.performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
    };
  }
  
  return stats;
}

/**
 * Process image with the best available engine (WebGPU > WASM > CPU)
 * @param {string} imageDataUrl - Image data URL
 * @param {string} styleName - Style name
 * @param {number} strength - Style strength (0-1)
 * @returns {Promise<string>} Processed image data URL
 */
export async function processImageWithBestEngine(imageDataUrl, styleName, strength) {
  // Try WebGPU first if available
  if (isWebGPUAvailable()) {
    try {
      console.log('[Engine] Using WebGPU acceleration');
      
      // If WASM engine has WebGPU ready, use it directly
      if (wasmModule && wasmModule.is_webgpu_ready && wasmModule.is_webgpu_ready()) {
        console.log('[WebGPU] Using WASM-integrated WebGPU');
        return await wasmModule.process_image(imageDataUrl, styleName, strength);
      }
      
      // Otherwise use separate WebGPU engine
      if (webgpuEngine && webgpuEngine.processImage) {
        console.log('[WebGPU] Using separate WebGPU engine');
        
        // Convert data URL to ImageData
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve, reject) => {
          img.onload = async () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const processedImageData = await webgpuEngine.processImage(imageData, strength);
              
              // Convert back to data URL
              const resultCanvas = document.createElement('canvas');
              const resultCtx = resultCanvas.getContext('2d');
              resultCanvas.width = processedImageData.width;
              resultCanvas.height = processedImageData.height;
              resultCtx.putImageData(processedImageData, 0, 0);
              
              resolve(resultCanvas.toDataURL('image/png'));
            } catch (error) {
              console.warn('[WebGPU] Processing failed, falling back to WASM:', error);
              // Fall back to WASM
              if (wasmModule) {
                resolve(await wasmModule.process_image(imageDataUrl, styleName, strength));
              } else {
                reject(error);
              }
            }
          };
          
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = imageDataUrl;
        });
      }
    } catch (error) {
      console.warn('[WebGPU] WebGPU processing failed, falling back to WASM:', error);
    }
  }
  
  // Try WASM if available
  if (wasmModule) {
    try {
      console.log('[Engine] Using WebAssembly processing');
      return await wasmModule.process_image(imageDataUrl, styleName, strength);
    } catch (error) {
      console.warn('[WASM] WASM processing failed, falling back to CPU:', error);
    }
  }
  
  // Fall back to CPU processing
  console.log('[Engine] Using CPU fallback processing');
  return await processImageWithCPU(imageDataUrl, styleName, strength);
}