import time
from typing import List, Optional
from datetime import datetime

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/services", tags=["services"])


class ServiceHealth(BaseModel):
    name: str
    status: str  # 'Stopped' | 'Starting' | 'Running' | 'Unhealthy' | 'Stopping' | 'Error'
    response_time_ms: Optional[int] = None
    details: Optional[dict] = None
    error: Optional[str] = None
    checked_at: float


class ServiceUrls(BaseModel):
    ai_agent: str
    test_runner: str


async def check_service(name: str, url: str) -> ServiceHealth:
    """Check health of a single service"""
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{url}/health")
            response_time_ms = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                data = response.json()
                return ServiceHealth(
                    name=name,
                    status="Running",
                    response_time_ms=response_time_ms,
                    details=data,
                    checked_at=time.time(),
                )
            else:
                return ServiceHealth(
                    name=name,
                    status="Unhealthy",
                    response_time_ms=response_time_ms,
                    error=f"Status code: {response.status_code}",
                    checked_at=time.time(),
                )
    except httpx.ConnectError:
        return ServiceHealth(
            name=name,
            status="Stopped",
            error="Connection refused",
            checked_at=time.time(),
        )
    except Exception as e:
        return ServiceHealth(
            name=name,
            status="Error",
            error=str(e),
            checked_at=time.time(),
        )


@router.get("/health/{service_name}", response_model=ServiceHealth)
async def check_service_health(service_name: str):
    """Check health of a specific service"""
    service_urls = {
        "ai_agent": settings.ai_agent_url,
        "test_runner": settings.test_runner_url,
    }

    if service_name not in service_urls:
        return ServiceHealth(
            name=service_name,
            status="Error",
            error="Unknown service",
            checked_at=time.time(),
        )

    return await check_service(service_name, service_urls[service_name])


@router.get("/health", response_model=List[ServiceHealth])
async def check_all_services_health():
    """Check health of all services"""
    services = [
        ("ai_agent", settings.ai_agent_url),
        ("test_runner", settings.test_runner_url),
    ]

    results = []
    for name, url in services:
        health = await check_service(name, url)
        results.append(health)

    return results


@router.get("/urls", response_model=ServiceUrls)
async def get_service_urls():
    """Get service URLs"""
    return ServiceUrls(
        ai_agent=settings.ai_agent_url,
        test_runner=settings.test_runner_url,
    )
