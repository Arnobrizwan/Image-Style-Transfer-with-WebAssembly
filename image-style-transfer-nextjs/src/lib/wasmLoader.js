let wasmModule = null;
let isLoading = false;
let loadPromise = null;
let registryModels = null;

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
    await initFunction('/wasm/style_transfer_wasm_bg.wasm');
    console.log('WASM binary initialized successfully');
    
    // Step 5: Create and initialize the StyleTransferEngine
    const engine = await createStyleEngine();
    if (engine) {
      wasmModule = engine;
      console.log('WebAssembly StyleTransferEngine created successfully');
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
 * Check if WASM files exist and are accessible
 * @returns {Promise<boolean>} True if files exist
 */
async function checkWasmFiles() {
  try {
    const jsResponse = await fetch('/wasm/style_transfer_wasm.js', { method: 'HEAD' });
    const wasmResponse = await fetch('/wasm/style_transfer_wasm_bg.wasm', { method: 'HEAD' });
    
    const jsExists = jsResponse.ok;
    const wasmExists = wasmResponse.ok;
    
    console.log(`WASM files check: JS=${jsExists}, WASM=${wasmExists}`);
    
    if (!jsExists) {
      console.error('WASM JavaScript file not found at /wasm/style_transfer_wasm.js');
    }
    if (!wasmExists) {
      console.error('WASM binary file not found at /wasm/style_transfer_wasm_bg.wasm');
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
  return new Promise((resolve, reject) => {
    try {
      console.log('Executing WASM JavaScript code...');
      
      // Create script element with module type to handle ES6 exports
      const script = document.createElement('script');
      script.type = 'module';
      
      // Wrap the code to capture exports and handle ES6 modules
      const wrappedCode = `
        try {
          // Import the WASM module dynamically
          const wasmModule = await import('data:text/javascript;base64,${btoa(jsCode)}');
          
          // Capture the init function and StyleTransferEngine from the module
          window.__wasmInit = wasmModule.init || wasmModule.wasm_bindgen || null;
          window.__StyleTransferEngine = wasmModule.StyleTransferEngine || null;
          
          // Signal completion
          window.__wasmCodeExecuted = true;
        } catch (error) {
          console.error('Error in WASM code execution:', error);
          window.__wasmError = error;
        }
      `;
      
      script.textContent = wrappedCode;
      
      // Handle script loading
      script.onload = () => {
        try {
          if (window.__wasmError) {
            reject(new Error(`WASM code execution error: ${window.__wasmError.message}`));
            return;
          }
          
          if (!window.__wasmCodeExecuted) {
            reject(new Error('WASM code did not execute properly'));
            return;
          }
          
          const initFunc = window.__wasmInit;
          if (typeof initFunc !== 'function') {
            reject(new Error('WASM init function not found or not a function'));
            return;
          }
          
          console.log('WASM JavaScript executed successfully');
          resolve(initFunc);
          
        } catch (error) {
          reject(error);
        } finally {
          // Cleanup
          document.head.removeChild(script);
          delete window.__wasmInit;
          delete window.__wasmCodeExecuted;
          delete window.__wasmError;
        }
      };
      
      script.onerror = (error) => {
        document.head.removeChild(script);
        reject(new Error(`Script execution failed: ${error.message || 'Unknown error'}`));
      };
      
      // Add script to DOM to execute
      document.head.appendChild(script);
      
    } catch (error) {
      console.error('Failed to execute WASM code:', error);
      reject(error);
    }
  });
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
 * Create mock engine for fallback CPU processing
 * @returns {Object} Mock engine with same interface
 */
async function createMockEngine() {
  console.log('Creating mock WASM engine for CPU fallback');
  
  // Load models from registry.json for the mock engine
  const models = await loadRegistryModels();
  console.log('[Mock Engine] Loaded', models.length, 'models from registry');
  
  return {
    initialize: async function() {
      console.log('Mock WASM engine initialized');
      return Promise.resolve();
    },
    
    get_models: function() {
      console.log('[Mock Engine] get_models() called, returning', models.length, 'models');
      return models;
    },
    
    process_image: async function(imageDataUrl, styleName, strength) {
      // Always throw error to trigger CPU fallback processing
      console.log('[Mock Engine] process_image called with style:', styleName);
      throw new Error('Mock engine - using CPU fallback processing');
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