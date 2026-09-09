import time
import ctypes
import threading
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from ctypes import wintypes
from datetime import datetime, timedelta

import database
from sync import sync_database

import pystray
from PIL import Image, ImageDraw
import sys

MUTEX_NAME = "WorkTracker_SingleInstance"

mutex = ctypes.windll.kernel32.CreateMutexW(
    None,
    False,
    MUTEX_NAME
)

if ctypes.windll.kernel32.GetLastError() == 183:
    # 이미 실행 중
    sys.exit(0)

# ========================================
# 설정
# ========================================

IDLE_LIMIT = 10

# Supabase 동기화 주기
SYNC_INTERVAL = 5
sync_lock = threading.Lock()


# ========================================
# 프로그램 상태
# ========================================

current_status = "시작 중"
is_running = True
live_state_lock = threading.Lock()
live_state = {
    "running": True,
    "working": False,
    "date": "",
    "hour": 0,
    "seconds": 0,
    "hours": [0] * 24,
    "mode": "tracking",
    "hotkeys": [False] * 4,
}

WINDOW_MODES = ("tracking", "pomodoro", "timer", "stopwatch")


# ========================================
# 로컬 창모드 상태 API
# ========================================

class LiveStateHandler(BaseHTTPRequestHandler):

    def _send_headers(self, status=200, content_type="application/json"):
        origin = self.headers.get("Origin", "")
        self.send_response(status)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        if origin in {
            "https://perorwn.github.io",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        }:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._send_headers(204)

    def do_GET(self):
        if self.path.rstrip("/") != "/status":
            self._send_headers(404)
            return
        with live_state_lock:
            payload = json.dumps(live_state, ensure_ascii=False).encode("utf-8")
        self._send_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if self.path.rstrip("/") != "/mode":
            self._send_headers(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            mode = payload.get("mode")
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self._send_headers(400)
            return
        if mode not in WINDOW_MODES:
            self._send_headers(400)
            return
        set_window_mode(mode)
        response = json.dumps({"mode": mode}).encode("utf-8")
        self._send_headers()
        self.wfile.write(response)

    def log_message(self, format, *args):
        return


def run_live_state_server():
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 8765), LiveStateHandler)
        server.serve_forever()
    except OSError as error:
        print(f">>> 로컬 창모드 서버 시작 실패: {error}")


def update_live_state(now, working):
    date = now.strftime("%Y-%m-%d")
    hourly = database.get_hourly_data(date)
    hours = [int(hourly.get(hour, 0)) for hour in range(24)]
    with live_state_lock:
        live_state.update({
            "working": working,
            "date": date,
            "hour": now.hour,
            "seconds": hours[now.hour],
            "hours": hours,
        })


def set_window_mode(mode):
    with live_state_lock:
        live_state["mode"] = mode


def run_global_hotkeys():
    user32 = ctypes.windll.user32
    hotkey_base_id = 4100
    modifiers = 0x0002 | 0x0004 | 0x4000  # Ctrl + Shift + no repeat
    first_function_key = 0x70  # F1

    registrations = []
    for index in range(4):
        registered = bool(user32.RegisterHotKey(
            None,
            hotkey_base_id + index,
            modifiers,
            first_function_key + index,
        ))
        registrations.append(registered)
        if not registered:
            print(f">>> Ctrl+Shift+F{index + 1} 단축키 등록 실패")

    with live_state_lock:
        live_state["hotkeys"] = registrations

    message = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(message), None, 0, 0) != 0:
        if message.message == 0x0312:  # WM_HOTKEY
            index = int(message.wParam) - hotkey_base_id
            if 0 <= index < len(WINDOW_MODES):
                set_window_mode(WINDOW_MODES[index])


# ========================================
# Windows 입력 정보
# ========================================

class LASTINPUTINFO(ctypes.Structure):

    _fields_ = [
        ("cbSize", ctypes.c_uint),
        ("dwTime", ctypes.c_uint),
    ]


def get_idle_seconds():

    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)

    success = ctypes.windll.user32.GetLastInputInfo(
        ctypes.byref(lii)
    )

    if not success:
        return 0.0

    current_tick = (
        ctypes.windll.kernel32.GetTickCount()
    )

    idle_milliseconds = (
        current_tick - lii.dwTime
    )

    if idle_milliseconds < 0:
        idle_milliseconds += 2**32

    return idle_milliseconds / 1000.0


# ========================================
# 활성 창
# ========================================

def get_active_window_title():

    hwnd = (
        ctypes.windll.user32.GetForegroundWindow()
    )

    buffer = ctypes.create_unicode_buffer(512)

    ctypes.windll.user32.GetWindowTextW(
        hwnd,
        buffer,
        512
    )

    return buffer.value


# ========================================
# 트레이 아이콘 이미지
# ========================================

def create_icon_image():

    image = Image.new(
        "RGB",
        (64, 64),
        "white"
    )

    draw = ImageDraw.Draw(image)

    # 간단한 시계 모양 아이콘
    draw.ellipse(
        (8, 8, 56, 56),
        outline="black",
        width=4
    )

    draw.line(
        (32, 32, 32, 18),
        fill="black",
        width=4
    )

    draw.line(
        (32, 32, 44, 38),
        fill="black",
        width=4
    )

    return image


# ========================================
# 트레이 메뉴
# ========================================

def get_status_text(icon):

    return current_status


def quit_program(icon, item):

    global is_running

    is_running = False

    icon.stop()


def create_tray_icon():

    image = create_icon_image()

    menu = pystray.Menu(
        pystray.MenuItem(
            "현재 상태",
            get_status_text,
            enabled=False
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(
            "WorkTracker 종료",
            quit_program
        )
    )

    icon = pystray.Icon(
        "WorkTracker",
        image,
        "WorkTracker",
        menu
    )

    return icon


# ========================================
# 작업시간 측정
# ========================================

def sync_in_background():

    if not sync_lock.acquire(blocking=False):
        return

    try:
        sync_database()
    except Exception as error:
        print(">>> Supabase 동기화 실패: " f"{error}")
    finally:
        sync_lock.release()

def tracking_loop():

    global current_status
    global is_running

    print("WorkTracker 시작")
    print(f"무입력 제한시간: {IDLE_LIMIT}초")
    print()
    print("조건:")
    print("  1. Clip Studio Paint가 활성 창")
    print("  2. 마지막 입력 후 10초 이내")
    print()

    # ====================================
    # 상태
    # ====================================

    last_check = datetime.now()

    was_working = False

    work_start = None

    # 마지막 Supabase 동기화 시간
    last_sync = datetime.now()

    # ====================================
    # 메인 루프
    # ====================================

    while is_running:

        now = datetime.now()

        # --------------------------------
        # Supabase 자동 동기화
        # --------------------------------

        if (
            now - last_sync
        ).total_seconds() >= SYNC_INTERVAL:

            threading.Thread(
                target=sync_in_background,
                daemon=True,
            ).start()

            last_sync = now

        # --------------------------------
        # 활성 창
        # --------------------------------

        title = get_active_window_title()

        is_csp = (
            "CLIP STUDIO PAINT"
            in title.upper()
        )

        # --------------------------------
        # 입력 상태
        # --------------------------------

        idle_seconds = get_idle_seconds()

        has_recent_input = (
            idle_seconds < IDLE_LIMIT
        )

        # --------------------------------
        # 실제 작업 상태
        # --------------------------------

        is_working = (
            is_csp
            and has_recent_input
        )

        # --------------------------------
        # 작업 시작
        # --------------------------------

        if is_working and not was_working:

            work_start = now

            current_status = "작업 중"

            print(">>> 작업 시작")

        # --------------------------------
        # 작업 중
        # --------------------------------

        elif is_working and was_working:

            elapsed = (
                now - last_check
            ).total_seconds()

            database.add_seconds(
                last_check,
                elapsed
            )

            current_status = "작업 중"

        # --------------------------------
        # 작업 종료
        # --------------------------------

        elif not is_working and was_working:

            if work_start is not None:

                # 무입력으로 종료
                if is_csp and not has_recent_input:

                    last_input_time = (
                        now
                        - timedelta(
                            seconds=idle_seconds
                        )
                    )

                    work_end = (
                        last_input_time
                        + timedelta(
                            seconds=IDLE_LIMIT
                        )
                    )

                    if work_end > now:
                        work_end = now

                    elapsed = (
                        work_end - last_check
                    ).total_seconds()

                    if elapsed > 0:

                        database.add_seconds(
                            last_check,
                            elapsed
                        )

                    current_status = "대기 중"

                    print(
                        f">>> 작업 중단 "
                        f"(무입력 {idle_seconds:.1f}초)"
                    )

                # CSP에서 다른 창으로 이동
                elif not is_csp:

                    elapsed = (
                        now - last_check
                    ).total_seconds()

                    database.add_seconds(
                        last_check,
                        elapsed
                    )

                    current_status = "대기 중"

                    print(
                        ">>> 작업 중단 "
                        "(CSP 비활성)"
                    )

            work_start = None

        # --------------------------------
        # 상태 출력
        # --------------------------------

        if is_working:

            print(
                f"작업 중 | "
                f"입력 {idle_seconds:.1f}초 전 | "
                f"현재 창: {title}"
            )

        elif is_csp:

            current_status = "대기 중"

            print(
                f"대기 중 | "
                f"무입력 {idle_seconds:.1f}초 | "
                f"현재 창: {title}"
            )

        else:

            current_status = "대기 중"

            print(
                f"대기 중 | "
                f"현재 창: {title}"
            )

        update_live_state(now, is_working)

        # --------------------------------
        # 상태 업데이트
        # --------------------------------

        was_working = is_working
        last_check = now

        time.sleep(1)

    print("WorkTracker 종료")


# ========================================
# 프로그램 시작
# ========================================

tray_icon = create_tray_icon()

tracking_thread = threading.Thread(
    target=tracking_loop,
    daemon=True
)

tracking_thread.start()

live_state_server_thread = threading.Thread(
    target=run_live_state_server,
    daemon=True,
)

live_state_server_thread.start()

hotkey_thread = threading.Thread(
    target=run_global_hotkeys,
    daemon=True,
)

hotkey_thread.start()

tray_icon.run()
