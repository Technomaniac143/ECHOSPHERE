"""Agora Cloud Recording service for session recording."""
import logging
from typing import Any, Optional
from uuid import uuid4

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class AgoraRecordingError(Exception):
    """Exception for Agora Cloud Recording API errors."""
    pass


class AgoraCloudRecording:
    """
    Service for managing Agora Cloud Recording.
    
    Cloud Recording captures:
    - Candidate video
    - Candidate audio
    - AI audio
    - Screen share (if enabled)
    
    Recordings are stored in a team-owned storage bucket.
    """

    def __init__(self):
        self._api_key = settings.agora_convoai_api_key
        self._app_id = settings.agora_app_id
        self._base_url = "https://api.agora.io/v1"
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def start_recording(
        self,
        channel_name: str,
        uid: str,
        token: str,
        storage_config: dict[str, Any],
        recording_config: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Start a cloud recording session.
        
        Args:
            channel_name: Agora channel name
            uid: User ID of the recorder
            token: RTC token
            storage_config: Storage configuration (bucket, region, etc.)
            recording_config: Recording settings (audio/video, screen share, etc.)
        
        Returns:
            dict with recording_id and resource_id
        """
        client = await self._get_client()
        
        url = f"{self._base_url}/cloud_recording/{self._app_id}/record/start"
        
        headers = {
            "Content-Type": "application/json",
            "X-AGORA-API-KEY": self._api_key,
        }
        
        payload = {
            "token": token,
            "channel_correlation_id": channel_name,
            "recording_config": recording_config,
            "storage_config": storage_config,
        }
        
        logger.info(f"Starting cloud recording for channel: {channel_name}")
        
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()
            recording_id = result.get("recording_id")
            logger.info(f"Recording started: {recording_id}")
            return result
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to start recording: {e.response.status_code} - {e.response.text}")
            raise AgoraRecordingError(
                f"Failed to start recording: {e.response.status_code}"
            ) from e

    async def update_recording(
        self,
        recording_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Update an ongoing recording session.
        
        Common updates:
        - Add/remove streams
        - Change recording quality
        - Enable/disable screen share recording
        """
        client = await self._get_client()
        
        url = f"{self._base_url}/cloud_recording/{self._app_id}/record/update"
        
        headers = {
            "Content-Type": "application/json",
            "X-AGORA-API-KEY": self._api_key,
        }
        
        payload = {
            "recording_id": recording_id,
            **updates,
        }
        
        logger.info(f"Updating recording {recording_id}")
        
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to update recording: {e.response.status_code}")
            raise AgoraRecordingError(
                f"Failed to update recording: {e.response.status_code}"
            ) from e

    async def stop_recording(
        self,
        recording_id: str,
    ) -> dict[str, Any]:
        """
        Stop a cloud recording session.
        
        Returns the final recording information including storage URLs.
        """
        client = await self._get_client()
        
        url = f"{self._base_url}/cloud_recording/{self._app_id}/record/stop"
        
        headers = {
            "Content-Type": "application/json",
            "X-AGORA-API-KEY": self._api_key,
        }
        
        payload = {
            "recording_id": recording_id,
        }
        
        logger.info(f"Stopping recording: {recording_id}")
        
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()
            logger.info(f"Recording stopped: {recording_id}")
            return result
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to stop recording: {e.response.status_code}")
            raise AgoraRecordingError(
                f"Failed to stop recording: {e.response.status_code}"
            ) from e

    async def get_recording_status(
        self,
        recording_id: str,
    ) -> dict[str, Any]:
        """
        Get the status of a cloud recording.
        """
        client = await self._get_client()
        
        url = f"{self._base_url}/cloud_recording/{self._app_id}/record/query"
        
        headers = {
            "Content-Type": "application/json",
            "X-AGORA-API-KEY": self._api_key,
        }
        
        payload = {
            "recording_ids": [recording_id],
        }
        
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to get recording status: {e.response.status_code}")
            raise AgoraRecordingError(
                f"Failed to get recording status: {e.response.status_code}"
            ) from e


# Default recording configuration presets
DEFAULT_RECORDING_CONFIG = {
    "max_duration": 1800,  # 30 minutes max
    "audio_only": False,
    "video_width": 1280,
    "video_height": 720,
    "video_fps": 15,
    "video_bitrate": 800,
    "audio_channels": 1,
    "audio_bitrate": 64,
    "audio_sample_rate": 48000,
    "file_type": "mp4",
    "slice_interval": 10,  # Slice recordings into 10-min segments
}

DEFAULT_STORAGE_CONFIG = {
    "vendor": "aws_s3",  # or "gcs", "obs"
    "region": "us-east-1",
    "bucket": "echosphere-recordings",
    "root_path": "recordings",
    "storage_class": "STANDARD",
    "auth_config": {
        "access_key": "",  # Set from env
        "secret_key": "",  # Set from env
    },
}


# Singleton instance
_recording_service: Optional[AgoraCloudRecording] = None


def get_recording_service() -> AgoraCloudRecording:
    """Get the singleton Cloud Recording service instance."""
    global _recording_service
    if _recording_service is None:
        _recording_service = AgoraCloudRecording()
    return _recording_service
