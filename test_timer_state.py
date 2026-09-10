import ast
import math
import json
import time
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen
from urllib.parse import urlsplit
from pathlib import Path
from types import SimpleNamespace

# Load timer functions without starting the Windows tray app or touching its DB.
source = ast.parse(Path('main.py').read_text(encoding='utf-8'))
names = {'pomodoro_snapshot_locked', 'update_pomodoro', 'stopwatch_snapshot_locked', 'update_stopwatch', 'update_window'}
functions = ast.Module(body=[node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in names], type_ignores=[])

class TimerRegressionTests(unittest.TestCase):
    def setUp(self):
        self.clock = SimpleNamespace(value=1000.0)
        self.settings = {}
        self.state = dict(time=SimpleNamespace(time=lambda: self.clock.value), math=math,
            database=SimpleNamespace(set_setting=self.settings.__setitem__), live_state_lock=threading.Lock(), live_state={},
            pomodoro_duration_seconds=1500, pomodoro_remaining_seconds=1500, pomodoro_running=False,
            pomodoro_ends_at=None, pomodoro_repeat=False, pomodoro_phase='work',
            stopwatch_elapsed_seconds=0.0, stopwatch_running=False, stopwatch_started_at=None)
        exec(compile(functions, 'main.py', 'exec'), self.state)
        self.state['theme_changed'] = threading.Condition(self.state['live_state_lock'])

    def test_theme_stream_delivers_initial_state_and_change(self):
        self.state.update(json=json, Path=Path, urlsplit=urlsplit,
            SimpleHTTPRequestHandler=SimpleHTTPRequestHandler,
            __file__=str(Path('main.py').resolve()), is_running=True)
        self.state['live_state']['theme'] = 'dark'
        handler = next(node for node in source.body if isinstance(node, ast.ClassDef) and node.name == 'LiveStateHandler')
        exec(compile(ast.Module(body=[handler], type_ignores=[]), 'main.py', 'exec'), self.state)
        server = ThreadingHTTPServer(('127.0.0.1', 0), self.state['LiveStateHandler'])
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with urlopen(f'http://127.0.0.1:{server.server_port}/theme-events', timeout=2) as stream:
                self.assertEqual(json.loads(stream.readline()[6:]), {'theme': 'dark'})
                stream.readline()
                start = time.perf_counter()
                self.state['update_window']({'action': 'theme', 'theme': 'light'})
                self.assertEqual(json.loads(stream.readline()[6:]), {'theme': 'light'})
                self.assertLess(time.perf_counter() - start, 0.4)
        finally:
            self.state['is_running'] = False
            with self.state['theme_changed']:
                self.state['live_state']['theme'] = 'dark'
                self.state['theme_changed'].notify_all()
            server.shutdown()
            server.server_close()

    def test_repeated_pause_resume_preserves_fractional_time(self):
        toggle = self.state['update_pomodoro']
        for _ in range(10):
            toggle({'action': 'toggle'})
            self.clock.value += 0.125
            stopped = toggle({'action': 'toggle'})
        self.assertAlmostEqual(stopped['remaining'], 1498.75)
        self.assertFalse(stopped['running'])
        self.assertIsNone(stopped['endsAt'])

    def test_completion_and_repeat(self):
        self.state['update_pomodoro']({'action': 'toggle'})
        self.clock.value += 1500
        self.assertEqual(self.state['pomodoro_snapshot_locked']()['remaining'], 0)
        self.state['update_pomodoro']({'action': 'repeat', 'enabled': True})
        self.state['update_pomodoro']({'action': 'toggle'})
        self.clock.value += 1500.25
        result = self.state['pomodoro_snapshot_locked']()
        self.assertEqual(result['phase'], 'break')
        self.assertAlmostEqual(result['remaining'], 2099.75)

    def test_stopwatch_milliseconds_survive_pause_and_resume(self):
        toggle = self.state['update_stopwatch']
        toggle({'action': 'toggle'})
        self.clock.value += 1.125
        self.assertEqual(toggle({'action': 'toggle'})['elapsed'], 1.125)
        self.clock.value += 10
        toggle({'action': 'toggle'})
        self.clock.value += 0.25
        self.assertEqual(toggle({'action': 'toggle'})['elapsed'], 1.375)
        self.assertEqual(toggle({'action': 'reset'})['elapsed'], 0)

    def test_theme_reaches_live_state_and_saved_setting(self):
        for theme in ('dark', 'light'):
            self.state['update_window']({'action': 'theme', 'theme': theme})
            self.assertEqual(self.state['live_state']['theme'], theme)
            self.assertEqual(self.settings['window_theme'], theme)

if __name__ == '__main__':
    unittest.main()
