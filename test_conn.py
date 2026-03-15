import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv("../.env")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

try:
    supabase = create_client(url, key)
    res = supabase.table("sat_question_bank").select("id", count="exact").limit(1).execute()
    print(f"SUCCESS: Total questions in database: {res.count}")
except Exception as e:
    print(f"FAILURE: Could not connect to Supabase. Error: {e}")
