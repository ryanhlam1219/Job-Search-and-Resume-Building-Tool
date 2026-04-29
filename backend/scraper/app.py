from flask import Flask, jsonify, request
from flask_cors import CORS
from jobspy import scrape_jobs
import pandas as pd
import hashlib
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Country names that definitively indicate a non-US job.
# Checked BEFORE the "remote" allowance so "Philippines, Remote" is still rejected.
_NON_US_COUNTRIES = {
    "united kingdom", "scotland", "england", "wales", "northern ireland",
    "ireland", "canada", "australia", "india", "philippines", "saudi arabia",
    "germany", "france", "spain", "italy", "netherlands", "brazil", "mexico",
    "singapore", "malaysia", "new zealand", "south africa", "pakistan",
    "bangladesh", "egypt", "nigeria", "kenya", "united arab emirates", "uae",
    "qatar", "kuwait", "israel", "japan", "china", "south korea", "taiwan",
    "hong kong", "indonesia", "thailand", "vietnam", "colombia", "argentina",
    "chile", "peru", "poland", "sweden", "norway", "denmark", "finland",
    "switzerland", "austria", "belgium", "portugal", "greece", "turkey",
    "romania", "ukraine", "czech republic", "hungary", "maipú", "worldwide",
}

def is_location_match(job_location: str | None, requested_location: str) -> bool:
    """Return True if the job location is compatible with the requested location.
    Non-US country names are rejected first, even if the location also says 'remote'.
    """
    if not job_location:
        return True  # no location data — let it through

    loc_lower = job_location.lower()

    # Step 1: Reject if the location contains any known non-US country name.
    if any(country in loc_lower for country in _NON_US_COUNTRIES):
        return False

    req_lower = requested_location.lower()

    # Step 2: If location says remote/hybrid, allow it.
    if any(w in loc_lower for w in ("remote", "hybrid", "anywhere")):
        return True

    # Step 3: If the requested location is "remote" or "anywhere", allow US locations.
    if req_lower in ("remote", "anywhere", "work from home"):
        return True

    # Step 4: Allow if job location contains keywords from requested location.
    req_keywords = [w for w in req_lower.replace(",", " ").split() if len(w) > 2]
    if any(kw in loc_lower for kw in req_keywords):
        return True

    # Step 5: US state/city patterns when requesting United States.
    us_req = "united states" in req_lower or "usa" in req_lower or req_lower.strip() == "us"
    if us_req:
        us_indicators = (
            "united states", ", ny", ", ca", ", tx", ", wa", ", fl", ", il",
            ", ga", ", ma", ", co", ", az", ", nc", ", oh", ", mi", ", pa",
            ", nj", ", va", ", mn", ", wi", ", or", ", tn", ", md", ", ct",
            "new york", "san francisco", "los angeles", "chicago", "seattle",
            "austin", "boston", "denver", "atlanta", "dallas", "houston",
            " usa", " us,", ", us",
        )
        if any(ind in loc_lower for ind in us_indicators):
            return True

    return False


def dedup_jobs(jobs: list[dict]) -> list[dict]:
    seen = set()
    result = []
    for job in jobs:
        key = f"{(job.get('title') or '').lower().strip()}|{(job.get('company') or '').lower().strip()}|{(job.get('location') or '').lower().strip()}"
        h = hashlib.md5(key.encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            result.append(job)
    return result

def normalize_job(row) -> dict:
    salary = None
    if pd.notna(row.get("min_amount")) and pd.notna(row.get("max_amount")):
        salary = f"${int(row['min_amount']):,} - ${int(row['max_amount']):,} {row.get('currency', 'USD')}"
    elif pd.notna(row.get("min_amount")):
        salary = f"${int(row['min_amount']):,}+ {row.get('currency', 'USD')}"

    return {
        "title": str(row.get("title", "")) if pd.notna(row.get("title")) else None,
        "company": str(row.get("company", "")) if pd.notna(row.get("company")) else None,
        "location": str(row.get("location", "")) if pd.notna(row.get("location")) else None,
        "description": str(row.get("description", "")) if pd.notna(row.get("description")) else "",
        "salary": salary,
        "source": str(row.get("site", "unknown")),
        "url": str(row.get("job_url", "")) if pd.notna(row.get("job_url")) else None,
    }

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/scrape-jobs", methods=["GET"])
def scrape():
    search_term = request.args.get("search_term", "software engineer")
    location = request.args.get("location", "United States")
    results_wanted = min(int(request.args.get("results_wanted", 50)), 100)

    sites = ["indeed", "linkedin", "glassdoor"]
    all_jobs = []

    for site in sites:
        try:
            logger.info(f"Scraping {site} for '{search_term}' in '{location}'")
            jobs_df = scrape_jobs(
                site_name=[site],
                search_term=search_term,
                location=location,
                results_wanted=results_wanted // len(sites) + 5,
                hours_old=72,
                country_indeed="USA",
                linkedin_fetch_description=(site == "linkedin"),
            )
            if jobs_df is not None and not jobs_df.empty:
                for _, row in jobs_df.iterrows():
                    normalized = normalize_job(row.to_dict())
                    if normalized["title"] and normalized["company"] and normalized["url"]:
                        all_jobs.append(normalized)
                logger.info(f"{site}: found {len(jobs_df)} jobs")
            # Polite delay between sites
            time.sleep(1)
        except Exception as e:
            logger.error(f"Error scraping {site}: {e}")
            continue

    deduped = dedup_jobs(all_jobs)

    # Filter out jobs whose location clearly doesn't match the requested location
    filtered = [j for j in deduped if is_location_match(j.get("location"), location)]
    rejected = len(deduped) - len(filtered)
    if rejected > 0:
        logger.info(f"Filtered out {rejected} jobs with non-matching locations")

    logger.info(f"Total unique jobs: {len(filtered)}")
    return jsonify(filtered[:results_wanted])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False, threaded=True)
