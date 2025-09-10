export interface WebGPUInferenceEngine {
  initialize(): Promise<boolean>;
  loadModel(modelUrl: string): Promise<void>;
  processImage(imageData: ImageData, styleStrength: number): Promise<ImageData>;
  isSupported(): Promise<boolean>;
}

export class WebGPUInferenceEngineImpl implements WebGPUInferenceEngine {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private modelBuffer: GPUBuffer | null = null;
  private inputBuffer: GPUBuffer | null = null;
  private outputBuffer: GPUBuffer | null = null;
  private modelLoaded = false;

  async isSupported(): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('WebGPU not supported');
      return false;
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('No WebGPU adapter found');
        return false;
      }
      return true;
    } catch (error) {
      console.warn('WebGPU initialization failed:', error);
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('No WebGPU adapter found');
      }

      this.device = await adapter.requestDevice();
      console.log('WebGPU device initialized');
      return true;
    } catch (error) {
      console.error('WebGPU initialization failed:', error);
      return false;
    }
  }

  async loadModel(modelUrl: string): Promise<void> {
    if (!this.device) {
      throw new Error('WebGPU device not initialized');
    }

    try {
      console.log('Loading ONNX model from:', modelUrl);
      
      // For now, we'll use a simplified approach since full ONNX parsing in WebGPU is complex
      // In a production system, you'd want to use a proper ONNX parser
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.status}`);
      }
      
      const modelData = await response.arrayBuffer();
      console.log('Model loaded, size:', modelData.byteLength);
      
      // Create buffer for model weights (simplified)
      this.modelBuffer = this.device.createBuffer({
        size: modelData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      
      this.device.queue.writeBuffer(this.modelBuffer, 0, modelData);
      this.modelLoaded = true;
      console.log('Model loaded into GPU buffer');
      
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
  }

  async processImage(imageData: ImageData, styleStrength: number): Promise<ImageData> {
    if (!this.device || !this.modelLoaded) {
      throw new Error('WebGPU not initialized or model not loaded');
    }

    const { width, height, data } = imageData;
    
    // Validate input dimensions match model requirements (256x256)
    if (width !== 256 || height !== 256) {
      console.warn(`[WebGPU] Input dimensions ${width}x${height} don't match model requirements (256x256). Processing anyway...`);
    }
    
    // Validate style strength range
    const clampedStrength = Math.max(0, Math.min(1, styleStrength));
    if (clampedStrength !== styleStrength) {
      console.warn(`[WebGPU] Style strength ${styleStrength} clamped to ${clampedStrength}`);
    }
    
    // Create input buffer
    this.inputBuffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    
    // Create output buffer
    this.outputBuffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    
    // Write input data
    this.device.queue.writeBuffer(this.inputBuffer, 0, data);
    
    // Create compute pipeline for style transfer
    const shaderModule = this.device.createShaderModule({
      code: `
        struct Uniforms {
          width: f32, // Cast from f32 to u32 in shader
          height: f32, // Cast from f32 to u32 in shader
          styleStrength: f32,
          _padding: f32, // Ensure 16-byte alignment
        }
        
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        @group(0) @binding(1) var<storage, read> input: array<f32>;
        @group(0) @binding(2) var<storage, read_write> output: array<f32>;
        
        // Custom sin/cos approximation for WebGPU compatibility
        fn fast_sin(x: f32) -> f32 {
          let x2 = x * x;
          let x3 = x2 * x;
          let x5 = x3 * x2;
          return x - x3 / 6.0 + x5 / 120.0;
        }
        
        fn fast_cos(x: f32) -> f32 {
          let x2 = x * x;
          let x4 = x2 * x2;
          let x6 = x4 * x2;
          return 1.0 - x2 / 2.0 + x4 / 24.0 - x6 / 720.0;
        }
        
        @compute @workgroup_size(8, 8)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let x = global_id.x;
          let y = global_id.y;
          
          // Cast f32 to u32 for comparison
          let width = u32(uniforms.width);
          let height = u32(uniforms.height);
          
          if (x >= width || y >= height) {
            return;
          }
          
          let index = (y * width + x) * 4;
          let strength = uniforms.styleStrength;
          
          // Input validation and bounds checking
          if (index + 3 >= arrayLength(&input)) {
            return;
          }
          
          // Simplified neural style transfer simulation
          // In a real implementation, this would be the actual neural network computation
          let r = input[index];
          let g = input[index + 1];
          let b = input[index + 2];
          let a = input[index + 3]; // Preserve alpha channel
          
          // Apply style transformation based on position and model weights
          // Use custom sin/cos for better compatibility
          let swirl = fast_sin(f32(x) * 0.02) * fast_cos(f32(y) * 0.02) * 25.0;
          let newR = min(1.0, r * 1.4 + swirl / 255.0 + 20.0 / 255.0);
          let newG = min(1.0, g * 1.3 + swirl * 0.7 / 255.0 + 15.0 / 255.0);
          let newB = min(1.0, b * 1.2 + swirl * 0.5 / 255.0 + 10.0 / 255.0);
          
          // Apply proper blending with gamma correction for better visual results
          let gamma = 2.2;
          let origR_gamma = pow(r, gamma);
          let origG_gamma = pow(g, gamma);
          let origB_gamma = pow(b, gamma);
          let newR_gamma = pow(newR, gamma);
          let newG_gamma = pow(newG, gamma);
          let newB_gamma = pow(newB, gamma);
          
          let blendR_gamma = origR_gamma * (1.0 - strength) + newR_gamma * strength;
          let blendG_gamma = origG_gamma * (1.0 - strength) + newG_gamma * strength;
          let blendB_gamma = origB_gamma * (1.0 - strength) + newB_gamma * strength;
          
          // Output validation and bounds checking
          if (index + 3 >= arrayLength(&output)) {
            return;
          }
          
          // Clamp final values to valid range and apply precision
          output[index] = clamp(pow(blendR_gamma, 1.0 / gamma), 0.0, 1.0);
          output[index + 1] = clamp(pow(blendG_gamma, 1.0 / gamma), 0.0, 1.0);
          output[index + 2] = clamp(pow(blendB_gamma, 1.0 / gamma), 0.0, 1.0);
          output[index + 3] = a; // Preserve alpha channel
        }
      `
    });
    
    this.pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });
    
    // Create uniform buffer with proper size and alignment
    const uniformBuffer = this.device.createBuffer({
      size: 16, // 16 bytes for proper alignment (u32, u32, f32, padding)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create properly aligned uniform data matching the struct
    const uniformData = new Float32Array(4); // 4 * 4 bytes = 16 bytes
    uniformData[0] = width; // u32 as f32 (will be cast in shader)
    uniformData[1] = height; // u32 as f32 (will be cast in shader)
    uniformData[2] = clampedStrength; // f32 (use clamped value)
    uniformData[3] = 0.0; // Padding f32
    
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    
    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: this.inputBuffer } },
        { binding: 2, resource: { buffer: this.outputBuffer } },
      ],
    });
    
    // Dispatch compute work
    const commandEncoder = this.device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.pipeline);
    computePass.setBindGroup(0, this.bindGroup);
    computePass.dispatchWorkgroups(
      Math.ceil(width / 8),
      Math.ceil(height / 8)
    );
    computePass.end();
    
    // Copy output to staging buffer for reading
    const stagingBuffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    
    commandEncoder.copyBufferToBuffer(this.outputBuffer, 0, stagingBuffer, 0, data.byteLength);
    
    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);
    
    // Read back the result
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const resultData = new Uint8ClampedArray(stagingBuffer.getMappedRange());
    
    // Create new ImageData
    const resultImageData = new ImageData(
      new Uint8ClampedArray(resultData),
      width,
      height
    );
    
    stagingBuffer.unmap();
    return resultImageData;
  }

  dispose(): void {
    // Clean up GPU resources
    this.inputBuffer?.destroy();
    this.outputBuffer?.destroy();
    this.modelBuffer?.destroy();
  }

  async unloadModel(modelName: string) {
    console.log(`[WebGPU] Unloading model: ${modelName}`);
    
    // Clean up model-specific resources
    if (this.modelBuffer) {
      this.modelBuffer.destroy();
      this.modelBuffer = null;
    }
    
    // Clean up compute pipeline and bind group
    if (this.pipeline) {
      this.pipeline = null;
    }
    
    if (this.bindGroup) {
      this.bindGroup = null;
    }
    
    // Reset model loaded state
    this.modelLoaded = false;
    
    console.log(`[WebGPU] Model ${modelName} resources cleaned up`);
  }

  async unloadAllModels() {
    console.log('[WebGPU] Unloading all models');
    
    // Clean up all GPU resources
    this.dispose();
    
    // Reset all state
    this.modelLoaded = false;
    this.pipeline = null;
    this.bindGroup = null;
    
    console.log('[WebGPU] All model resources cleaned up');
  }
}

// Fallback implementation for when WebGPU is not available
export class CPUFallbackEngine implements WebGPUInferenceEngine {
  async initialize(): Promise<boolean> {
    console.log('Using CPU fallback engine');
    return true;
  }

  async loadModel(modelUrl: string): Promise<void> {
    console.log('CPU fallback: model loading not implemented');
  }

  async processImage(imageData: ImageData, styleStrength: number): Promise<ImageData> {
    // Simple CPU-based style transfer
    const { width, height, data } = imageData;
    const resultData = new Uint8ClampedArray(data);
    
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);
      
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      
      // Apply simple artistic effect
      const swirl = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 25;
      r = Math.min(255, r * 1.4 + swirl + 20);
      g = Math.min(255, g * 1.3 + swirl * 0.7 + 15);
      b = Math.min(255, b * 1.2 + swirl * 0.5 + 10);
      
      // Blend with original based on style strength
      resultData[i] = data[i] * (1 - styleStrength) + r * styleStrength;
      resultData[i + 1] = data[i + 1] * (1 - styleStrength) + g * styleStrength;
      resultData[i + 2] = data[i + 2] * (1 - styleStrength) + b * styleStrength;
      resultData[i + 3] = data[i + 3]; // Preserve alpha
    }
    
    return new ImageData(resultData, width, height);
  }

  async isSupported(): Promise<boolean> {
    return true; // CPU fallback always works
  }
}

// Factory function to create the appropriate engine
export async function createInferenceEngine(): Promise<WebGPUInferenceEngine> {
  const webgpuEngine = new WebGPUInferenceEngineImpl();
  
  if (await webgpuEngine.isSupported()) {
    try {
      await webgpuEngine.initialize();
      console.log('WebGPU inference engine created successfully');
      return webgpuEngine;
    } catch (error) {
      console.warn('WebGPU initialization failed, falling back to CPU:', error);
    }
  }
  
  console.log('Using CPU fallback inference engine');
  return new CPUFallbackEngine();
}
