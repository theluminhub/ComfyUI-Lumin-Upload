"""
API Client for Asset Manager
This module handles communication with the external API
"""

import requests
import json
import os
from typing import Dict, List, Optional


class AssetManagerAPIClient:
    """Client for communicating with the Asset Manager API"""

    def __init__(self, api_key: str, base_url: str = None):
        """
        Initialize the API client

        Args:
            api_key: API authentication key
            base_url: Base URL for the API (optional, can be set via config)
        """
        self.api_key = api_key
        self.base_url = base_url or "https://api.folders.nodehaus.io/api"
        self.upload_base_url = "https://api.upload.nodehaus.io"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "x-api-key": api_key,
        }
        self.timeout = 30
        self.chunk_size = 10 * 1024 * 1024  #10MB chunks

    def get_organizations(self) -> Dict:
        """
        Fetch list of organizations from API

        Returns:
            Dictionary containing status and organizations list
        """
        try:
            url = f"{self.base_url}/organizations"

            response = requests.get(url, headers=self.headers, timeout=self.timeout)

            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("organizations"):
                    return {
                        "status": "success",
                        "organizations": data.get("organizations", []),
                    }
                else:
                    return {
                        "status": "error",
                        "message": data.get("error", "Failed to load organizations"),
                        "organizations": [],
                    }
            else:
                return {
                    "status": "error",
                    "message": f"HTTP error! status: {response.status_code}",
                    "organizations": [],
                }

        except Exception as e:
            return {"status": "error", "message": str(e), "organizations": []}

    def get_projects(self, organization_id: str = None) -> Dict:
        """
        Fetch list of projects for an organization

        Args:
            organization_id: Organization ID (optional)

        Returns:
            Dictionary containing status and projects list
        """
        try:
            url = f"{self.base_url}/projects"

            params = {}
            if organization_id:
                params["organization_id"] = organization_id

            response = requests.get(
                url, headers=self.headers, params=params, timeout=self.timeout
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("folders"):
                    return {"status": "success", "projects": data.get("folders", [])}
                else:
                    return {
                        "status": "error",
                        "message": data.get("error", "Failed to load projects"),
                        "projects": [],
                    }
            else:
                return {
                    "status": "error",
                    "message": f"HTTP error! status: {response.status_code}",
                    "projects": [],
                }

        except Exception as e:
            return {"status": "error", "message": str(e), "projects": []}

    def upload_asset(
        self,
        file_path: str,
        project_id: str,
        folder_id: str = None,
        organization_id: str = None,
        metadata: Optional[Dict] = None,
    ) -> Dict:
        """
        Upload a single asset using multipart upload

        Args:
            file_path: Path to the file to upload
            project_id: Target project ID
            folder_id: Target folder ID (defaults to project_id if not provided)
            organization_id: Organization ID
            metadata: Optional metadata dictionary (ComfyUI workflow JSON)

        Returns:
            Dictionary containing upload status and result
        """
        upload_id = None
        key = None

        try:
            file_size = os.path.getsize(file_path)
            filename = os.path.basename(file_path)
            file_ext = os.path.splitext(file_path)[1].lower()

            type_mapping = {
                ".png": ("image", "image/png"),
                ".jpg": ("image", "image/jpeg"),
                ".jpeg": ("image", "image/jpeg"),
                ".gif": ("image", "image/gif"),
                ".webp": ("image", "image/webp"),
                ".bmp": ("image", "image/bmp"),
                ".mp4": ("video", "video/mp4"),
                ".mov": ("video", "video/quicktime"),
                ".avi": ("video", "video/x-msvideo"),
                ".mkv": ("video", "video/x-matroska"),
                ".txt": ("text", "text/plain"),
                ".json": ("text", "application/json"),
                ".mp3": ("audio", "audio/mpeg"),
                ".wav": ("audio", "audio/wav"),
                ".flac": ("audio", "audio/flac"),
                ".obj": ("3D", "model/obj"),
                ".fbx": ("3D", "model/fbx"),
                ".gltf": ("3D", "model/gltf+json"),
                ".glb": ("3D", "model/gltf-binary"),
            }
            asset_type, content_type = type_mapping.get(
                file_ext, ("image", "application/octet-stream")
            )

            create_response = requests.post(
                f"{self.upload_base_url}/api/upload/create",
                headers={"Content-Type": "application/json", "x-api-key": self.api_key},
                json={
                    "organizationId": organization_id,
                    "projectId": project_id,
                    "platform": "comfyui",
                    "fileName": filename,
                    "fileSize": file_size,
                    "contentType": content_type,
                    "type": asset_type,
                    "title": filename,
                    "folderId": folder_id or project_id,
                    "metadata": metadata,
                },
                timeout=self.timeout,
            )
            create_response.raise_for_status()
            create_result = create_response.json()
            upload_id = create_result["uploadId"]
            key = create_result["key"]

            parts = []
            with open(file_path, "rb") as f:
                part_number = 1
                while True:
                    chunk = f.read(self.chunk_size)
                    if not chunk:
                        break

                    part_response = requests.post(
                        f"{self.upload_base_url}/api/upload/part",
                        headers={
                            "x-api-key": self.api_key,
                            "X-Upload-Id": upload_id,
                            "X-Part-Number": str(part_number),
                            "X-Key": key,
                        },
                        data=chunk,
                        timeout=self.timeout * 2,  #double timeout for large chunks
                    )
                    part_response.raise_for_status()
                    part_result = part_response.json()
                    parts.append(
                        {
                            "partNumber": part_result["partNumber"],
                            "etag": part_result["etag"],
                        }
                    )
                    part_number += 1

            complete_response = requests.post(
                f"{self.upload_base_url}/api/upload/complete",
                headers={"Content-Type": "application/json", "x-api-key": self.api_key},
                json={
                    "uploadId": upload_id,
                    "key": key,
                    "parts": parts,
                    "type": asset_type,
                    "title": filename,
                    "folderId": folder_id or project_id,
                    "organizationId": organization_id,
                    "projectId": project_id,
                    "platform": "comfyui",
                    "metadata": metadata if metadata else {},
                },
                timeout=self.timeout,
            )
            complete_response.raise_for_status()
            complete_result = complete_response.json()

            return {
                "status": "success",
                "message": f"Successfully uploaded {filename}",
                "data": complete_result,
            }

        except Exception as e:
            if upload_id and key:
                try:
                    requests.post(
                        f"{self.upload_base_url}/api/upload/abort",
                        headers={
                            "Content-Type": "application/json",
                            "x-api-key": self.api_key,
                        },
                        json={"uploadId": upload_id, "key": key},
                        timeout=self.timeout,
                    )
                except Exception as abort_error:
                    pass

            import traceback

            traceback.print_exc()
            return {"status": "error", "message": f"Upload failed: {str(e)}"}

    def batch_upload_assets(
        self,
        file_paths: List[str],
        project_id: str,
        folder_id: str = None,
        organization_id: str = None,
        metadata: Optional[Dict] = None,
    ) -> Dict:
        """
        Upload multiple assets in batches

        Args:
            file_paths: List of file paths to upload
            project_id: Target project ID
            folder_id: Target folder ID (defaults to project_id if not provided)
            organization_id: Organization ID
            metadata: Optional metadata dictionary

        Returns:
            Dictionary containing batch upload status and results
        """
        results = {
            "status": "success",
            "total": len(file_paths),
            "successful": 0,
            "failed": 0,
            "errors": [],
        }

        for file_path in file_paths:
            result = self.upload_asset(
                file_path, project_id, folder_id, organization_id, metadata
            )

            if result["status"] == "success":
                results["successful"] += 1
            else:
                results["failed"] += 1
                results["errors"].append(
                    {"file": file_path, "error": result.get("message", "Unknown error")}
                )

        if results["failed"] > 0:
            results["status"] = "partial"

        results["message"] = (
            f"Uploaded {results['successful']}/{results['total']} assets successfully"
        )

        return results

    def test_connection(self) -> Dict:
        """
        Test the API connection

        Returns:
            Dictionary containing connection test result
        """
        try:
            url = f"{self.base_url}/health"

            response = requests.get(url, headers=self.headers, timeout=5)

            if response.status_code == 200:
                return {"status": "success", "message": "API connection successful"}
            else:
                return {
                    "status": "error",
                    "message": f"API returned status code {response.status_code}",
                }

        except Exception as e:
            return {"status": "error", "message": f"Connection failed: {str(e)}"}
