import ctypes
import os
import shutil
import subprocess
import sys
import time
from ctypes import wintypes
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

import database


WINDOW_TITLE = "WORK TRACKER"
WINDOW_PROPERTY = "WorkTrackerNativeWindow"
WINDOW_URL = os.environ.get(
    "WORKTRACKER_WINDOW_URL",
    "https://perorwn.github.io/WorkTracker/?window=1&native=1",
)
MUTEX_NAME = "WorkTracker_NativeWindow_SingleInstance"
DEFAULT_WIDTH = 1000
DEFAULT_HEIGHT = 260
MIN_WIDTH = 960
MIN_HEIGHT = 210

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

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


def repair_previous_title_match():
    if database.get_setting("window_identity_version") == "2":
        return

    saved_x = database.get_setting("window_x")
    saved_y = database.get_setting("window_y")
    saved_width = database.get_setting("window_width")
    saved_height = database.get_setting("window_height")
    try:
        expected = tuple(map(int, (saved_x, saved_y, saved_width, saved_height)))
    except (TypeError, ValueError):
        expected = None

    if expected is not None:
        callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

        def visit(hwnd, _):
            length = user32.GetWindowTextLengthW(hwnd)
            if length <= 0:
                return True
            buffer = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buffer, length + 1)
            if buffer.value != WINDOW_TITLE or user32.GetPropW(hwnd, WINDOW_PROPERTY):
                return True
            rect = RECT()
            if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
                return True
            actual = (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
            if all(abs(left - right) <= 4 for left, right in zip(actual, expected)):
                user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010)
                user32.ShowWindow(hwnd, SW_MAXIMIZE)
                return False
            return True

        user32.EnumWindows(callback_type(visit), 0)

    database.set_setting("window_identity_version", "2")


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
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def bring_to_front(hwnd):
    if hwnd:
        user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)


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

    repair_previous_title_match()
    hwnd = find_managed_window()
    if hwnd is None:
        edge = find_edge()
        if not edge:
            kernel32.CloseHandle(mutex)
            return

        existing_chromium_windows = set(chromium_app_windows())
        window_token = uuid4().hex
        subprocess.Popen(
            [edge, f"--app={window_url_with_token(window_token)}", "--new-window"],
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
