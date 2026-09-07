import sqlite3
from datetime import datetime, timedelta


DB_FILE = "work_tracker.db"


# ========================================
# 데이터베이스 연결
# ========================================

def get_connection():
    return sqlite3.connect(DB_FILE)


# ========================================
# 테이블 초기화
# ========================================

def initialize_database():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS work_time (
        date TEXT NOT NULL,
        hour INTEGER NOT NULL,
        seconds INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, hour)
    )
    """)

    conn.commit()
    conn.close()


# ========================================
# 작업시간 추가
# ========================================

def add_seconds(start_time, seconds):

    if seconds <= 0:
        return

    conn = get_connection()
    cursor = conn.cursor()

    remaining = seconds
    current = start_time

    while remaining > 0:

        next_hour = (
            current
            .replace(
                minute=0,
                second=0,
                microsecond=0
            )
            + timedelta(hours=1)
        )

        available = (
            next_hour - current
        ).total_seconds()

        amount = min(
            remaining,
            available
        )

        date = current.strftime("%Y-%m-%d")
        hour = current.hour

        cursor.execute("""
        INSERT INTO work_time
            (date, hour, seconds)
        VALUES
            (?, ?, ?)

        ON CONFLICT(date, hour)
        DO UPDATE SET
            seconds = seconds + excluded.seconds
        """, (
            date,
            hour,
            int(amount)
        ))

        remaining -= amount
        current = next_hour

    conn.commit()
    conn.close()


# ========================================
# 특정 날짜의 시간별 기록
# ========================================

def get_hourly_data(date):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT hour, seconds
    FROM work_time
    WHERE date = ?
    ORDER BY hour
    """, (date,))

    rows = cursor.fetchall()

    conn.close()

    data = {
        hour: seconds
        for hour, seconds in rows
    }

    return data


# ========================================
# 날짜별 총 작업시간
# ========================================

def get_daily_data():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT date, SUM(seconds)
    FROM work_time
    GROUP BY date
    ORDER BY date
    """)

    rows = cursor.fetchall()

    conn.close()

    return {
        date: seconds
        for date, seconds in rows
    }


# ========================================
# 특정 날짜의 총 작업시간
# ========================================

def get_day_total(date):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT COALESCE(SUM(seconds), 0)
    FROM work_time
    WHERE date = ?
    """, (date,))

    result = cursor.fetchone()[0]

    conn.close()

    return result


# ========================================
# 특정 기간의 총 작업시간
# ========================================

def get_period_total(start_date, end_date):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT COALESCE(SUM(seconds), 0)
    FROM work_time
    WHERE date BETWEEN ? AND ?
    """, (
        start_date,
        end_date
    ))

    result = cursor.fetchone()[0]

    conn.close()

    return result


# ========================================
# 가장 많이 작업한 날짜
# ========================================

def get_most_worked_day():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT date, SUM(seconds)
    FROM work_time
    GROUP BY date
    ORDER BY SUM(seconds) DESC
    LIMIT 1
    """)

    result = cursor.fetchone()

    conn.close()

    return result


# ========================================
# 전체 작업시간
# ========================================

def get_total_work_time():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT COALESCE(SUM(seconds), 0)
    FROM work_time
    """)

    result = cursor.fetchone()[0]

    conn.close()

    return result


# ========================================
# 초기화
# ========================================

initialize_database()