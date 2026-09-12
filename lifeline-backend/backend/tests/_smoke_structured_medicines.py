"""
Targeted smoke test: generate_summary() and _format_medicines() with structured dicts.
Run: venv/Scripts/python.exe -m tests._smoke_structured_medicines
"""
from unittest.mock import patch

RECORDS = [
    {
        "diagnosis": ["Hypertension", "Diabetes"],
        "medicines": [
            {"name": "Aspirin",   "dosage": "100mg", "frequency": "once daily",  "duration": "7 days"},
            {"name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "duration": "30 days"},
        ],
        "allergies": ["Penicillin"],
        "doctor": "Dr Smith",
        "hospital": "City Hospital",
    },
    {
        "diagnosis": ["Flu"],
        "medicines": ["Paracetamol"],   # legacy plain-string form
        "allergies": [],
        "doctor": None,
        "hospital": None,
    },
    {
        "diagnosis": [],
        "medicines": [],                # empty list
        "allergies": [],
        "doctor": None,
        "hospital": None,
    },
]

captured = {}


def fake_generate(prompt):
    captured["prompt"] = prompt
    return "<ai summary>"


with patch("app.summary.service.get_all_medical_records", return_value=RECORDS), \
     patch("app.summary.service.generate", side_effect=fake_generate):
    from app.summary.service import generate_summary
    result = generate_summary("pat-test")

prompt = captured["prompt"]

print("=== generate_summary smoke test ===")
print("Result:", repr(result))
print()
start = prompt.index("Medications:")
end   = prompt.index("Allergies:")
print("Medications section of prompt:")
print(prompt[start:end].strip())
print()

assert "Aspirin"     in prompt, "Aspirin missing from prompt"
assert "Metformin"   in prompt, "Metformin missing from prompt"
assert "Paracetamol" in prompt, "Paracetamol (legacy string) missing from prompt"
print("PASS  All medicine names present in prompt")

# No raw dict repr should appear
assert "'name'" not in prompt, f"Raw dict repr found in prompt near: {prompt[prompt.find(chr(39)+'name'+chr(39))-20:]}"
print("PASS  No raw dict repr in prompt")

print()
print("=== _format_medicines Vitalis smoke test ===")
from app.vitalis.service import _format_medicines

out = _format_medicines([{"name": "Aspirin", "dosage": "100mg", "frequency": "once daily", "duration": "7 days"}])
print("Formatted:", repr(out))
assert "Aspirin"            in out
assert "dosage: 100mg"      in out
assert "frequency: once daily" in out
print("PASS  _format_medicines renders structured dict correctly")

out_mixed = _format_medicines([{"name": "Aspirin"}, "Paracetamol"])
print("Mixed:", repr(out_mixed))
assert "Aspirin"     in out_mixed
assert "Paracetamol" in out_mixed
print("PASS  _format_medicines handles mixed list")

out_none = _format_medicines(None)
assert out_none == "None", f"Expected 'None', got {out_none!r}"
print("PASS  _format_medicines(None) == 'None'")

print()
print("ALL SMOKE TESTS PASSED")
