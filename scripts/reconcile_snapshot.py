import json
import csv
import sys

def reconcile():
    json_path = '.data/MINIMIZED_CONFIDENTIAL_SNAPSHOT.json'
    csv_path = '.data/remote_rapor_members.csv'

    with open(json_path, 'r', encoding='utf-8') as f:
        snapshot_data = json.load(f)

    snapshot_members = {}
    snapshot_names = {}
    for m in snapshot_data['members']:
        code = m['release_member_code']
        name = m['canonical_name']
        snapshot_members[code] = m
        snapshot_names[name] = snapshot_names.get(name, 0) + 1

    remote_members = {}
    remote_names = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row['member_code']
            name = row['canonical_name']
            remote_members[code] = row
            remote_names[name] = remote_names.get(name, 0) + 1

    print("=== RECONCILIATION REPORT ===")
    print(f"Workbook Snapshot Count: {len(snapshot_members)}")
    print(f"Remote Rapor Count:      {len(remote_members)}")
    
    only_in_workbook = set(snapshot_members.keys()) - set(remote_members.keys())
    only_in_remote = set(remote_members.keys()) - set(snapshot_members.keys())
    both = set(snapshot_members.keys()).intersection(set(remote_members.keys()))

    print(f"\nMembers present only in workbook (local snapshot): {len(only_in_workbook)}")
    if only_in_workbook:
        for code in only_in_workbook:
            print(f"  - {code}: {snapshot_members[code]['canonical_name']}")

    print(f"\nMembers present only in remote Supabase: {len(only_in_remote)}")
    if only_in_remote:
        for code in only_in_remote:
            print(f"  - {code}: {remote_members[code]['canonical_name']}")
    
    mismatches = 0
    print(f"\nComparing common members ({len(both)}):")
    for code in both:
        snap = snapshot_members[code]
        rem = remote_members[code]
        diffs = []
        if snap['canonical_name'] != rem['canonical_name']:
            diffs.append(f"Name: {snap['canonical_name']} vs {rem['canonical_name']}")
        if snap['unit'] != rem['unit']:
            diffs.append(f"Unit: {snap['unit']} vs {rem['unit']}")
        if snap['position'] != rem['position']:
            diffs.append(f"Position: {snap['position']} vs {rem['position']}")
        if snap['evaluation_status'] != rem['evaluation_status']:
            diffs.append(f"Status: {snap['evaluation_status']} vs {rem['evaluation_status']}")
        
        if diffs:
            mismatches += 1
            print(f"  - {code} differences: {', '.join(diffs)}")

    if mismatches == 0:
        print("  All common members match exactly in name, unit, position, and status.")

    print("\nChecking for Duplicate Names:")
    dup_snap = {k: v for k, v in snapshot_names.items() if v > 1}
    dup_rem = {k: v for k, v in remote_names.items() if v > 1}
    if dup_snap:
        print(f"  Duplicate names in workbook snapshot: {dup_snap}")
    else:
        print("  No duplicate names in workbook snapshot.")
    
    if dup_rem:
        print(f"  Duplicate names in remote Supabase: {dup_rem}")
    else:
        print("  No duplicate names in remote Supabase.")
    
    print("\n=== RECONCILIATION COMPLETE ===")

if __name__ == '__main__':
    reconcile()
