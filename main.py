import time
import ctypes
import threading
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

tray_icon.run()
