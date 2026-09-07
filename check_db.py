import database


rows = database.get_daily_data()


if not rows:

    print("아직 기록된 작업시간이 없습니다.")

else:

    print("작업시간 기록:")
    print()

    for date, seconds in rows.items():

        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        remaining_seconds = seconds % 60

        print(
            f"{date} → "
            f"{hours}시간 "
            f"{minutes}분 "
            f"{remaining_seconds}초"
        )