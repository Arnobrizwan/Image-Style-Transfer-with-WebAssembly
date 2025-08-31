#!/usr/bin/env python3
"""
Generate basic ONNX models for style transfer
These are simplified models that demonstrate the pipeline
"""

import onnx
import numpy as np
from onnx import helper, numpy_helper, shape_inference
import os

def create_style_transfer_model(style_name, output_path):
    """Create a basic style transfer ONNX model"""
    
    # Input: [batch, channels, height, width]
    input_shape = [1, 3, 256, 256]
    output_shape = [1, 3, 256, 256]
    
    # Create input
    input_tensor = helper.make_tensor_value_info(
        'input', onnx.TensorProto.FLOAT, input_shape
    )
    
    # Create output
    output_tensor = helper.make_tensor_value_info(
        'output', onnx.TensorProto.FLOAT, output_shape
    )
    
    # Create nodes for basic style transformation
    nodes = []
    
    # Normalize input (0-255 to 0-1)
    norm_node = helper.make_node(
        'Div',
        inputs=['input'],
        outputs=['normalized'],
        name='normalize'
    )
    nodes.append(norm_node)
    
    # Apply style-specific transformations
    if "Van Gogh" in style_name:
        # Color enhancement and swirl effect
        color_scale = helper.make_node(
            'Mul',
            inputs=['normalized'],
            outputs=['colored'],
            name='color_enhance',
            attrs={'value': np.array([1.4, 1.2, 1.1], dtype=np.float32)}
        )
        nodes.append(color_scale)
        
        # Add some artistic effects
        add_node = helper.make_node(
            'Add',
            inputs=['colored'],
            outputs=['styled'],
            name='add_effects',
            attrs={'value': np.array(0.1, dtype=np.float32)}
        )
        nodes.append(add_node)
        
    elif "Picasso" in style_name:
        # High contrast and geometric effects
        contrast_node = helper.make_node(
            'Mul',
            inputs=['normalized'],
            outputs=['contrast'],
            name='contrast',
            attrs={'value': np.array(1.5, dtype=np.float32)}
        )
        nodes.append(contrast_node)
        
        add_node = helper.make_node(
            'Add',
            inputs=['contrast'],
            outputs=['styled'],
            name='add_geometric',
            attrs={'value': np.array(0.2, dtype=np.float32)}
        )
        nodes.append(add_node)
        
    elif "Cyberpunk" in style_name:
        # Neon color grading
        neon_scale = helper.make_node(
            'Mul',
            inputs=['normalized'],
            outputs=['neon'],
            name='neon_scale',
            attrs={'value': np.array([1.3, 0.8, 1.5], dtype=np.float32)}
        )
        nodes.append(neon_scale)
        
        add_node = helper.make_node(
            'Add',
            inputs=['neon'],
            outputs=['styled'],
            name='add_glow',
            attrs={'value': np.array(0.2, dtype=np.float32)}
        )
        nodes.append(add_node)
        
    elif "Monet" in style_name:
        # Soft impressionist effects
        soft_node = helper.make_node(
            'Mul',
            inputs=['normalized'],
            outputs=['soft'],
            name='soft_scale',
            attrs={'value': np.array(1.1, dtype=np.float32)}
        )
        nodes.append(soft_node)
        
        add_node = helper.make_node(
            'Add',
            inputs=['soft'],
            outputs=['styled'],
            name='add_impressionist',
            attrs={'value': np.array(0.05, dtype=np.float32)}
        )
        nodes.append(add_node)
        
    elif "Anime" in style_name:
        # Anime color saturation
        saturate_node = helper.make_node(
            'Mul',
            inputs=['normalized'],
            outputs=['saturated'],
            name='saturate',
            attrs={'value': np.array(1.3, dtype=np.float32)}
        )
        nodes.append(saturate_node)
        
        add_node = helper.make_node(
            'Add',
            inputs=['saturated'],
            outputs=['styled'],
            name='add_anime',
            attrs={'value': np.array(0.1, dtype=np.float32)}
        )
        nodes.append(add_node)
    
    else:
        # Default: identity transformation
        identity_node = helper.make_node(
            'Identity',
            inputs=['normalized'],
            outputs=['styled'],
            name='identity'
        )
        nodes.append(identity_node)
    
    # Clamp values to 0-1 range
    clamp_node = helper.make_node(
        'Clip',
        inputs=['styled'],
        outputs=['clamped'],
        name='clamp',
        min=0.0,
        max=1.0
    )
    nodes.append(clamp_node)
    
    # Denormalize output (0-1 to 0-255)
    denorm_node = helper.make_node(
        'Mul',
        inputs=['clamped'],
        outputs=['output'],
        name='denormalize',
        attrs={'value': np.array(255.0, dtype=np.float32)}
    )
    nodes.append(denorm_node)
    
    # Create the model
    graph = helper.make_graph(
        nodes,
        f'{style_name}_style_transfer',
        [input_tensor],
        [output_tensor]
    )
    
    # Create the model
    model = helper.make_model(graph)
    
    # Infer shapes
    model = shape_inference.infer_shapes(model)
    
    # Save the model
    with open(output_path, 'wb') as f:
        f.write(model.SerializeToString())
    
    print(f"Created ONNX model: {output_path}")

def main():
    """Generate all style transfer models"""
    
    # Ensure models directory exists
    models_dir = "public/models"
    os.makedirs(models_dir, exist_ok=True)
    
    # Define styles
    styles = [
        "Van Gogh - Starry Night",
        "Picasso - Cubist", 
        "Cyberpunk Neon",
        "Monet - Water Lilies",
        "Anime Studio Ghibli"
    ]
    
    # Generate models
    for style in styles:
        # Create filename
        filename = style.lower().replace(" - ", "_").replace(" ", "_") + ".onnx"
        output_path = os.path.join(models_dir, filename)
        
        try:
            create_style_transfer_model(style, output_path)
        except Exception as e:
            print(f"Failed to create model for {style}: {e}")
    
    print("Model generation complete!")

if __name__ == "__main__":
    main()
