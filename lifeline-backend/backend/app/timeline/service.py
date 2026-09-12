from app.services.medical_record_service import get_all_medical_records


def generate_timeline(patient_id: str):

    records = get_all_medical_records(patient_id)

    timeline = []

    for record in records:

        event = {
            "date": record["dates"][0] if record.get("dates") else "Unknown",
            "title": (
                record["diagnosis"][0]
                if record.get("diagnosis")
                else "Medical Report"
            ),
            "doctor": record.get("doctor"),
            "hospital": record.get("hospital"),
            "diagnosis": record.get("diagnosis", [])
        }

        timeline.append(event)

    timeline.sort(key=lambda x: x["date"])

    return timeline
