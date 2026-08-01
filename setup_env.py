import subprocess
import re
import os

def main():
    print("Running npx supabase status...")
    result = subprocess.run(["npx.cmd", "supabase", "status"], capture_output=True, text=True, cwd=r"f:\My Files\ARSC\arsc-leaderboard")
    output = result.stdout + "\n" + result.stderr
    
    api_url = None
    anon_key = None
    service_role_key = None
    
    for line in output.split("\n"):
        if "API URL:" in line:
            api_url = line.split("API URL:")[1].strip()
        elif "anon key:" in line:
            anon_key = line.split("anon key:")[1].strip()
        elif "service_role key:" in line:
            service_role_key = line.split("service_role key:")[1].strip()
            
    if not api_url or not anon_key:
        print("Failed to parse supabase status:")
        print(output)
        return
        
    env_content = f"""NEXT_PUBLIC_SUPABASE_URL={api_url}
NEXT_PUBLIC_SUPABASE_ANON_KEY={anon_key}
SUPABASE_SERVICE_ROLE_KEY={service_role_key}
"""
    
    env_path = r"f:\My Files\ARSC\arsc-leaderboard\.env.local"
    with open(env_path, "w") as f:
        f.write(env_content)
        
    print(f"Successfully configured {env_path}")
    print("Content:")
    print(env_content)

if __name__ == "__main__":
    main()
