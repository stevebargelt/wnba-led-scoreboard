#!/usr/bin/env python3

import os
import sys
from dotenv import load_dotenv
from supabase import create_client
import uuid

load_dotenv()

def setup_device():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    device_id = os.getenv("DEVICE_ID")

    if not all([supabase_url, service_role_key, device_id]):
        print("Error: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DEVICE_ID must be set")
        sys.exit(1)

    client = create_client(supabase_url, service_role_key)

    print(f"Device ID: {device_id}\n")

    try:
        uuid.UUID(device_id)
    except ValueError:
        print(f"Error: DEVICE_ID '{device_id}' is not a valid UUID")
        sys.exit(1)

    print("Checking if device exists...")

    try:
        result = client.table("devices").select("*").eq("id", device_id).execute()

        if result.data:
            device = result.data[0]
            print(f"✅ Device already exists:")
            print(f"   ID: {device['id']}")
            print(f"   Name: {device.get('name', 'N/A')}")
            print(f"   User ID: {device.get('user_id', 'N/A')}")
            print(f"   Created: {device.get('created_at', 'N/A')}")
            return True
        else:
            print("❌ Device not found")
            print("\nCreating device...")

            new_device = {
                "id": device_id,
                "name": "LED Scoreboard Device",
                "user_id": None,
            }

            try:
                result = client.table("devices").insert(new_device).execute()
                print(f"✅ Device created successfully!")
                return True
            except Exception as e:
                print(f"❌ Error creating device: {e}")
                print("\nNote: You may need to:")
                print("  1. Set user_id to a valid auth.users.id")
                print("  2. Ensure RLS policies allow device creation")
                print("  3. Create device manually via SQL Editor:")
                print(f"\n  INSERT INTO devices (id, name, user_id)")
                print(f"  VALUES ('{device_id}', 'LED Scoreboard', NULL);")
                return False

    except Exception as e:
        print(f"❌ Error checking device: {e}")
        print("\nThis usually means:")
        print("  - The 'devices' table doesn't exist (run migrations first)")
        print("  - Database connection failed")
        return False

if __name__ == "__main__":
    success = setup_device()
    sys.exit(0 if success else 1)
