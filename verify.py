import os
from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ENV vars")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🔍 Scanning for fake 'Simulated' injection records...")

sim_res = supabase.table('sat_question_bank').select('id, raw_original_text').ilike('raw_original_text', '%Simulated%').execute()
sim_data = sim_res.data
print(f"Found {len(sim_data)} fake records in 'raw_original_text'.")

az_res = supabase.table('sat_question_bank').select('id, question_text').ilike('question_text', '%Azura%').execute()
az_data = az_res.data
print(f"Found {len(az_data)} duplicate 'Azura' generated records.")

ids_to_delete = set()
for d in sim_data: ids_to_delete.add(d['id'])
for d in az_data: ids_to_delete.add(d['id'])

if len(ids_to_delete) > 0:
    print(f"🧹 Cleaning {len(ids_to_delete)} corrupted/fake rows from database...")
    supabase.table('sat_question_bank').delete().in_('id', list(ids_to_delete)).execute()
    print("✅ Successfully purged fake and duplicate ingestion records.")
else:
    print("✅ Database is already clean. No simulated records found.")

verify_res = supabase.table('sat_question_bank').select('id').ilike('raw_original_text', '%Simulated%').execute()
if len(verify_res.data) == 0:
    print("✅ Verification Passed: raw_original_text no longer contains 'Simulated'.")
else:
    print("❌ Verification Failed: simulated records still exist.")
