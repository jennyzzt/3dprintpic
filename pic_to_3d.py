import os
import shutil
import numpy as np
from stl import mesh
from tqdm import tqdm
from scipy.ndimage import gaussian_filter
import plotly.graph_objs as go
from gradio_client import Client, handle_file
import argparse

# Image processing and getting depth data
def process_image_get_depth_data(input_image_path, output_dir="./output"):
    # Initialize the Gradio Client
    client = Client("facebook/sapiens_depth")

    # Perform the prediction and get the result
    result = client.predict(
        image=handle_file(input_image_path),
        depth_model_name="1b",
        seg_model_name="fg-bg-1b (recommended)",
        api_name="/process_image"
    )

    # Unpack the result (since it's a tuple of two paths)
    image_path, npy_path = result

    # Create the output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Move the image and the .npy file to the output directory
    shutil.copy(image_path, os.path.join(output_dir, "output_image.webp"))
    shutil.copy(npy_path, os.path.join(output_dir, "output_depth_data.npy"))

    print(f"Files saved successfully to {output_dir}")

    return os.path.join(output_dir, "output_depth_data.npy")

def depth_data_to_3d_model(npy_file, output_stl_path='output_3d_model.stl', target_dimension=300, z_scale=50, invert=True, sigma=4.0):
    # Load the .npy file
    data = np.load(npy_file)

    # Skip downsampling if target_dimension is -1
    if target_dimension != -1:
        # Adjust the downsample resolution dynamically based on the maximum dimension
        max_dimension = max(data.shape)
        downsample_res = max(1, -(-max_dimension // target_dimension))
        print(f"Downsampling resolution: {downsample_res}")

        # Downsample the data to reduce the resolution
        data = data[::downsample_res, ::downsample_res]
    else:
        print("Skipping downsampling as target_dimension is -1")

    # Flip the x axis
    data = np.flip(data, axis=1)

    # Adjust height scaling (z-scale) and option to invert the heights
    if invert:
        z_max = np.nanmax(data)
        z = (z_max - data) * z_scale
    else:
        z = data * z_scale
    
    # Add a small offset to create buffer
    z = z + 0.01

    # Apply a Gaussian filter to smooth the data
    data = gaussian_filter(data, sigma=sigma)

    # Create a mask for non-NaN values
    mask = ~np.isnan(z)

    # Find the bounding box of non-NaN values
    rows, cols = np.where(mask)
    top, bottom = rows.min(), rows.max() + 1
    left, right = cols.min(), cols.max() + 1

    # Crop the data to the bounding box
    z = z[top:bottom, left:right]
    mask = mask[top:bottom, left:right]

    # Adjust the X, Y grid to match the cropped data
    x = np.arange(z.shape[1])
    y = np.arange(z.shape[0])
    x, y = np.meshgrid(x, y)

    # Count the number of valid cells (where all four corners are non-NaN)
    valid_cells = np.sum(mask[:-1, :-1] & mask[1:, :-1] & mask[:-1, 1:] & mask[1:, 1:])

    # Calculate the number of faces needed
    # 2 triangles per valid cell for the top surface
    # 8 triangles per valid cell for the sides (filling from 0 to z)
    # 2 triangles for the bottom surface
    num_faces = valid_cells * 10 + 1

    print(f"Number of faces: {num_faces}")

    # Initialize an STL mesh with the calculated number of faces
    stl_mesh = mesh.Mesh(np.zeros(num_faces, dtype=mesh.Mesh.dtype))

    face_index = 0

    # Generate top surface and fill from 0 to z
    for i in tqdm(range(z.shape[0] - 1), desc="Processing rows"):
        for j in range(z.shape[1] - 1):
            if mask[i, j] and mask[i+1, j] and mask[i, j+1] and mask[i+1, j+1]:
                # Top surface vertices
                v0 = [x[i, j], y[i, j], z[i, j]]
                v1 = [x[i+1, j], y[i+1, j], z[i+1, j]]
                v2 = [x[i, j+1], y[i, j+1], z[i, j+1]]
                v3 = [x[i+1, j+1], y[i+1, j+1], z[i+1, j+1]]

                # Bottom surface vertices
                v0_bottom = [x[i, j], y[i, j], 0]
                v1_bottom = [x[i+1, j], y[i+1, j], 0]
                v2_bottom = [x[i, j+1], y[i, j+1], 0]
                v3_bottom = [x[i+1, j+1], y[i+1, j+1], 0]

                # Top surface
                stl_mesh.vectors[face_index] = np.array([v0, v1, v2])
                face_index += 1
                stl_mesh.vectors[face_index] = np.array([v1, v3, v2])
                face_index += 1

                # Fill from 0 to z
                # Front face
                stl_mesh.vectors[face_index] = np.array([v0, v1, v0_bottom])
                face_index += 1
                stl_mesh.vectors[face_index] = np.array([v1, v1_bottom, v0_bottom])
                face_index += 1

                # Right face
                stl_mesh.vectors[face_index] = np.array([v1, v3, v1_bottom])
                face_index += 1
                stl_mesh.vectors[face_index] = np.array([v3, v3_bottom, v1_bottom])
                face_index += 1

                # Back face
                stl_mesh.vectors[face_index] = np.array([v3, v2, v3_bottom])
                face_index += 1
                stl_mesh.vectors[face_index] = np.array([v2, v2_bottom, v3_bottom])
                face_index += 1

                # Left face
                stl_mesh.vectors[face_index] = np.array([v2, v0, v2_bottom])
                face_index += 1
                stl_mesh.vectors[face_index] = np.array([v0, v0_bottom, v2_bottom])
                face_index += 1

    # Trim any unused faces
    if face_index < num_faces:
        stl_mesh.vectors = stl_mesh.vectors[:face_index+1]

    # Save the mesh to an STL file
    stl_mesh.save(output_stl_path)
    print(f"STL file saved as {output_stl_path}")

# Create interactive 3D plot
def create_interactive_3d_plot(npy_file, output_html='interactive_3d_plot.html'):
    # Load the .npy file
    data = np.load(npy_file)

    # Create x and y values corresponding to the data dimensions
    x = np.linspace(0, data.shape[1] - 1, data.shape[1])
    y = np.linspace(0, data.shape[0] - 1, data.shape[0])
    x, y = np.meshgrid(x, y)
    z = data  # Use the loaded data as z-values

    # Create the 3D surface plot using Plotly
    surface = go.Surface(z=z, x=x, y=y, colorscale='Viridis')

    # Create the layout for the plot
    layout = go.Layout(
        title='Interactive 3D Surface Plot',
        scene=dict(
            xaxis_title='X Axis',
            yaxis_title='Y Axis',
            zaxis_title='Z Axis'
        ),
    )

    # Combine the plot and layout into a figure
    fig = go.Figure(data=[surface], layout=layout)

    # Save the figure as an HTML file
    fig.write_html(output_html)
    print(f"Interactive 3D plot saved as {output_html}")

# Main script to call the functions
def main():
    # Argument parsing
    parser = argparse.ArgumentParser(description='Process an image, generate depth data, and optionally create a 3D model and interactive plot.')
    parser.add_argument('--input', type=str, default="./input_image.jpg", help='Path to the input image file')
    parser.add_argument('--interactive-plot', action='store_true', help='Generate interactive 3D plot (default: False)')
    parser.add_argument('--output-dir', type=str, default="./output", help='Directory to save the output files')
    parser.add_argument('--target-dimension', type=int, default=300, help='Target dimension for the 3D model downsampling')
    parser.add_argument('--skip-gendepth', action='store_true', help='Skip depth data generation and use existing depth data')
    parser.add_argument('--z-scale', type=float, default=50, help='Z scale for adjusting the height in the 3D model')

    args = parser.parse_args()

    # Ensure output directory exists
    os.makedirs(args.output_dir, exist_ok=True)

    # Process the image and get depth data (unless skip-gendepth is True)
    if not args.skip_gendepth:
        npy_file = process_image_get_depth_data(args.input, args.output_dir)
    else:
        # If skipping depth generation, ensure the depth data exists
        npy_file = os.path.join(args.output_dir, "output_depth_data.npy")
        if not os.path.exists(npy_file):
            raise FileNotFoundError(f"Depth data not found at {npy_file}. Please generate depth data first or provide the correct path.")

    # Conditionally create an interactive 3D plot
    if args.interactive_plot:
        create_interactive_3d_plot(npy_file, output_html=os.path.join(args.output_dir, 'interactive_3d_plot.html'))

    # Convert depth data to 3D model, passing the target dimension and z-scale
    depth_data_to_3d_model(npy_file, output_stl_path=os.path.join(args.output_dir, 'output_3d_model.stl'), target_dimension=args.target_dimension, z_scale=args.z_scale)

if __name__ == "__main__":
    main()
