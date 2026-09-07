import sqlite3
from datetime import datetime, timedelta
from pathlib import Path


DB_FILE = "work_tracker.db"
HTML_FILE = "graph.html"


# ========================================
# 데이터베이스에서 최근 30일 기록 가져오기
# ========================================

conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()

cursor.execute("""
SELECT date, SUM(seconds)
FROM work_time
GROUP BY date
ORDER BY date
""")

rows = cursor.fetchall()

conn.close()


# ========================================
# 날짜별 작업시간을 딕셔너리로 변환
# ========================================

work_data = {}

for date, seconds in rows:
    work_data[date] = seconds


# ========================================
# 작업시간 → 색상 단계
# ========================================

def get_level(seconds):

    minutes = seconds / 60

    if minutes <= 0:
        return 0
    elif minutes < 15:
        return 1
    elif minutes < 30:
        return 2
    elif minutes < 45:
        return 3
    elif minutes < 60:
        return 4
    else:
        return 5


# ========================================
# 시간 표시
# ========================================

def format_time(seconds):

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    remaining_seconds = seconds % 60

    if hours > 0:
        return f"{hours}시간 {minutes}분"

    if minutes > 0:
        return f"{minutes}분 {remaining_seconds}초"

    return f"{remaining_seconds}초"


# ========================================
# 오늘
# ========================================

today = datetime.now().date()


# ========================================
# 최근 30일 날짜 생성
# ========================================

dates = []

for i in range(29, -1, -1):

    date = today - timedelta(days=i)

    dates.append(date)


# ========================================
# 30일 총 작업시간
# ========================================

total_seconds = 0

for date in dates:

    date_string = date.strftime("%Y-%m-%d")

    total_seconds += work_data.get(
        date_string,
        0
    )


# ========================================
# 날짜 칸 생성
# ========================================

cells = ""

for date in dates:

    date_string = date.strftime("%Y-%m-%d")

    seconds = work_data.get(
        date_string,
        0
    )

    level = get_level(seconds)

    weekday = [
        "월",
        "화",
        "수",
        "목",
        "금",
        "토",
        "일"
    ][date.weekday()]

    time_text = format_time(seconds)

    cells += f"""
    <div class="cell level-{level}"
         title="{date_string} ({weekday})&#10;작업시간: {time_text}">

        <div class="date-number">
            {date.day}
        </div>

        <div class="time">
            {time_text}
        </div>

    </div>
    """


# ========================================
# HTML
# ========================================

html = f"""
<!DOCTYPE html>

<html lang="ko">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>WorkTracker</title>


<style>

* {{
    box-sizing: border-box;
}}


body {{

    margin: 0;

    padding: 40px;

    font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;

    background: #f7f7f7;

    color: #222;
}}


.container {{

    max-width: 900px;

    margin: 0 auto;
}}


h1 {{

    margin: 0 0 8px 0;

    font-size: 28px;
}}


.subtitle {{

    color: #777;

    margin-bottom: 30px;
}}


.summary {{

    background: white;

    border: 1px solid #ddd;

    border-radius: 10px;

    padding: 20px;

    margin-bottom: 30px;
}}


.summary-title {{

    font-size: 14px;

    color: #777;

    margin-bottom: 6px;
}}


.summary-time {{

    font-size: 26px;

    font-weight: bold;
}}


.grid {{

    display: grid;

    grid-template-columns:
        repeat(10, 1fr);

    gap: 10px;
}}


.cell {{

    aspect-ratio: 1 / 1;

    border-radius: 7px;

    padding: 8px;

    display: flex;

    flex-direction: column;

    justify-content: space-between;

    border: 1px solid rgba(0, 0, 0, 0.08);

    transition:
        transform 0.12s ease,
        box-shadow 0.12s ease;

    cursor: default;
}}


.cell:hover {{

    transform: translateY(-2px);

    box-shadow:
        0 4px 10px rgba(0, 0, 0, 0.15);
}}


.date-number {{

    font-size: 14px;

    font-weight: bold;
}}


.time {{

    font-size: 11px;

    line-height: 1.2;

    color: #555;
}}


/* ========================================
   작업시간 단계
   ======================================== */

.level-0 {{

    background: #eeeeee;
}}


.level-1 {{

    background: #d9d9d9;
}}


.level-2 {{

    background: #bdbdbd;
}}


.level-3 {{

    background: #969696;
}}


.level-4 {{

    background: #666666;

    color: white;
}}


.level-4 .time {{

    color: #eeeeee;
}}


.level-5 {{

    background: #333333;

    color: white;
}}


.level-5 .time {{

    color: #eeeeee;
}}


/* ========================================
   범례
   ======================================== */

.legend {{

    margin-top: 25px;

    display: flex;

    align-items: center;

    gap: 7px;

    font-size: 12px;

    color: #777;

    flex-wrap: wrap;
}}


.legend-box {{

    width: 16px;

    height: 16px;

    border-radius: 4px;

    border: 1px solid #ddd;
}}


@media (max-width: 600px) {{

    body {{

        padding: 20px;
    }}

    .grid {{

        grid-template-columns:
            repeat(5, 1fr);

        gap: 7px;
    }}

}}


</style>

</head>


<body>


<div class="container">


<h1>WorkTracker</h1>

<div class="subtitle">
    최근 30일 작업 기록
</div>


<div class="summary">

    <div class="summary-title">
        최근 30일 총 작업시간
    </div>

    <div class="summary-time">
        {format_time(total_seconds)}
    </div>

</div>


<div class="grid">

{cells}

</div>


<div class="legend">

    <div class="legend-box level-0"></div>
    0분

    <div class="legend-box level-1"></div>
    15분 미만

    <div class="legend-box level-2"></div>
    15~30분

    <div class="legend-box level-3"></div>
    30~45분

    <div class="legend-box level-4"></div>
    45~60분

    <div class="legend-box level-5"></div>
    60분 이상

</div>


</div>


</body>

</html>
"""


# ========================================
# 저장
# ========================================

Path(HTML_FILE).write_text(
    html,
    encoding="utf-8"
)


print("그래프 생성 완료:", HTML_FILE)
print(
    "최근 30일 총 작업시간:",
    format_time(total_seconds)
)