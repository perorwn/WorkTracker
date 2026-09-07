import time
import ctypes
from datetime import datetime, timedelta

import database
from sync import sync_database


# ========================================
# 설정
# ========================================

IDLE_LIMIT = 10

# Supabase 동기화 주기
SYNC_INTERVAL = 300


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
# 시작
# ========================================

print("WorkTracker 시작")
print(f"무입력 제한시간: {IDLE_LIMIT}초")
print()
print("조건:")
print("  1. Clip Studio Paint가 활성 창")
print("  2. 마지막 입력 후 10초 이내")
print()
print("종료하려면 Ctrl+C")
print()


# ========================================
# 상태
# ========================================

last_check = datetime.now()

was_working = False

work_start = None

# 마지막 Supabase 동기화 시간
last_sync = datetime.now()


# ========================================
# 메인 루프
# ========================================

try:

    while True:

        now = datetime.now()
        # --------------------------------
        # Supabase 자동 동기화
        # --------------------------------

        if (
            now - last_sync
        ).total_seconds() >= SYNC_INTERVAL:

            try:

                sync_database()

            except Exception as error:

                print(
                    ">>> Supabase 동기화 실패:"
                    f" {error}"
                )

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

                    print(
                        ">>> 작업 중단 "
                        "(CSP 비활성)"
                    )

            work_start = None


        # --------------------------------
        # 화면 출력
        # --------------------------------

        if is_working:

            print(
                f"작업 중 | "
                f"입력 {idle_seconds:.1f}초 전 | "
                f"현재 창: {title}"
            )

        elif is_csp:

            print(
                f"대기 중 | "
                f"무입력 {idle_seconds:.1f}초 | "
                f"현재 창: {title}"
            )

        else:

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


except KeyboardInterrupt:

    print()
    print("WorkTracker 종료")