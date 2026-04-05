"""
Vercel serverless function for generating LED display previews.

This replaces the Node.js version that used child_process to spawn Python.
Instead, this native Python function directly imports and uses the preview generation code.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os
import sys
from pathlib import Path
import tempfile
import uuid

# From web-admin/api/device/[id]/ go up 5 levels to reach rig root
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

from supabase import create_client
from src.config.supabase_config_loader import SupabaseConfigLoader, DeviceConfiguration
from src.preview.generator import PreviewGenerator


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed_url = urlparse(self.path)
            path_parts = parsed_url.path.split('/')
            device_id = path_parts[-2] if len(path_parts) >= 2 else None

            if not device_id:
                self._send_error(400, 'Device ID is required')
                return

            try:
                uuid.UUID(device_id)
            except (ValueError, AttributeError):
                self._send_error(400, f'Invalid device ID format: {device_id}')
                return

            auth_header = self.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                self._send_error(401, 'Missing or invalid Authorization header')
                return

            access_token = auth_header[7:]

            supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
            supabase_anon_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

            if not supabase_url or not supabase_anon_key:
                self._send_error(500, 'Supabase configuration missing')
                return

            user_scoped = create_client(
                supabase_url,
                supabase_anon_key,
                options={
                    'headers': {'Authorization': f'Bearer {access_token}'},
                    'auth': {
                        'auto_refresh_token': False,
                        'persist_session': False
                    }
                }
            )

            auth_response = user_scoped.auth.get_user(access_token)
            if not auth_response or not auth_response.user:
                self._send_error(401, 'Unauthorized')
                return

            device_response = user_scoped.table('devices').select('id, user_id').eq('id', device_id).maybe_single().execute()

            if not device_response.data:
                self._send_error(403, 'Forbidden')
                return

            query_params = parse_qs(parsed_url.query)
            scene = query_params.get('scene', ['live'])[0]

            valid_scenes = ['idle', 'pregame', 'live', 'live_big', 'final']
            if scene not in valid_scenes:
                self._send_error(400, 'Invalid scene type')
                return

            service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            if not service_role_key:
                self._send_error(500, 'Service role key not configured')
                return

            service_client = create_client(supabase_url, service_role_key)
            loader = SupabaseConfigLoader(device_id, service_client)
            config = loader.load_full_config()

            if not config:
                self._send_error(404, 'Device configuration not found')
                return

            with tempfile.TemporaryDirectory() as output_dir:
                generator = PreviewGenerator(config, output_dir)

                if scene == "idle":
                    frame_path = generator.generate_idle_scene()
                elif scene == "pregame":
                    frame_path = generator.generate_pregame_scene(use_demo=True)
                elif scene == "live":
                    frame_path = generator.generate_live_scene(use_demo=True, big_logos=False)
                elif scene == "live_big":
                    frame_path = generator.generate_live_scene(use_demo=True, big_logos=True)
                elif scene == "final":
                    frame_path = generator.generate_final_scene(use_demo=True)
                else:
                    frame_path = generator.generate_live_scene(use_demo=True)

                with open(frame_path, 'rb') as f:
                    image_data = f.read()

                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Cache-Control', 'no-store, must-revalidate')
                self.end_headers()
                self.wfile.write(image_data)

        except Exception as e:
            self._send_error(500, f'Failed to generate preview: {str(e)}')

    def _send_error(self, status_code, message):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = json.dumps({'error': message})
        self.wfile.write(response.encode('utf-8'))
