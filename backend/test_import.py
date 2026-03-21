import sys
import os
sys.path.append(os.getcwd())
try:
    from app.config import get_settings
    print("Import success")
    print(get_settings().database_url)
except Exception as e:
    import traceback
    traceback.print_exc()
