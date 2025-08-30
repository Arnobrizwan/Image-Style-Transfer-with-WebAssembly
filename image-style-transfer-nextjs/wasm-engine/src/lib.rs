use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
    
    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct StyleMetadata {
    pub name: String,
    pub size_mb: f32,
    pub input_width: u32,
    pub input_height: u32,
    pub model_url: String,
    pub description: String,
}

#[wasm_bindgen]
pub struct StyleTransferEngine {
    styles: Vec<StyleMetadata>,
}

#[wasm_bindgen]
impl StyleTransferEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> StyleTransferEngine {
        console_log!("Initializing Style Transfer Engine");
        
        let styles = vec![
            StyleMetadata {
                name: "Van Gogh - Starry Night".to_string(),
                size_mb: 2.4,
                input_width: 256,
                input_height: 256,
                model_url: "/models/starry_night.onnx".to_string(),
                description: "Transform with Van Gogh's swirling brushstrokes".to_string(),
            },
            StyleMetadata {
                name: "Picasso - Cubist".to_string(),
                size_mb: 2.1,
                input_width: 256,
                input_height: 256,
                model_url: "/models/picasso_cubist.onnx".to_string(),
                description: "Geometric abstraction in Picasso's style".to_string(),
            },
            StyleMetadata {
                name: "Cyberpunk Neon".to_string(),
                size_mb: 2.8,
                input_width: 256,
                input_height: 256,
                model_url: "/models/cyberpunk_neon.onnx".to_string(),
                description: "Futuristic neon-lit digital enhancement".to_string(),
            },
            StyleMetadata {
                name: "Monet Impressionist".to_string(),
                size_mb: 2.2,
                input_width: 256,
                input_height: 256,
                model_url: "/models/monet_impressionist.onnx".to_string(),
                description: "Soft, dreamy impressionist style".to_string(),
            },
            StyleMetadata {
                name: "Anime Style".to_string(),
                size_mb: 2.0,
                input_width: 256,
                input_height: 256,
                model_url: "/models/anime_style.onnx".to_string(),
                description: "Colorful anime-inspired artistic style".to_string(),
            },
        ];
        
        StyleTransferEngine {
            styles,
        }
    }

    #[wasm_bindgen]
    pub fn get_styles(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.styles).unwrap()
    }

    #[wasm_bindgen]
    pub fn preprocess_image(&self, image_data: &[u8], target_width: u32, target_height: u32) -> Result<Vec<f32>, JsValue> {
        let img = image::load_from_memory(image_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to load image: {}", e)))?;
        
        let img = img.resize(target_width, target_height, image::imageops::FilterType::Lanczos3);
        let img = img.to_rgb8();
        
        let mut tensor = Vec::with_capacity((target_width * target_height * 3) as usize);
        
        for pixel in img.pixels() {
            tensor.push(pixel[0] as f32 / 255.0);
            tensor.push(pixel[1] as f32 / 255.0);
            tensor.push(pixel[2] as f32 / 255.0);
        }
        
        Ok(tensor)
    }

    #[wasm_bindgen]
    pub async fn run_inference(&self, style_name: &str, input_tensor: &[f32]) -> Result<Vec<f32>, JsValue> {
        console_log!("Running inference for style: {}", style_name);
        
        // Simulate style transfer processing
        let mut output_tensor = Vec::with_capacity(input_tensor.len());
        
        for i in 0..input_tensor.len() {
            let enhanced_value = match style_name {
                "Van Gogh - Starry Night" => {
                    let base = input_tensor[i];
                    (base * 1.2 + (i as f32 * 0.001).sin() * 0.1).clamp(0.0, 1.0)
                },
                "Picasso - Cubist" => {
                    let base = input_tensor[i];
                    if (i / 3) % 16 < 8 { base * 0.8 } else { base * 1.3 }
                },
                "Cyberpunk Neon" => {
                    let base = input_tensor[i];
                    let channel = i % 3;
                    if (channel == 2) { base * 1.4 } else { base * 0.9 }
                },
                "Monet Impressionist" => {
                    let base = input_tensor[i];
                    (base * 0.9 + (i as f32 * 0.002).cos() * 0.15).clamp(0.0, 1.0)
                },
                "Anime Style" => {
                    let base = input_tensor[i];
                    let channel = i % 3;
                    if (channel == 0) { base * 1.1 } else if (channel == 1) { base * 0.95 } else { base * 1.05 }
                },
                _ => input_tensor[i],
            };
            output_tensor.push(enhanced_value);
        }
        
        // Simulate processing delay
        let delay = js_sys::Promise::new(&mut |resolve, _| {
            web_sys::window()
                .unwrap()
                .set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, 200)
                .unwrap();
        });
        wasm_bindgen_futures::JsFuture::from(delay).await?;
        
        Ok(output_tensor)
    }

    #[wasm_bindgen]
    pub fn postprocess_image(&self, output_tensor: &[f32], width: u32, height: u32) -> Result<Vec<u8>, JsValue> {
        let mut image_data = Vec::with_capacity((width * height * 4) as usize);
        
        for i in 0..(width * height) as usize {
            let r = (output_tensor[i * 3] * 255.0).clamp(0.0, 255.0) as u8;
            let g = (output_tensor[i * 3 + 1] * 255.0).clamp(0.0, 255.0) as u8;
            let b = (output_tensor[i * 3 + 2] * 255.0).clamp(0.0, 255.0) as u8;
            let a = 255u8;
            
            image_data.extend_from_slice(&[r, g, b, a]);
        }
        
        Ok(image_data)
    }

    #[wasm_bindgen]
    pub fn blend_images(&self, original: &[f32], stylized: &[f32], strength: f32) -> Vec<f32> {
        let blend_factor = strength.clamp(0.0, 1.0);
        original.iter().zip(stylized.iter())
            .map(|(orig, style)| orig * (1.0 - blend_factor) + style * blend_factor)
            .collect()
    }
}
