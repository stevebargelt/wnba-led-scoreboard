#!/usr/bin/env python3

import os
import sys
from dotenv import load_dotenv

load_dotenv()

def test_supabase_connection():
    print("Testing Supabase connection...\n")

    print("1. Checking environment variables...")
    required_vars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "DEVICE_ID"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        return False

    for var in required_vars:
        value = os.getenv(var)
        masked = value[:20] + "..." if len(value) > 20 else value
        print(f"   ✅ {var}: {masked}")

    print("\n2. Testing Supabase client connection...")
    try:
        from supabase import create_client

        client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_ANON_KEY")
        )
        print("   ✅ Supabase client created successfully")
    except Exception as e:
        print(f"   ❌ Failed to create Supabase client: {e}")
        return False

    print("\n3. Testing configuration loader...")
    try:
        from src.config.supabase_config_loader import SupabaseConfigLoader

        loader = SupabaseConfigLoader(os.getenv("DEVICE_ID"), client)
        print("   ✅ Configuration loader initialized")
    except Exception as e:
        print(f"   ❌ Failed to initialize configuration loader: {e}")
        return False

    print("\n4. Loading device configuration...")
    try:
        config = loader.load_full_config()
        print(f"   ✅ Configuration loaded successfully!")
        print(f"      Device ID: {config.device_id}")
        print(f"      Timezone: {config.timezone}")
        print(f"      Enabled: {config.enabled}")
        print(f"      Enabled leagues: {config.enabled_leagues}")
        print(f"      Favorite teams: {len(config.favorite_teams)} leagues with favorites")
        return True
    except Exception as e:
        print(f"   ❌ Failed to load configuration: {e}")
        print("\n   This usually means:")
        print("      - Device not found in database")
        print("      - Migrations not run (tables missing)")
        print("      - RLS policies blocking access")
        return False

if __name__ == "__main__":
    print("="*60)
    print(" Supabase Connection Test")
    print("="*60 + "\n")

    success = test_supabase_connection()

    print("\n" + "="*60)
    if success:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed - see errors above")
    print("="*60 + "\n")

    sys.exit(0 if success else 1)
