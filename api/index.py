import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import app

class VercelPathFixMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        # Vercel passes the original requested path in HTTP_X_MATCHED_PATH
        matched_path = environ.get('HTTP_X_MATCHED_PATH')
        if matched_path:
            environ['PATH_INFO'] = matched_path
        else:
            path = environ.get('PATH_INFO', '')
            if path.startswith('/api/index'):
                new_path = path[len('/api/index'):]
                environ['PATH_INFO'] = new_path if new_path else '/'
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathFixMiddleware(app.wsgi_app)
