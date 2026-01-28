import subprocess
import asyncio
import base64
import tempfile
import os
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/mobile", tags=["mobile"])


# ============================================
# Models
# ============================================


class DeviceInfo(BaseModel):
    id: str
    name: str
    status: str
    platform: str  # 'android' | 'ios'


class ScreenshotResponse(BaseModel):
    screenshot: str  # base64 encoded


class TapRequest(BaseModel):
    x: int
    y: int


class SwipeRequest(BaseModel):
    start_x: int
    start_y: int
    end_x: int
    end_y: int
    duration_ms: int = 300


class InputTextRequest(BaseModel):
    text: str


class KeyEventRequest(BaseModel):
    keycode: int


class AppRequest(BaseModel):
    package: str  # package name for Android, bundle ID for iOS


# ============================================
# Android (ADB) Commands
# ============================================


async def run_adb_command(args: List[str], device_id: Optional[str] = None) -> str:
    """Run an ADB command"""
    cmd = ["adb"]
    if device_id:
        cmd.extend(["-s", device_id])
    cmd.extend(args)

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise HTTPException(
                status_code=500, detail=f"ADB error: {stderr.decode()}"
            )
        return stdout.decode()
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="ADB not found in PATH")


@router.get("/android/devices", response_model=List[DeviceInfo])
async def list_android_devices():
    """List connected Android devices"""
    output = await run_adb_command(["devices", "-l"])
    devices = []

    for line in output.strip().split("\n")[1:]:  # Skip header
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 2:
            device_id = parts[0]
            status = parts[1]
            name = ""
            for part in parts[2:]:
                if part.startswith("model:"):
                    name = part.split(":")[1]
                    break

            devices.append(
                DeviceInfo(
                    id=device_id,
                    name=name or device_id,
                    status=status,
                    platform="android",
                )
            )

    return devices


@router.get("/android/{device_id}/screenshot", response_model=ScreenshotResponse)
async def android_screenshot(device_id: str):
    """Take a screenshot from an Android device"""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        temp_path = f.name

    try:
        # Take screenshot on device
        await run_adb_command(["shell", "screencap", "-p", "/sdcard/screenshot.png"], device_id)
        # Pull to local
        await run_adb_command(["pull", "/sdcard/screenshot.png", temp_path], device_id)
        # Clean up device
        await run_adb_command(["shell", "rm", "/sdcard/screenshot.png"], device_id)

        with open(temp_path, "rb") as f:
            screenshot_data = base64.b64encode(f.read()).decode()

        return ScreenshotResponse(screenshot=screenshot_data)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@router.post("/android/{device_id}/tap")
async def android_tap(device_id: str, request: TapRequest):
    """Tap on the screen"""
    await run_adb_command(
        ["shell", "input", "tap", str(request.x), str(request.y)], device_id
    )
    return {"status": "ok"}


@router.post("/android/{device_id}/swipe")
async def android_swipe(device_id: str, request: SwipeRequest):
    """Swipe on the screen"""
    await run_adb_command(
        [
            "shell",
            "input",
            "swipe",
            str(request.start_x),
            str(request.start_y),
            str(request.end_x),
            str(request.end_y),
            str(request.duration_ms),
        ],
        device_id,
    )
    return {"status": "ok"}


@router.post("/android/{device_id}/input")
async def android_input_text(device_id: str, request: InputTextRequest):
    """Input text"""
    # Escape special characters
    text = request.text.replace(" ", "%s").replace("&", "\\&")
    await run_adb_command(["shell", "input", "text", text], device_id)
    return {"status": "ok"}


@router.post("/android/{device_id}/keyevent")
async def android_keyevent(device_id: str, request: KeyEventRequest):
    """Send a key event"""
    await run_adb_command(
        ["shell", "input", "keyevent", str(request.keycode)], device_id
    )
    return {"status": "ok"}


@router.post("/android/{device_id}/launch")
async def android_launch_app(device_id: str, request: AppRequest):
    """Launch an app"""
    await run_adb_command(
        ["shell", "monkey", "-p", request.package, "-c", "android.intent.category.LAUNCHER", "1"],
        device_id,
    )
    return {"status": "ok"}


@router.post("/android/{device_id}/stop")
async def android_stop_app(device_id: str, request: AppRequest):
    """Stop an app"""
    await run_adb_command(["shell", "am", "force-stop", request.package], device_id)
    return {"status": "ok"}


@router.post("/android/{device_id}/clear")
async def android_clear_app(device_id: str, request: AppRequest):
    """Clear app data"""
    await run_adb_command(["shell", "pm", "clear", request.package], device_id)
    return {"status": "ok"}


@router.get("/android/{device_id}/ui-dump")
async def android_dump_ui(device_id: str):
    """Dump UI hierarchy"""
    # Dump UI on device
    await run_adb_command(
        ["shell", "uiautomator", "dump", "/sdcard/ui.xml"], device_id
    )
    # Get content
    output = await run_adb_command(["shell", "cat", "/sdcard/ui.xml"], device_id)
    # Clean up
    await run_adb_command(["shell", "rm", "/sdcard/ui.xml"], device_id)
    return {"xml": output}


# ============================================
# iOS (Simulator) Commands
# ============================================


async def run_xcrun_command(args: List[str]) -> str:
    """Run an xcrun simctl command"""
    cmd = ["xcrun", "simctl"] + args

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise HTTPException(
                status_code=500, detail=f"xcrun error: {stderr.decode()}"
            )
        return stdout.decode()
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="xcrun not found (requires Xcode)")


@router.get("/ios/devices", response_model=List[DeviceInfo])
async def list_ios_devices():
    """List iOS simulators"""
    import json

    output = await run_xcrun_command(["list", "devices", "-j"])
    data = json.loads(output)

    devices = []
    for runtime, device_list in data.get("devices", {}).items():
        for device in device_list:
            devices.append(
                DeviceInfo(
                    id=device["udid"],
                    name=device["name"],
                    status=device["state"].lower(),
                    platform="ios",
                )
            )

    return devices


@router.post("/ios/{device_id}/boot")
async def ios_boot_simulator(device_id: str):
    """Boot an iOS simulator"""
    await run_xcrun_command(["boot", device_id])
    return {"status": "ok"}


@router.post("/ios/{device_id}/shutdown")
async def ios_shutdown_simulator(device_id: str):
    """Shutdown an iOS simulator"""
    await run_xcrun_command(["shutdown", device_id])
    return {"status": "ok"}


@router.get("/ios/{device_id}/screenshot", response_model=ScreenshotResponse)
async def ios_screenshot(device_id: str):
    """Take a screenshot from an iOS simulator"""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        temp_path = f.name

    try:
        await run_xcrun_command(["io", device_id, "screenshot", temp_path])

        with open(temp_path, "rb") as f:
            screenshot_data = base64.b64encode(f.read()).decode()

        return ScreenshotResponse(screenshot=screenshot_data)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@router.post("/ios/{device_id}/tap")
async def ios_tap(device_id: str, request: TapRequest):
    """Tap on the iOS simulator screen"""
    # Use AppleScript to send click events
    script = f'''
    tell application "Simulator"
        activate
    end tell
    tell application "System Events"
        click at {{{request.x}, {request.y}}}
    end tell
    '''
    process = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await process.communicate()
    return {"status": "ok"}


@router.post("/ios/{device_id}/input")
async def ios_input_text(device_id: str, request: InputTextRequest):
    """Input text on iOS simulator"""
    await run_xcrun_command(["io", device_id, "type", request.text])
    return {"status": "ok"}


@router.post("/ios/{device_id}/launch")
async def ios_launch_app(device_id: str, request: AppRequest):
    """Launch an app on iOS simulator"""
    await run_xcrun_command(["launch", device_id, request.package])
    return {"status": "ok"}


@router.post("/ios/{device_id}/terminate")
async def ios_terminate_app(device_id: str, request: AppRequest):
    """Terminate an app on iOS simulator"""
    await run_xcrun_command(["terminate", device_id, request.package])
    return {"status": "ok"}
