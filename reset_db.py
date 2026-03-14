import os
from supabase import create_client, Client

def reset_database():
    """
    WARNING: This wipes the sat_question_bank table and resets the schema.
    Run this only if you want a clean slate for the 2026 Syllabus.
    """
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Missing Supabase credentials in environment.")
        return

    supabase: Client = create_client(url, key)
    
    print("--- DATABASE RESET STARTED ---")
    
    # We can't easily run arbitrary SQL files via the SDK's table() interface.
    # The best way is to use the RPC approach if a 'exec_sql' function exists,
    // or simply delete all rows.
    
    try:
        # 1. Wipe all data
        print("Wiping all rows from sat_question_bank...")
        supabase.table("sat_question_bank").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("✅ Data wiped.")
        
        print("\nIMPORTANT: Please copy the content of 'schema.sql' and paste it into the Supabase SQL Editor.")
        print("This will ensure the CHECK constraints and VIEWS are updated to the 2026 syllabus.")
        
    except Exception as e:
        print(f"❌ Reset failed: {e}")

if __name__ == "__main__":
    confirm = input("Are you sure you want to WIPE the database? (y/N): ")
    if confirm.lower() == 'y':
        reset_database()
    else:
        print("Reset aborted.")
