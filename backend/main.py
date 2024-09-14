from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import logging
from tempfile import NamedTemporaryFile
from pic_to_3d import process_image_get_depth_data, depth_data_to_3d_model

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Updated CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow requests from your frontend origin
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.post("/process_image")
async def process_image(file: UploadFile = File(...)):
    logger.info(f"Received file: {file.filename}")
    
    with NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_file_path = temp_file.name
    
    try:
        # Process the image and get depth data
        logger.info("Processing image to get depth data...")
        depth_data_path = process_image_get_depth_data(temp_file_path)
        logger.info(f"Depth data saved as: {depth_data_path}")
        
        # Generate 3D model
        logger.info("Generating 3D model...")
        stl_path = "output_3d_model.stl"
        depth_data_to_3d_model(depth_data_path, output_stl_path=stl_path)
        logger.info(f"3D model saved as: {stl_path}")
        
        # Check if the STL file was actually created
        if not os.path.exists(stl_path):
            raise FileNotFoundError(f"STL file was not created at {stl_path}")
        
        # Return paths to the generated files
        return {
            "depth_data": depth_data_path,
            "stl_model": stl_path
        }
    except Exception as e:
        logger.error(f"An error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up the temporary file
        os.unlink(temp_file_path)

@app.get("/depth_data/{filename}")
async def get_depth_data(filename: str):
    file_path = os.path.join(os.getcwd(), filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Depth data file not found")
    return FileResponse(file_path)

@app.get("/stl_model/{filename}")
async def get_stl_model(filename: str):
    file_path = os.path.join(os.getcwd(), filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="STL model file not found")
    return FileResponse(file_path)

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)