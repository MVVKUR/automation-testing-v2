#!/usr/bin/env python3
"""
iOS Simulator Touch Helper
Uses Quartz to send touch events to the iOS Simulator
"""

import sys
import subprocess
import time
import json

def get_simulator_window_info():
    """Get the Simulator window bounds using screencapture metadata"""
    try:
        # Get window list using screencapture
        result = subprocess.run(
            ['osascript', '-e', '''
            tell application "Simulator"
                activate
            end tell
            delay 0.3
            tell application "System Events"
                tell process "Simulator"
                    set frontWin to front window
                    set winPos to position of frontWin
                    set winSize to size of frontWin
                    return (item 1 of winPos as text) & "," & (item 2 of winPos as text) & "," & (item 1 of winSize as text) & "," & (item 2 of winSize as text)
                end tell
            end tell
            '''],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(',')
            return {
                'x': int(parts[0]),
                'y': int(parts[1]),
                'width': int(parts[2]),
                'height': int(parts[3])
            }
    except Exception as e:
        print(f"Error getting window info: {e}", file=sys.stderr)
    return None

def tap_simulator(x, y, device_udid=None):
    """Tap at coordinates in the simulator using cliclick"""
    try:
        # First, try using cliclick if available
        result = subprocess.run(['which', 'cliclick'], capture_output=True)
        if result.returncode == 0:
            # cliclick is available, use it
            subprocess.run(['cliclick', f'c:{x},{y}'], check=True)
            return {'success': True, 'method': 'cliclick'}
    except Exception:
        pass

    # Fallback: Use osascript to click (requires accessibility permissions)
    try:
        script = f'''
        tell application "Simulator"
            activate
        end tell
        delay 0.2
        tell application "System Events"
            click at {{{x}, {y}}}
        end tell
        '''
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return {'success': True, 'method': 'osascript'}
        else:
            return {'success': False, 'error': result.stderr}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def input_text(text, device_udid=None):
    """Input text into the simulator"""
    try:
        # Use simctl to paste text via pasteboard
        subprocess.run(['xcrun', 'simctl', 'pbcopy', 'booted'], input=text.encode(), check=True)
        # Then paste using keyboard shortcut
        subprocess.run(['osascript', '-e', '''
        tell application "Simulator"
            activate
        end tell
        delay 0.1
        tell application "System Events"
            keystroke "v" using command down
        end tell
        '''], check=True, timeout=10)
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def swipe(x1, y1, x2, y2, duration_ms=300, device_udid=None):
    """Swipe from (x1,y1) to (x2,y2)"""
    try:
        # Use cliclick for drag if available
        result = subprocess.run(['which', 'cliclick'], capture_output=True)
        if result.returncode == 0:
            subprocess.run(['cliclick', f'dd:{x1},{y1}', f'du:{x2},{y2}'], check=True)
            return {'success': True, 'method': 'cliclick'}
    except Exception:
        pass

    return {'success': False, 'error': 'Swipe not supported without cliclick'}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No command specified'}))
        sys.exit(1)

    command = sys.argv[1]

    if command == 'tap':
        if len(sys.argv) < 4:
            print(json.dumps({'error': 'tap requires x and y coordinates'}))
            sys.exit(1)
        x, y = int(sys.argv[2]), int(sys.argv[3])
        udid = sys.argv[4] if len(sys.argv) > 4 else None
        result = tap_simulator(x, y, udid)
        print(json.dumps(result))

    elif command == 'text':
        if len(sys.argv) < 3:
            print(json.dumps({'error': 'text requires input string'}))
            sys.exit(1)
        text = sys.argv[2]
        udid = sys.argv[3] if len(sys.argv) > 3 else None
        result = input_text(text, udid)
        print(json.dumps(result))

    elif command == 'swipe':
        if len(sys.argv) < 6:
            print(json.dumps({'error': 'swipe requires x1, y1, x2, y2'}))
            sys.exit(1)
        x1, y1, x2, y2 = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
        udid = sys.argv[6] if len(sys.argv) > 6 else None
        result = swipe(x1, y1, x2, y2, device_udid=udid)
        print(json.dumps(result))

    elif command == 'window_info':
        info = get_simulator_window_info()
        print(json.dumps(info or {'error': 'Could not get window info'}))

    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))
        sys.exit(1)

if __name__ == '__main__':
    main()
