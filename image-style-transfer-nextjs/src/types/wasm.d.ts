declare module '*/style_transfer_wasm.js' {
  export class StyleTransferEngine {
    free(): void;
    constructor();
    initialize(): Promise<void>;
    get_models(): any;
    load_model(model_name: string): Promise<void>;
    process_image(image_data_url: string, style_name: string, strength: number): Promise<string>;
    get_stats(): any;
  }

  export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

  export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_styletransferengine_free: (a: number, b: number) => void;
    readonly styletransferengine_new: () => number;
    readonly styletransferengine_initialize: (a: number) => any;
    readonly styletransferengine_get_models: (a: number) => any;
    readonly styletransferengine_load_model: (a: number, b: number, c: number) => any;
    readonly styletransferengine_process_image: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly styletransferengine_get_stats: (a: number) => any;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_export_2: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export_5: WebAssembly.Table;
    readonly _dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hd96dc2c83925f787: (a: number, b: number) => void;
    readonly closure35_externref_shim: (a: number, b: number, c: any) => void;
    readonly closure26_externref_shim: (a: number, b: number, c: any, d: any) => void;
    readonly __wbindgen_start: () => void;
  }

  export type SyncInitInput = BufferSource | WebAssembly.Module;
  
  export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;
  
  export default function __wbg_init(module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
}

// Also declare the public path version
declare module '/wasm/style_transfer_wasm.js' {
  export * from '*/style_transfer_wasm.js';
}

// Declare the relative path version
declare module '../lib/wasm/style_transfer_wasm.js' {
  export * from '*/style_transfer_wasm.js';
}
