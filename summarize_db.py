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
    
    # 1. Total count
    res_total = supabase.table("sat_question_bank").select("id", count="exact").execute()
    total = res_total.count
    
    # 2. Group by domain
    res_domain = supabase.table("sat_question_bank").select("domain").execute()
    domains = [r.get("domain") for r in res_total.data] # Wait, res_total data might be large
    
    # Let's just do a few samples to see the format
    res_samples = supabase.table("sat_question_bank").select("module, domain, question_text, source_method").limit(10).execute()
    
    print(f"--- DATABASE SUMMARY ---")
    print(f"Total Records: {total}")
    print("\nSample Data (First 10):")
    for i, r in enumerate(res_samples.data):
        q_snippet = r.get("question_text", "")[:50].replace("\n", " ")
        print(f"{i+1}. Module: {r.get('module')} | Domain: {r.get('domain')} | Source: {r.get('source_method')} | Text: {q_snippet}...")

except Exception as e:
    print(f"Error: {e}")
