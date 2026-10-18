#!/usr/bin/env python3
"""
Diagnostic script to test FalkorDB connection to your cloud instance.
Usage:
    python3 scripts/test_falkordb_connection.py <YOUR_PASSWORD>
or:
    FALKORDB_PASSWORD="your_password" python3 scripts/test_falkordb_connection.py
"""

import sys
import os

try:
    from falkordb import FalkorDB
except ImportError:
    print("Error: falkordb package not found. Run with backend/venv/bin/python or pip install falkordb")
    sys.exit(1)

HOST = os.getenv("FALKORDB_HOST", "r-6jissuruar.instance-3unybr0y2.hc-7up0crkyn.ap-south-1.aws.f2e0a955bb84.cloud").strip()
PORT = int(os.getenv("FALKORDB_PORT", "56322"))
GRAPH = os.getenv("FALKORDB_GRAPH_NAME", "KINO-AI-Video-Director").strip()

if len(sys.argv) > 1:
    PASSWORD = sys.argv[1].strip().strip("'").strip('"')
else:
    PASSWORD = (os.getenv("FALKORDB_PASSWORD") or "").strip().strip("'").strip('"')

if not PASSWORD:
    print("=" * 60)
    print("FalkorDB Connection Test")
    print("=" * 60)
    print(f"Target Host: {HOST}")
    print(f"Target Port: {PORT}")
    print(f"Graph Name:  {GRAPH}")
    print("\nPlease provide your password as an argument, for example:")
    print(f"  backend/venv/bin/python scripts/test_falkordb_connection.py <YOUR_PASSWORD>")
    sys.exit(1)

print("=" * 60)
print(f"Connecting to FalkorDB Cloud:")
print(f"  Host:     {HOST}")
print(f"  Port:     {PORT}")
print(f"  User:     default")
print(f"  Graph:    {GRAPH}")
print("=" * 60)

# 1. Try with username='default'
try:
    print("1. Testing connection with username='default'...")
    client = FalkorDB(host=HOST, port=PORT, username="default", password=PASSWORD)
    graph = client.select_graph(GRAPH)
    res = graph.query("RETURN 'Connection successful!' AS message, 1 + 1 AS math")
    print("SUCCESS! Response from FalkorDB:")
    print("  Header:", [c[1] for c in res.header] if hasattr(res, 'header') else 'OK')
    print("  Result:", res.result_set)
    print("\nYour FalkorDB credentials are 100% valid!")
    sys.exit(0)
except Exception as e1:
    print(f"  -> Failed with username='default': {e1}")

# 2. Try without explicit username (fallback)
try:
    print("\n2. Testing connection without explicit username...")
    client = FalkorDB(host=HOST, port=PORT, password=PASSWORD)
    graph = client.select_graph(GRAPH)
    res = graph.query("RETURN 'Connection successful!' AS message, 1 + 1 AS math")
    print("SUCCESS! Response from FalkorDB:")
    print("  Result:", res.result_set)
    print("\nYour FalkorDB credentials are 100% valid!")
    sys.exit(0)
except Exception as e2:
    print(f"  -> Failed: {e2}")

print("\n" + "=" * 60)
print("Troubleshooting Tips:")
print("1. Check your password in the FalkorDB Cloud Dashboard.")
print("   Go to: https://app.falkordb.cloud -> Click on your database -> Show Password")
print("2. Ensure there are no spaces or quotes in the password.")
print("3. Check if your database status in FalkorDB Cloud is 'Active' / 'Running'.")
print("=" * 60)
sys.exit(1)
