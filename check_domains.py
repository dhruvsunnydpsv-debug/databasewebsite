import os
from supabase import create_client

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

try:
    supabase = create_client(url, key)
    
    # Check for new domain names
    new_domains = ['Algebra', 'Advanced Math', 'Problem-solving and Data Analysis', 'Geometry and Trigonometry', 'Craft and Structure', 'Information and Ideas', 'Standard English Conventions', 'Expression of Ideas']
    
    print("--- CHECKING FOR 2026 SYLLABUS DOMAINS ---")
    for domain in new_domains:
        res = supabase.table("sat_question_bank").select("id", count="exact").eq("domain", domain).execute()
        print(f"{domain}: {res.count}")
        
    # Check for old domain names (with underscores)
    old_domains = ['Heart_of_Algebra', 'Advanced_Math', 'Problem_Solving_Data', 'Geometry_Trigonometry', 'Information_and_Ideas', 'Craft_and_Structure', 'Expression_of_Ideas', 'Standard_English_Conventions']
    print("\n--- CHECKING FOR LEGACY DOMAINS ---")
    for domain in old_domains:
        res = supabase.table("sat_question_bank").select("id", count="exact").eq("domain", domain).execute()
        print(f"{domain}: {res.count}")

except Exception as e:
    print(f"Error: {e}")
