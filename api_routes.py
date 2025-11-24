"""
API routes for Asset Manager custom node
These routes should be registered with ComfyUI's server
"""

import os
import json
from pathlib import Path
from urllib.parse import quote
import folder_paths
from aiohttp import web
from .api_client import AssetManagerAPIClient


def get_output_images():
    """
    Get list of files from ComfyUI output folder
    Returns a list of file information including paths, metadata, and file types
    """
    try:
        output_dir = folder_paths.get_output_directory()

        if not os.path.exists(output_dir):
            return {
                "status": "error",
                "message": "Output directory not found",
                "images": [],
            }

        images = []

        file_type_map = {
            # images
            ".png": "image",
            ".jpg": "image",
            ".jpeg": "image",
            ".webp": "image",
            ".svg": "image",
            # videos
            ".mp4": "video",
            ".mov": "video",
            ".avi": "video",
            # audio
            ".mp3": "audio",
            ".wav": "audio",
            ".flac": "audio",
            # text
            ".txt": "text",
            ".json": "text",
            # 3D
            ".obj": "3D",
            ".fbx": "3D",
            ".gltf": "3D",
            ".glb": "3D",
        }

        file_count = 0
        for root, dirs, files in os.walk(output_dir):
            for file in files:
                file_count += 1

                # Use proper extension extraction instead of endswith matching
                file_ext = os.path.splitext(file.lower())[1]

                # Check if this extension is supported
                if file_ext in file_type_map:
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, output_dir)

                    # Normalize path separators to forward slashes for URLs (works on all OS)
                    relative_path_normalized = relative_path.replace(os.sep, "/")

                    stat_info = os.stat(file_path)
                    file_type = file_type_map[file_ext]

                    # Build URL with subfolder parameter if file is in a subdirectory
                    # ComfyUI's /view endpoint expects: filename=basename&subfolder=path&type=output
                    if "/" in relative_path_normalized:
                        # File is in a subfolder
                        subfolder = relative_path_normalized.rsplit("/", 1)[0]
                        basename = relative_path_normalized.rsplit("/", 1)[1]
                        encoded_basename = quote(basename)
                        encoded_subfolder = quote(subfolder, safe="/")
                        view_url = f"/view?filename={encoded_basename}&subfolder={encoded_subfolder}&type=output"
                    else:
                        # File is in root output directory
                        encoded_basename = quote(relative_path_normalized)
                        view_url = f"/view?filename={encoded_basename}&type=output"


                    images.append(
                        {
                            "name": file,
                            "path": relative_path_normalized,
                            "url": view_url,
                            "size": stat_info.st_size,
                            "modified": stat_info.st_mtime,
                            "file_type": file_type,
                            "extension": file_ext,
                        }
                    )

        images.sort(key=lambda x: x["modified"], reverse=True)
        return {"status": "success", "images": images, "count": len(images)}

    except Exception as e:
        import traceback

        traceback.print_exc()
        return {"status": "error", "message": str(e), "images": []}


def upload_assets(data):
    """
    Upload selected assets and metadata to external API

    Args:
        data: Dictionary containing:
            - assets: List of selected image paths (relative to output dir)
            - project_id: Target project ID
            - folder_id: Target folder ID
            - organization_id: Organization ID
            - metadata: Additional metadata (workflow, nodes, etc.)
            - api_key: API authentication key
    """
    try:
        assets = data.get("assets", [])
        project_id = data.get("project_id")
        folder_id = data.get("folder_id")
        organization_id = data.get("organization_id")
        metadata = data.get("metadata", {})
        api_key = data.get("api_key")

        if not api_key:
            return {"status": "error", "message": "API key is required"}

        if not assets:
            return {"status": "error", "message": "No assets selected for upload"}

        if not project_id:
            return {"status": "error", "message": "Project ID is required"}

        output_dir = folder_paths.get_output_directory()

        from .api_client import AssetManagerAPIClient

        client = AssetManagerAPIClient(api_key=api_key)

        results = {
            "status": "success",
            "total": len(assets),
            "successful": 0,
            "failed": 0,
            "errors": [],
        }

        for asset_path in assets:
            # Convert forward slashes back to OS-specific separators
            normalized_asset_path = asset_path.replace("/", os.sep)
            full_path = os.path.join(output_dir, normalized_asset_path)

            if not os.path.exists(full_path):
                results["failed"] += 1
                results["errors"].append(
                    {"file": asset_path, "error": "File not found"}
                )
                continue

            result = client.upload_asset(
                file_path=full_path,
                project_id=project_id,
                folder_id=folder_id,
                organization_id=organization_id,
                metadata=metadata,
            )

            if result["status"] == "success":
                results["successful"] += 1
            else:
                results["failed"] += 1
                results["errors"].append(
                    {
                        "file": asset_path,
                        "error": result.get("message", "Unknown error"),
                    }
                )

        if results["failed"] > 0:
            results["status"] = "partial"

        results["message"] = (
            f"Uploaded {results['successful']}/{results['total']} assets successfully"
        )

        return results

    except Exception as e:
        import traceback

        traceback.print_exc()
        return {"status": "error", "message": str(e)}


def delete_image(image_path):
    """
    Delete an image file from the output folder

    Args:
        image_path: Relative path to the image file

    Returns:
        Status dictionary
    """
    try:
        output_dir = folder_paths.get_output_directory()
        # Convert forward slashes back to OS-specific separators
        normalized_image_path = image_path.replace("/", os.sep)
        full_path = os.path.join(output_dir, normalized_image_path)

        real_output_dir = os.path.realpath(output_dir)
        real_file_path = os.path.realpath(full_path)

        if not real_file_path.startswith(real_output_dir):
            return {
                "status": "error",
                "message": "Invalid file path - security violation",
            }

        if not os.path.exists(full_path):
            return {"status": "error", "message": "File not found"}

        os.remove(full_path)

        return {"status": "success", "message": f"Successfully deleted {image_path}"}

    except Exception as e:
        import traceback

        traceback.print_exc()
        return {"status": "error", "message": str(e)}


def get_organizations(api_key):
    """
    Get list of organizations from external API

    Args:
        api_key: API authentication key

    Returns:
        List of organizations
    """
    try:
        if not api_key:
            return {
                "status": "error",
                "message": "API key is required",
                "organizations": [],
            }

        client = AssetManagerAPIClient(api_key=api_key)
        result = client.get_organizations()
        return result

    except Exception as e:
        return {"status": "error", "message": str(e), "organizations": []}


def get_projects(api_key, organization_id=None):
    """
    Get list of projects for an organization from external API

    Args:
        api_key: API authentication key
        organization_id: Organization ID (optional)

    Returns:
        List of projects
    """
    try:
        if not api_key:
            return {"status": "error", "message": "API key is required", "projects": []}

        client = AssetManagerAPIClient(api_key=api_key)
        result = client.get_projects(organization_id=organization_id)
        return result

    except Exception as e:
        return {"status": "error", "message": str(e), "projects": []}


def register_routes(server):
    """
    Register API routes with ComfyUI server

    Args:
        server: ComfyUI PromptServer instance
    """

    @server.routes.get("/asset-manager/get_output_images")
    async def api_get_output_images(request):
        result = get_output_images()
        return web.json_response(result)

    @server.routes.post("/asset-manager/upload_assets")
    async def api_upload_assets(request):
        data = await request.json()
        result = upload_assets(data)
        return web.json_response(result)

    @server.routes.post("/asset-manager/delete_image")
    async def api_delete_image(request):
        data = await request.json()
        image_path = data.get("image_path", "")
        result = delete_image(image_path)
        return web.json_response(result)

    @server.routes.get("/asset-manager/get_organizations")
    async def api_get_organizations(request):
        api_key = request.query.get("api_key", "")
        result = get_organizations(api_key)
        return web.json_response(result)

    @server.routes.get("/asset-manager/get_projects")
    async def api_get_projects(request):
        api_key = request.query.get("api_key", "")
        organization_id = request.query.get("organization_id", "")
        result = get_projects(api_key, organization_id)
        return web.json_response(result)
