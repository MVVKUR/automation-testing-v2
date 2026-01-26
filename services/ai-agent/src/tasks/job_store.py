"""Redis-based job storage for async job processing."""

import json
import logging
from datetime import datetime
from typing import Any, Optional

from src.api.schemas import JobResult, JobStatus
from src.config import get_settings

logger = logging.getLogger(__name__)


class JobStore:
    """Job storage backend supporting Redis and in-memory fallback."""

    def __init__(self, use_redis: bool = True):
        """Initialize the job store.

        Args:
            use_redis: Whether to use Redis (falls back to memory if unavailable)
        """
        self._memory_store: dict[str, dict[str, Any]] = {}
        self._redis_client: Optional[Any] = None
        self._use_redis = use_redis
        self._ttl_seconds = 3600  # 1 hour TTL for jobs

        if use_redis:
            self._init_redis()

    def _init_redis(self) -> None:
        """Initialize Redis connection."""
        try:
            import redis

            settings = get_settings()
            self._redis_client = redis.Redis.from_url(
                settings.redis_url,
                decode_responses=True,
            )
            # Test connection
            self._redis_client.ping()
            logger.info("Redis job store initialized successfully")
        except ImportError:
            logger.warning("redis package not installed, using memory store")
            self._redis_client = None
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}, using memory store")
            self._redis_client = None

    def _job_key(self, job_id: str) -> str:
        """Get Redis key for a job."""
        return f"ai-agent:job:{job_id}"

    def create_job(self, job_id: str) -> JobResult:
        """Create a new job.

        Args:
            job_id: Unique job identifier

        Returns:
            JobResult for the new job
        """
        now = datetime.utcnow()
        job = JobResult(
            job_id=job_id,
            status=JobStatus.PENDING,
            created_at=now,
        )

        self._save_job(job)
        return job

    def get_job(self, job_id: str) -> Optional[JobResult]:
        """Get a job by ID.

        Args:
            job_id: Job identifier

        Returns:
            JobResult or None if not found
        """
        if self._redis_client:
            try:
                data = self._redis_client.get(self._job_key(job_id))
                if data:
                    return self._deserialize_job(data)
            except Exception as e:
                logger.error(f"Redis get failed: {e}")

        # Fallback to memory
        if job_id in self._memory_store:
            return self._dict_to_job(self._memory_store[job_id])

        return None

    def update_job(
        self,
        job_id: str,
        status: Optional[JobStatus] = None,
        result: Optional[dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> Optional[JobResult]:
        """Update a job.

        Args:
            job_id: Job identifier
            status: New status
            result: Job result data
            error: Error message

        Returns:
            Updated JobResult or None if not found
        """
        job = self.get_job(job_id)
        if not job:
            return None

        if status:
            job.status = status
            if status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                job.completed_at = datetime.utcnow()

        if result is not None:
            job.result = result

        if error is not None:
            job.error = error

        self._save_job(job)
        return job

    def mark_running(self, job_id: str) -> Optional[JobResult]:
        """Mark a job as running."""
        return self.update_job(job_id, status=JobStatus.RUNNING)

    def mark_completed(
        self, job_id: str, result: dict[str, Any]
    ) -> Optional[JobResult]:
        """Mark a job as completed with result."""
        return self.update_job(job_id, status=JobStatus.COMPLETED, result=result)

    def mark_failed(self, job_id: str, error: str) -> Optional[JobResult]:
        """Mark a job as failed with error."""
        return self.update_job(job_id, status=JobStatus.FAILED, error=error)

    def delete_job(self, job_id: str) -> bool:
        """Delete a job.

        Args:
            job_id: Job identifier

        Returns:
            True if deleted, False if not found
        """
        if self._redis_client:
            try:
                result = self._redis_client.delete(self._job_key(job_id))
                if result:
                    self._memory_store.pop(job_id, None)
                    return True
            except Exception as e:
                logger.error(f"Redis delete failed: {e}")

        if job_id in self._memory_store:
            del self._memory_store[job_id]
            return True

        return False

    def list_jobs(
        self,
        status: Optional[JobStatus] = None,
        limit: int = 100,
    ) -> list[JobResult]:
        """List jobs, optionally filtered by status.

        Args:
            status: Filter by status
            limit: Maximum number of jobs to return

        Returns:
            List of JobResult objects
        """
        jobs = []

        if self._redis_client:
            try:
                # Scan for job keys
                cursor = 0
                pattern = "ai-agent:job:*"
                while True:
                    cursor, keys = self._redis_client.scan(
                        cursor, match=pattern, count=100
                    )
                    for key in keys:
                        data = self._redis_client.get(key)
                        if data:
                            job = self._deserialize_job(data)
                            if status is None or job.status == status:
                                jobs.append(job)
                                if len(jobs) >= limit:
                                    break
                    if cursor == 0 or len(jobs) >= limit:
                        break
            except Exception as e:
                logger.error(f"Redis scan failed: {e}")

        # Also check memory store
        for job_data in self._memory_store.values():
            job = self._dict_to_job(job_data)
            if status is None or job.status == status:
                if not any(j.job_id == job.job_id for j in jobs):
                    jobs.append(job)
                    if len(jobs) >= limit:
                        break

        # Sort by created_at descending
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        return jobs[:limit]

    def _save_job(self, job: JobResult) -> None:
        """Save a job to storage."""
        job_dict = self._job_to_dict(job)

        # Always save to memory as fallback
        self._memory_store[job.job_id] = job_dict

        if self._redis_client:
            try:
                data = json.dumps(job_dict)
                self._redis_client.setex(
                    self._job_key(job.job_id),
                    self._ttl_seconds,
                    data,
                )
            except Exception as e:
                logger.error(f"Redis save failed: {e}")

    def _job_to_dict(self, job: JobResult) -> dict[str, Any]:
        """Convert JobResult to dictionary."""
        return {
            "job_id": job.job_id,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "result": job.result,
            "error": job.error,
        }

    def _dict_to_job(self, data: dict[str, Any]) -> JobResult:
        """Convert dictionary to JobResult."""
        return JobResult(
            job_id=data["job_id"],
            status=JobStatus(data["status"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            completed_at=(
                datetime.fromisoformat(data["completed_at"])
                if data.get("completed_at")
                else None
            ),
            result=data.get("result"),
            error=data.get("error"),
        )

    def _deserialize_job(self, data: str) -> JobResult:
        """Deserialize job from JSON string."""
        return self._dict_to_job(json.loads(data))


# Global job store instance
_job_store: Optional[JobStore] = None


def get_job_store() -> JobStore:
    """Get the global job store instance."""
    global _job_store
    if _job_store is None:
        _job_store = JobStore(use_redis=True)
    return _job_store
