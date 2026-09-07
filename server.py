from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from urllib.parse import urlparse, parse_qs
import os

import database


HOST = "0.0.0.0"
PORT = 8000


class RequestHandler(BaseHTTPRequestHandler):

    # ========================================
    # JSON 응답
    # ========================================

    def send_json(self, data):

        response = json.dumps(
            data,
            ensure_ascii=False
        ).encode("utf-8")

        self.send_response(200)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )

        self.send_header(
            "Content-Length",
            str(len(response))
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.end_headers()

        self.wfile.write(response)


    # ========================================
    # 에러 응답
    # ========================================

    def send_error_json(self, message):

        response = json.dumps(
            {
                "error": message
            },
            ensure_ascii=False
        ).encode("utf-8")

        self.send_response(400)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )

        self.send_header(
            "Content-Length",
            str(len(response))
        )

        self.end_headers()

        self.wfile.write(response)


    # ========================================
    # HTML 파일 응답
    # ========================================

    def send_html(self, filename):

        try:

            with open(
                filename,
                "rb"
            ) as file:

                content = file.read()


            self.send_response(200)

            self.send_header(
                "Content-Type",
                "text/html; charset=utf-8"
            )

            self.send_header(
                "Content-Length",
                str(len(content))
            )

            self.end_headers()

            self.wfile.write(content)


        except FileNotFoundError:

            self.send_response(404)

            self.end_headers()

            self.wfile.write(
                b"File Not Found"
            )


    # ========================================
    # GET
    # ========================================

    def do_GET(self):

        parsed = urlparse(self.path)

        path = parsed.path

        query = parse_qs(
            parsed.query
        )


        # ====================================
        # graph.html
        # ====================================

        if path == "/":

            self.send_html(
                "graph.html"
            )

            return


        if path == "/graph.html":

            self.send_html(
                "graph.html"
            )

            return


        # ====================================
        # 일별 데이터
        #
        # /api/daily
        # ====================================

        if path == "/api/daily":

            data = database.get_daily_data()

            self.send_json(data)

            return


        # ====================================
        # 전체 작업시간
        #
        # /api/total
        # ====================================

        if path == "/api/total":

            total = (
                database.get_total_work_time()
            )

            self.send_json(
                {
                    "seconds": total
                }
            )

            return


        # ====================================
        # 특정 날짜 시간별 데이터
        #
        # /api/hourly?date=2026-09-07
        # ====================================

        if path == "/api/hourly":

            if "date" not in query:

                self.send_error_json(
                    "date가 필요합니다."
                )

                return


            date = query["date"][0]

            data = database.get_hourly_data(
                date
            )


            hourly_data = {}

            for hour in range(24):

                hourly_data[str(hour)] = (
                    data.get(hour, 0)
                )


            self.send_json(
                {
                    "date": date,
                    "hours": hourly_data
                }
            )

            return


        # ====================================
        # 특정 날짜 전체 정보
        #
        # /api/day?date=2026-09-07
        # ====================================

        if path == "/api/day":

            if "date" not in query:

                self.send_error_json(
                    "date가 필요합니다."
                )

                return


            date = query["date"][0]


            total = database.get_day_total(
                date
            )


            hourly = database.get_hourly_data(
                date
            )


            hours = {}

            for hour in range(24):

                hours[str(hour)] = (
                    hourly.get(hour, 0)
                )


            self.send_json(
                {
                    "date": date,
                    "total_seconds": total,
                    "hours": hours
                }
            )

            return


        # ====================================
        # 특정 기간 데이터
        #
        # /api/period?start=2026-09-01&end=2026-09-08
        # ====================================

        if path == "/api/period":

            if (
                "start" not in query
                or "end" not in query
            ):

                self.send_error_json(
                    "start와 end가 필요합니다."
                )

                return


            start_date = query["start"][0]

            end_date = query["end"][0]


            daily_data = (
                database.get_daily_data()
            )


            result = {}

            for date, seconds in daily_data.items():

                if (
                    start_date
                    <= date
                    <= end_date
                ):

                    result[date] = seconds


            total = (
                database.get_period_total(
                    start_date,
                    end_date
                )
            )


            self.send_json(
                {
                    "start": start_date,
                    "end": end_date,
                    "total_seconds": total,
                    "days": result
                }
            )

            return


        # ====================================
        # 존재하지 않는 API
        # ====================================

        self.send_response(404)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )

        self.end_headers()

        self.wfile.write(
            json.dumps(
                {
                    "error": "Not Found"
                },
                ensure_ascii=False
            ).encode("utf-8")
        )


# ========================================
# 서버 시작
# ========================================

print(
    f"WorkTracker API 서버 시작: "
    f"http://{HOST}:{PORT}"
)

print("종료하려면 Ctrl+C")


http_server = HTTPServer(
    (HOST, PORT),
    RequestHandler
)


try:

    http_server.serve_forever()

except KeyboardInterrupt:

    print()
    print("서버 종료")

finally:

    http_server.server_close()