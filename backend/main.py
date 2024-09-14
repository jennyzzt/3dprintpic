import os
from dotenv import load_dotenv
import aiohttp
import asyncio
import re
import math
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import logging
from tempfile import NamedTemporaryFile
from pic_to_3d import process_image_get_depth_data, depth_data_to_3d_model
import numpy as np
from PIL import Image

# Load environment variables
load_dotenv()

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

# Get API key and team ID from environment variables
MASV_API_KEY = os.getenv("MASV_API_KEY")
MASV_TEAM_ID = os.getenv("MASV_TEAM_ID")

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

@app.post("/upload_to_masv")
async def upload_to_masv_endpoint(file_name: str = Form(...)):
    logger.info(f"Received request to upload file to MASV: {file_name}")
    
    file_path = os.path.join(os.getcwd(), file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_name}")
    
    try:
        # Upload to MASV
        logger.info("Uploading to MASV...")
        masv_package_id = await upload_to_masv(file_path, file_name)
        logger.info(f"Uploaded to MASV. Package ID: {masv_package_id}")
        
        return {"masv_package_id": masv_package_id}
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise e
    except Exception as e:
        logger.error(f"An unexpected error occurred during MASV upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during MASV upload: {str(e)}")

async def upload_to_masv(file_path: str, file_name: str):
    # MASV API endpoints
    create_package_url = "https://api.massive.app/v1/teams/{team_id}/packages"
    add_file_url = "https://api.massive.app/v1/packages/{package_id}/files"
    finalize_package_url = "https://api.massive.app/v1/packages/{package_id}/finalize"

    headers = {
        "X-API-KEY": MASV_API_KEY,
        "Content-Type": "application/json"
    }

    try:
        async with aiohttp.ClientSession() as session:
            # Step 1: Create a package
            package_data = {
                "name": "3D Print Model",
                "description": "Uploaded 3D print model",
                "recipients": ["jennylive158@gmail.com"]
            }
            async with session.post(create_package_url.format(team_id=MASV_TEAM_ID), json=package_data, headers=headers) as response:
                response.raise_for_status()
                package = await response.json()
                package_id = package["id"]
                package_token = package["access_token"]
                logger.info(f"Package created successfully. ID: {package_id}")

            # Step 2: Add file to the package
            file_data = {
                "kind": "file",
                "name": file_name,
                "path": "",
                "last_modified": datetime.utcnow().isoformat() + "Z"
            }
            headers["X-Package-Token"] = package_token
            async with session.post(add_file_url.format(package_id=package_id), json=file_data, headers=headers) as response:
                response.raise_for_status()
                file_info = await response.json()
                file_id = file_info["file"]["id"]
                logger.info(f"File added to package successfully. File ID: {file_id}")

            # Step 3: Create the file in MASV's cloud storage
            create_blueprint = file_info["create_blueprint"]
            async with session.request(
                create_blueprint["method"],
                create_blueprint["url"],
                headers=create_blueprint.get("headers", {})
            ) as response:
                response.raise_for_status()
                create_response = await response.text()
                logger.info("File created in MASV's cloud storage")
                
                # Parse the XML response to get the UploadId
                upload_id = re.search("<UploadId>(.*?)</UploadId>", create_response).group(1)

            # Step 4: Obtain upload URLs
            chunk_size = 5 * 1024 * 1024  # 5 MB chunks
            file_size = os.path.getsize(file_path)
            chunk_count = math.ceil(file_size / chunk_size)
            
            async with session.post(
                f"{add_file_url.format(package_id=package_id)}/{file_id}",
                params={"start": 0, "count": chunk_count},
                json={"upload_id": upload_id},
                headers=headers
            ) as response:
                response.raise_for_status()
                upload_urls = await response.json()
                logger.info(f"Obtained {len(upload_urls)} upload URLs")

            # Step 5: Upload file chunks
            chunk_extras = []
            with open(file_path, 'rb') as f:
                for i, upload_info in enumerate(upload_urls, start=1):
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    
                    logger.info(f"Uploading chunk {i}")
                    async with session.request(
                        upload_info["method"],
                        upload_info["url"],
                        data=chunk
                    ) as response:
                        response.raise_for_status()
                        etag = response.headers.get("ETag")
                        chunk_extras.append({"partNumber": str(i), "etag": etag})
                    logger.info(f"Chunk {i} uploaded successfully")

            # Step 6: Finalize the file
            finalize_data = {
                "chunk_extras": chunk_extras,
                "file_extras": {"upload_id": upload_id},
                "size": file_size,
                "chunk_size": chunk_size
            }
            async with session.post(
                f"{add_file_url.format(package_id=package_id)}/{file_id}/finalize",
                json=finalize_data,
                headers=headers
            ) as response:
                response.raise_for_status()
                logger.info("File upload finalized successfully")

            # Step 7: Finalize the package
            async with session.post(finalize_package_url.format(package_id=package_id), headers=headers) as response:
                response.raise_for_status()
                logger.info("Package finalized successfully")

        return package_id
    except aiohttp.ClientResponseError as e:
        logger.error(f"MASV API error: {e.status}, message='{e.message}', url='{e.request_info.url}'")
        logger.error(f"Request headers: {e.request_info.headers}")
        logger.error(f"Response headers: {e.headers}")
        raise HTTPException(status_code=500, detail=f"MASV API error: {e.status}, {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error during MASV upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error during MASV upload: {str(e)}")

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

def sanitize_float(x):
    if np.isnan(x) or np.isinf(x):
        return -12345678  # or another appropriate default value
    return float(x)

@app.get("/depth_data_downsampled/{filename}")
async def get_depth_data_downsampled(filename: str):
    file_path = os.path.join(os.getcwd(), f"./output/{filename}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Depth data file not found")
    
    try:
        # Load the depth data
        depth_data = np.load(file_path)
        
        # Get original dimensions
        original_height, original_width = depth_data.shape
        
        # Calculate the scaling factor
        max_dimension = max(original_height, original_width)
        scale_factor = max(1, int(max_dimension / 100))
        
        # Downsample the depth data by skipping pixels
        downsampled_data = depth_data[::scale_factor, ::scale_factor]
        
        # Get new dimensions
        new_height, new_width = downsampled_data.shape
        
        # Sanitize and convert to list for JSON serialization
        downsampled_list = [[sanitize_float(x) for x in row] for row in downsampled_data]
        
        return JSONResponse(content={
            "depth_data": downsampled_list,
            "original_dimensions": {
                "height": original_height,
                "width": original_width
            },
            "downsampled_dimensions": {
                "height": new_height,
                "width": new_width
            }
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing depth data: {str(e)}")

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)