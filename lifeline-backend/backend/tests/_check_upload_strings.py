import app.api.upload as m, inspect
src = inspect.getsource(m)

# The three failing checks from the static test
check1_pattern = "'verified'"
check2_pattern = "'report_type'"
check3_pattern = "'file_name'"

print("Check 1 - status='verified' stored:")
print("  pattern in src:", check1_pattern in src)
for i, line in enumerate(src.splitlines(), 1):
    if "verified" in line:
        print(f"    line {i}: {line.rstrip()}")

print()
print("Check 2 - 'report_type' stored:")
print("  pattern in src:", check2_pattern in src)
for i, line in enumerate(src.splitlines(), 1):
    if "report_type" in line:
        print(f"    line {i}: {line.rstrip()}")

print()
print("Check 3 - 'file_name' stored:")
print("  pattern in src:", check3_pattern in src)
for i, line in enumerate(src.splitlines(), 1):
    if "file_name" in line:
        print(f"    line {i}: {line.rstrip()}")
