import ctypes
import json
import os
import shutil
import subprocess
import sys
import time
import threading
from ctypes import wintypes
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import urlopen
from uuid import uuid4

import database


WINDOW_TITLE = "WORK TRACKER"
WINDOW_PROPERTY = "WorkTrackerLocalWindowV4"
WINDOW_URL = os.environ.get(
    "WORKTRACKER_WINDOW_URL",
    "http://127.0.0.1:8765/?window=1&native=1",
)
EDGE_PROFILE_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "WorkTracker" / "EdgeProfile"
MUTEX_NAME = "WorkTracker_NativeWindow_SingleInstance"
DEFAULT_WIDTH = 1200
DEFAULT_HEIGHT = 260
MIN_WIDTH = 1160
MIN_HEIGHT = 210

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
dwmapi = ctypes.windll.dwmapi
dwmapi.DwmSetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD]
dwmapi.DwmSetWindowAttribute.restype = ctypes.c_long

kernel32.CreateMutexW.restype = wintypes.HANDLE
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
user32.SetWindowPos.argtypes = [
    wintypes.HWND,
    wintypes.HWND,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    wintypes.UINT,
]
user32.SetWindowPos.restype = wintypes.BOOL
user32.GetPropW.argtypes = [wintypes.HWND, wintypes.LPCWSTR]
user32.GetPropW.restype = wintypes.HANDLE
user32.SetPropW.argtypes = [wintypes.HWND, wintypes.LPCWSTR, wintypes.HANDLE]
user32.SetPropW.restype = wintypes.BOOL
user32.RemovePropW.argtypes = [wintypes.HWND, wintypes.LPCWSTR]
user32.RemovePropW.restype = wintypes.HANDLE
user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
user32.GetWindowLongW.restype = ctypes.c_long
user32.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]
user32.SetWindowLongW.restype = ctypes.c_long
user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]

HWND_TOPMOST = -1
HWND_NOTOPMOST = -2
SW_RESTORE = 9
SW_MAXIMIZE = 3
SWP_SHOWWINDOW = 0x0040
SWP_NOZORDER = 0x0004
MONITOR_DEFAULTTONEAREST = 2


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", wintypes.LONG),
        ("top", wintypes.LONG),
        ("right", wintypes.LONG),
        ("bottom", wintypes.LONG),
    ]


class MONITORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("rcMonitor", RECT),
        ("rcWork", RECT),
        ("dwFlags", wintypes.DWORD),
    ]


def read_int_setting(key, default, minimum=None):
    try:
        value = int(database.get_setting(key, default))
    except (TypeError, ValueError):
        value = default
    if minimum is not None:
        value = max(minimum, value)
    return value


def find_edge():
    candidates = [
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/Edge/Application/msedge.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return shutil.which("msedge")


def find_window(marker=WINDOW_TITLE, exact=True):
    matches = []
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def visit(hwnd, _):
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        matches_marker = buffer.value == marker if exact else marker in buffer.value
        if matches_marker:
            matches.append(hwnd)
            return False
        return True

    user32.EnumWindows(callback_type(visit), 0)
    return matches[0] if matches else None


def repair_previous_window_identity():
    if database.get_setting("window_identity_version") == "3":
        return
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def visit(hwnd, _):
        if not user32.GetPropW(hwnd, WINDOW_PROPERTY):
            return True
        user32.RemovePropW(hwnd, WINDOW_PROPERTY)
        user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010)
        user32.ShowWindow(hwnd, SW_MAXIMIZE)
        return True

    user32.EnumWindows(callback_type(visit), 0)
    database.set_setting("window_identity_version", "3")


def find_managed_window():
    matches = []
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def visit(hwnd, _):
        if user32.GetPropW(hwnd, WINDOW_PROPERTY):
            matches.append(hwnd)
            return False
        return True

    user32.EnumWindows(callback_type(visit), 0)
    return matches[0] if matches else None


def chromium_app_windows():
    matches = []
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def visit(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        class_name = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, class_name, len(class_name))
        if class_name.value == "Chrome_WidgetWin_1":
            matches.append(hwnd)
        return True

    user32.EnumWindows(callback_type(visit), 0)
    return matches


def window_url_with_token(token):
    parts = urlsplit(WINDOW_URL)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["windowToken"] = token
    query["theme"] = database.get_setting("window_theme", "light")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def bring_to_front(hwnd):
    if hwnd:
        user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)


def hide_native_titlebar(hwnd):
    style = user32.GetWindowLongW(hwnd, -16)
    # Keep the resize frame, system menu and taskbar behavior.
    user32.SetWindowLongW(hwnd, -16, style & ~0x00C00000)  # WS_CAPTION
    user32.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x0020 | 0x0001 | 0x0002 | 0x0004 | 0x0010)


def control_managed_window(action):
    hwnd = find_managed_window()
    if not hwnd:
        return False
    if action == "titlebar-ready":
        hide_native_titlebar(hwnd)
    elif action == "move":
        # Only start a native move while the user still holds the left button.
        if not user32.GetAsyncKeyState(0x01) & 0x8000:
            return False
        user32.ReleaseCapture()
        user32.PostMessageW(hwnd, 0x0112, 0xF012, 0)  # SC_MOVE | HTCAPTION
    elif action == "minimize":
        user32.PostMessageW(hwnd, 0x0112, 0xF020, 0)
    elif action == "close":
        user32.PostMessageW(hwnd, 0x0010, 0, 0)  # Only the managed window, not tracking.
    else:
        raise ValueError("invalid window control")
    return True


def apply_titlebar_theme(hwnd, theme):
    dark = theme == "dark"
    # COLORREF stores red in the least-significant byte (0x00BBGGRR).
    attributes = {
        20: 1 if dark else 0,  # DWMWA_USE_IMMERSIVE_DARK_MODE
        35: 0x001B1714 if dark else 0x00FFFFFF,  # DWMWA_CAPTION_COLOR
        36: 0x00F5F5F5 if dark else 0x0026201C,  # DWMWA_TEXT_COLOR
    }
    for attribute, value in attributes.items():
        setting = wintypes.DWORD(value)
        dwmapi.DwmSetWindowAttribute(hwnd, attribute, ctypes.byref(setting), ctypes.sizeof(setting))


def follow_titlebar_theme(hwnd):
    previous = None
    while user32.IsWindow(hwnd):
        try:
            # The same push stream as the web view keeps both surfaces in sync.
            with urlopen("http://127.0.0.1:8765/theme-events", timeout=30) as events:
                for line in events:
                    if not user32.IsWindow(hwnd):
                        return
                    if not line.startswith(b"data: "):
                        continue
                    theme = json.loads(line[6:]).get("theme")
                    if theme in ("dark", "light") and theme != previous:
                        apply_titlebar_theme(hwnd, theme)
                        previous = theme
        except (OSError, ValueError):
            # Also supports an older tracker until it is restarted.
            theme = database.get_setting("window_theme", "light")
            if theme != previous and user32.IsWindow(hwnd):
                apply_titlebar_theme(hwnd, theme)
                previous = theme
            time.sleep(1)


def monitor_work_area(rect):
    monitor = user32.MonitorFromRect(ctypes.byref(rect), MONITOR_DEFAULTTONEAREST)
    info = MONITORINFO(cbSize=ctypes.sizeof(MONITORINFO))
    if monitor and user32.GetMonitorInfoW(monitor, ctypes.byref(info)):
        return info.rcWork
    return RECT(0, 0, user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))


def restored_bounds():
    width = read_int_setting("window_width", DEFAULT_WIDTH, MIN_WIDTH)
    height = read_int_setting("window_height", DEFAULT_HEIGHT, MIN_HEIGHT)
    saved_x = database.get_setting("window_x")
    saved_y = database.get_setting("window_y")

    if saved_x is None or saved_y is None:
        work = monitor_work_area(RECT(0, 0, width, height))
        return work.right - width - 16, work.bottom - height - 16, width, height

    try:
        x = int(saved_x)
        y = int(saved_y)
    except (TypeError, ValueError):
        x = 0
        y = 0

    work = monitor_work_area(RECT(x, y, x + width, y + height))
    width = min(width, work.right - work.left)
    height = min(height, work.bottom - work.top)
    x = max(work.left, min(x, work.right - width))
    y = max(work.top, min(y, work.bottom - height))
    return x, y, width, height


def save_bounds(hwnd):
    if not hwnd or user32.IsIconic(hwnd):
        return None
    rect = RECT()
    if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return None
    bounds = (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
    database.set_settings({
        "window_x": bounds[0],
        "window_y": bounds[1],
        "window_width": bounds[2],
        "window_height": bounds[3],
    })
    return bounds


def main():
    mutex = kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if kernel32.GetLastError() == 183:
        bring_to_front(find_managed_window())
        kernel32.CloseHandle(mutex)
        return

    repair_previous_window_identity()
    hwnd = find_managed_window()
    if hwnd is None:
        edge = find_edge()
        if not edge:
            kernel32.CloseHandle(mutex)
            return

        existing_chromium_windows = set(chromium_app_windows())
        window_token = uuid4().hex
        EDGE_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        subprocess.Popen(
            [
                edge,
                f"--user-data-dir={EDGE_PROFILE_DIR}",
                "--no-first-run",
                "--disable-default-apps",
                f"--app={window_url_with_token(window_token)}",
                "--new-window",
            ],
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

        deadline = time.time() + 20
        while time.time() < deadline and hwnd is None:
            hwnd = find_window(window_token, exact=False)
            if hwnd is None:
                new_windows = [
                    candidate
                    for candidate in chromium_app_windows()
                    if candidate not in existing_chromium_windows
                ]
                if new_windows:
                    hwnd = new_windows[0]
            time.sleep(0.1)

    if hwnd is None:
        kernel32.CloseHandle(mutex)
        return

    user32.SetPropW(hwnd, WINDOW_PROPERTY, wintypes.HANDLE(1))
    user32.SetWindowTextW(hwnd, WINDOW_TITLE)
    apply_titlebar_theme(hwnd, database.get_setting("window_theme", "light"))
    threading.Thread(target=follow_titlebar_theme, args=(hwnd,), daemon=True).start()
    x, y, width, height = restored_bounds()
    user32.SetWindowPos(
        hwnd,
        HWND_TOPMOST,
        x,
        y,
        width,
        height,
        SWP_SHOWWINDOW,
    )
    bring_to_front(hwnd)

    last_bounds = None
    while user32.IsWindow(hwnd):
        rect = RECT()
        if not user32.IsIconic(hwnd) and user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            bounds = (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
            if bounds[2] < MIN_WIDTH or bounds[3] < MIN_HEIGHT:
                user32.SetWindowPos(
                    hwnd,
                    0,
                    bounds[0],
                    bounds[1],
                    max(MIN_WIDTH, bounds[2]),
                    max(MIN_HEIGHT, bounds[3]),
                    SWP_SHOWWINDOW | SWP_NOZORDER,
                )
                time.sleep(0.1)
                continue
            if bounds != last_bounds:
                save_bounds(hwnd)
                last_bounds = bounds
        time.sleep(0.5)

    kernel32.CloseHandle(mutex)


if __name__ == "__main__":
    main()
