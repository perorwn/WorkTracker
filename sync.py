import os
import sqlite3
import requests

from dotenv import load_dotenv


# ========================================
# 환경변수
# ========================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

DB_FILE = "work_tracker.db"
_last_synced = {}


# ========================================
# 설정 확인
# ========================================

if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL이 .env에 없습니다."
    )

if not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        "SUPABASE_SECRET_KEY가 .env에 없습니다."
    )


# ========================================
# Supabase 업로드
# ========================================

def sync_database():

    # ------------------------------------
    # SQLite 연결
    # ------------------------------------

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT date, hour, seconds
        FROM work_time
        ORDER BY date, hour
    """)

    rows = cursor.fetchall()

    conn.close()


    # ------------------------------------
    # 기록이 없으면 종료
    # ------------------------------------

    if not rows:
        return

    changed_rows = [
        row for row in rows
        if _last_synced.get((row[0], row[1])) != row[2]
    ]

    if not changed_rows:
        return


    # ------------------------------------
    # Supabase API
    # ------------------------------------

    endpoint = (
        SUPABASE_URL
        + "/rest/v1/work_time"
    )


    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization":
            f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type":
            "application/json",
        "Prefer":
            "resolution=merge-duplicates"
    }


    # ------------------------------------
    # SQLite → JSON
    # ------------------------------------

    data = []

    for date, hour, seconds in changed_rows:

        data.append({
            "date": date,
            "hour": hour,
            "seconds": seconds
        })


    # ------------------------------------
    # 업로드
    # ------------------------------------

    response = requests.post(
        endpoint,
        headers=headers,
        json=data,
        timeout=10
    )


    # ------------------------------------
    # 결과
    # ------------------------------------

    if response.ok:

        for date, hour, seconds in changed_rows:
            _last_synced[(date, hour)] = seconds

        print(
            f"Supabase 동기화 완료 "
            f"({len(data)}개)"
        )

    else:

        print(
            "Supabase 동기화 실패"
        )

        print(
            "상태 코드:",
            response.status_code
        )

        print(
            response.text
        )


# ========================================
# 실행
# ========================================

if __name__ == "__main__":

    sync_database()
