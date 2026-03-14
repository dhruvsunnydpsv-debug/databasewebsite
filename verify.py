import os
from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ENV vars")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🔍 Scanning for fake records and garbage JSON blobs...")

# Find all records to inspect them in Python
res = supabase.table('sat_question_bank').select('id, raw_original_text, question_text').execute()
all_data = res.data or []

ids_to_delete = set()

for d in all_data:
    raw_text = d.get('raw_original_text') or ""
    q_text = d.get('question_text') or ""
    
    # Check for previous fakes
    if 'Simulated' in raw_text or 'Azura' in q_text:
        ids_to_delete.add(d['id'])
        continue
        
    # Check for garbage JSON blobs (like Open Library/CrossRef API responses)
    json_sigs = ['{"numFound"', '"author_key"', '"DOI"', '"message":', '"status":"ok"', '"items":[']
    if any(sig in raw_text for sig in json_sigs):
        ids_to_delete.add(d['id'])
        continue
        
    # Check for code/metadata in the actual question text
    if '{"module"' in q_text or '{"domain"' in q_text or '```json' in q_text:
        ids_to_delete.add(d['id'])
        continue

    # If the raw text is literally just a massive JSON object instead of a question
    raw_text_stripped = raw_text.strip()
    if (raw_text_stripped.startswith('{') and raw_text_stripped.endswith('}')) or (raw_text_stripped.startswith('[') and raw_text_stripped.endswith(']')):
        if len(raw_text_stripped) > 50 and (':' in raw_text_stripped or '"' in raw_text_stripped):
             ids_to_delete.add(d['id'])
             continue

if len(ids_to_delete) > 0:
    print(f"🧹 Cleaning {len(ids_to_delete)} corrupted/fake/json rows from database...")
    
    # Delete in batches of 100
    ids_list = list(ids_to_delete)
    for i in range(0, len(ids_list), 100):
        batch = ids_list[i:i+100]
        supabase.table('sat_question_bank').delete().in_('id', batch).execute()
        
    print("✅ Successfully purged garbage ingestion records.")
else:
    print("✅ Database is already clean. No garbage records found.")
