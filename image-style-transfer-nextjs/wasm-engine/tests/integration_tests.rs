#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_engine_creation() {
        let engine = StyleTransferEngine::new();
        assert_eq!(engine.styles.len(), 3);
    }

    #[wasm_bindgen_test]
    fn test_image_blending() {
        let engine = StyleTransferEngine::new();
        let original = vec![0.0f32, 0.5f32, 1.0f32];
        let stylized = vec![1.0f32, 0.5f32, 0.0f32];
        let blended = engine.blend_images(&original, &stylized, 0.5);
        
        assert_eq!(blended.len(), 3);
        assert!((blended[0] - 0.5).abs() < 0.001);
    }
}
