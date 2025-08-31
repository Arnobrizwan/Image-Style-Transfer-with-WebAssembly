// WebGPU type definitions
declare global {
  interface Navigator {
    gpu?: GPU;
  }

  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  }

  interface GPURequestAdapterOptions {
    powerPreference?: 'low-power' | 'high-performance';
    forceFallbackAdapter?: boolean;
  }

  interface GPUAdapter {
    name: string;
    features: GPUSupportedFeatures;
    limits: GPUSupportedLimits;
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
  }

  interface GPUDeviceDescriptor {
    label?: string;
    requiredFeatures?: string[];
    requiredLimits?: Record<string, number>;
  }

  interface GPUDevice {
    features: GPUSupportedFeatures;
    limits: GPUSupportedLimits;
    queue: GPUQueue;
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
  }

  interface GPUBufferDescriptor {
    size: number;
    usage: GPUBufferUsageFlags;
    mappedAtCreation?: boolean;
    label?: string;
  }

  interface GPUShaderModuleDescriptor {
    code: string;
    label?: string;
  }

  interface GPUComputePipelineDescriptor {
    layout?: 'auto' | GPUPipelineLayout;
    compute: {
      module: GPUShaderModule;
      entryPoint: string;
    };
    label?: string;
  }

  interface GPUBindGroupDescriptor {
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
    label?: string;
  }

  interface GPUBindGroupEntry {
    binding: number;
    resource: GPUBindingResource;
  }

  type GPUBindingResource = GPUSampler | GPUTextureView | GPUBufferBinding;

  interface GPUBufferBinding {
    buffer: GPUBuffer;
    offset?: number;
    size?: number;
  }

  interface GPUCommandEncoderDescriptor {
    label?: string;
  }

  interface GPUBuffer {
    size: number;
    usage: GPUBufferUsageFlags;
    mapAsync(mode: GPUMapModeFlags): Promise<void>;
    getMappedRange(): ArrayBuffer;
    unmap(): void;
    destroy(): void;
  }

  interface GPUShaderModule {
    compilationInfo(): Promise<GPUCompilationInfo>;
  }

  interface GPUComputePipeline {
    getBindGroupLayout(index: number): GPUBindGroupLayout;
  }

  interface GPUBindGroup {
    // Bind group interface
  }

  interface GPUBindGroupLayout {
    // Bind group layout interface
  }

  interface GPUPipelineLayout {
    // Pipeline layout interface
  }

  interface GPUQueue {
    submit(commands: GPUCommandBuffer[]): void;
    writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource): void;
  }

  interface GPUCommandEncoder {
    beginComputePass(descriptor?: GPUComputePassDescriptor): GPUComputePassEncoder;
    copyBufferToBuffer(
      source: GPUBuffer,
      sourceOffset: number,
      destination: GPUBuffer,
      destinationOffset: number,
      size: number
    ): void;
    finish(): GPUCommandBuffer;
  }

  interface GPUComputePassDescriptor {
    label?: string;
  }

  interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup): void;
    dispatchWorkgroups(x: number, y?: number, z?: number): void;
    end(): void;
  }

  interface GPUCommandBuffer {
    // Command buffer interface
  }

  interface GPUCompilationInfo {
    messages: GPUCompilationMessage[];
  }

  interface GPUCompilationMessage {
    message: string;
    type: 'error' | 'warning' | 'info';
    lineNum: number;
    linePos: number;
  }

  interface GPUSupportedFeatures {
    has(feature: string): boolean;
    keys(): IterableIterator<string>;
  }

  interface GPUSupportedLimits {
    maxBufferSize: number;
    maxStorageBufferBindingSize: number;
    maxBufferCopySize: number;
    maxUniformBufferBindingSize: number;
    maxStorageBufferBindingSize: number;
    maxTextureDimension1D: number;
    maxTextureDimension2D: number;
    maxTextureDimension3D: number;
    maxTextureArrayLayers: number;
    maxBindGroups: number;
    maxBindGroupsPlusVertexBuffers: number;
    maxBindingsPerBindGroup: number;
    maxDynamicUniformBuffersPerPipelineLayout: number;
    maxDynamicStorageBuffersPerPipelineLayout: number;
    maxSampledTexturesPerShaderStage: number;
    maxSamplersPerShaderStage: number;
    maxStorageBuffersPerShaderStage: number;
    maxStorageTexturesPerShaderStage: number;
    maxUniformBuffersPerShaderStage: number;
    maxUniformBufferBindingSize: number;
    maxVertexBuffers: number;
    maxBufferSize: number;
    maxVertexAttributes: number;
    maxVertexBufferArrayStride: number;
    maxInterStageShaderComponents: number;
    maxInterStageShaderVariables: number;
    maxColorAttachments: number;
    maxColorAttachmentBytesPerSample: number;
    maxComputeWorkgroupStorageSize: number;
    maxComputeInvocationsPerWorkgroup: number;
    maxComputeWorkgroupSizeX: number;
    maxComputeWorkgroupSizeY: number;
    maxComputeWorkgroupSizeZ: number;
    maxComputeWorkgroupsPerDimension: number;
  }

  interface GPUCanvasContext {
    configure(configuration: GPUCanvasConfiguration): void;
    getCurrentTexture(): GPUTexture;
  }

  interface GPUCanvasConfiguration {
    device: GPUDevice;
    format: GPUTextureFormat;
    usage?: GPUTextureUsageFlags;
    alphaMode?: GPUCanvasAlphaMode;
  }

  interface GPUTexture {
    width: number;
    height: number;
    depthOrArrayLayers: number;
    mipLevelCount: number;
    sampleCount: number;
    dimension: GPUTextureDimension;
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
    createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
    destroy(): void;
  }

  interface GPUTextureView {
    // Texture view interface
  }

  interface GPUTextureViewDescriptor {
    format?: GPUTextureFormat;
    dimension?: GPUTextureViewDimension;
    aspect?: GPUTextureAspect;
    baseMipLevel?: number;
    mipLevelCount?: number;
    baseArrayLayer?: number;
    arrayLayerCount?: number;
  }

  interface GPUSampler {
    // Sampler interface
  }

  type GPUTextureFormat = string;
  type GPUTextureUsageFlags = number;
  type GPUCanvasAlphaMode = 'opaque' | 'premultiplied';
  type GPUTextureDimension = '1d' | '2d' | '3d';
  type GPUTextureViewDimension = '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
  type GPUTextureAspect = 'all' | 'stencil-only' | 'depth-only';

  type GPUBufferUsageFlags = number;
  type GPUMapModeFlags = number;

  const GPUBufferUsage: {
    MAP_READ: number;
    MAP_WRITE: number;
    COPY_SRC: number;
    COPY_DST: number;
    INDEX: number;
    VERTEX: number;
    UNIFORM: number;
    STORAGE: number;
    INDIRECT: number;
    QUERY_RESOLVE: number;
  };

  const GPUMapMode: {
    READ: number;
    WRITE: number;
  };

  const GPUShaderStage: {
    VERTEX: number;
    FRAGMENT: number;
    COMPUTE: number;
  };
}

export {};
