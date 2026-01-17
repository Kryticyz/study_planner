# ANU Course Database Scraper

A Python web scraper that builds a complete course database for any ANU (Australian National University) degree program. The output format is designed to match study planning application data structures.

## Features

- **Full Program Scraping**: Scrapes program pages, all related majors, and all courses
- **Recursive Prerequisites**: Automatically fetches all prerequisite courses
- **Complex Prerequisite Parsing**: Handles AND/OR logic, unit requirements, and incompatibilities
- **Caching**: Saves fetched HTML to avoid redundant requests
- **Rate Limiting**: Respects the website with delays and exponential backoff
- **Validation**: Checks data integrity and catches missing references
- **Multiple Output Modes**: Scrape full programs, specific courses, or validate existing files

## Installation

```bash
pip install requests beautifulsoup4 lxml
```

## Usage

### Scrape a Full Program

```bash
python anu_scraper.py aengi --year 2026 --output engineering_2026.json
```

### Scrape Specific Courses

```bash
python anu_scraper.py --courses ENGN4339,MATH1013,PHYS1101 --year 2026 --output courses.json
```

### Validate an Existing Database

```bash
python anu_scraper.py --validate database.json
```

### Options

| Flag | Description |
|------|-------------|
| `--year YEAR` | Academic year (default: 2026) |
| `--output FILE` | Output JSON file |
| `--no-cache` | Disable HTML caching |
| `--cache-dir DIR` | Cache directory (default: ./cache) |
| `--validate FILE` | Validate an existing database |
| `--no-prereqs` | Don't recursively fetch prerequisites |
| `--quiet` | Suppress progress output |

## Output Format

The scraper produces JSON matching the study planning application's TypeScript interfaces:

```json
{
  "metadata": {
    "program": "AENGI",
    "year": 2026,
    "scrapedAt": "2025-01-15T10:30:00Z",
    "stats": {
      "programs": 1,
      "majors": 7,
      "courses": 52
    }
  },
  "program": {
    "code": "AENGI",
    "name": "Bachelor of Engineering (Honours)",
    "totalUnits": 192,
    "duration": "4 year full-time",
    "majors": ["ASSY-MAJ", "MTSY-MAJ", ...],
    "requirements": [...]
  },
  "majors": {
    "ASSY-MAJ": {...},
    "MTSY-MAJ": {...}
  },
  "courses": {
    "ENGN1211": {...},
    "MATH1013": {...}
  }
}
```

### Course Format

Each course matches the `Course` interface:

```json
{
  "code": "MATH1116",
  "name": "Advanced Mathematics and Applications 2",
  "units": 6,
  "level": 1000,
  "college": "Science",
  "semesters": ["S2"],
  "prerequisites": ["MATH1115"],
  "prerequisiteAlternatives": [["MATH1115"], ["MATH1013"]],
  "incompatible": ["MATH1014"],
  "description": "Honours-track multivariable calculus and ODEs",
  "type": "foundation"
}
```

## Prerequisite Parsing

The scraper handles complex prerequisite logic:

| Input | Output |
|-------|--------|
| `MATH1013` | `["MATH1013"]` |
| `ENGN2218 and ENGN3338` | `["ENGN2218", "ENGN3338"]` |
| `COMP1100 or COMP1730` | `prerequisiteAlternatives: [["COMP1100"], ["COMP1730"]]` |
| `(MATH1013 or MATH1115) and PHYS1001` | Complex expression with both |

## Package Structure

```
anu_scraper/
├── anu_scraper.py          # Main CLI script
├── anu_scraper/
│   ├── __init__.py         # Package exports
│   ├── cache.py            # HTML caching and rate limiting
│   ├── fetcher.py          # HTTP request handling
│   ├── prerequisites.py    # Prerequisite parsing
│   ├── course.py           # Course page scraping
│   ├── major.py            # Major page scraping
│   ├── program.py          # Program page scraping
│   └── validate.py         # Data validation
└── README.md
```

## Development

### Testing the Prerequisite Parser

```python
from anu_scraper import parse_prerequisite_text

result = parse_prerequisite_text("(MATH1013 or MATH1115) and PHYS1001")
print(result.prerequisites)
print(result.prerequisiteAlternatives)
```

### Adding New Parsers

The scraper uses BeautifulSoup with lxml. To add support for new page elements:

1. Examine the HTML structure of the target page
2. Add extraction logic in the appropriate module
3. Update the data models if needed

## Troubleshooting

### Missing Courses

Some courses may not be found if:
- They don't exist for the specified year
- The URL pattern is different
- The page structure is unusual

Check the stderr output for 404 errors and investigate manually.

### Incorrect Prerequisites

The prerequisite parser handles common patterns but may fail on unusual formats. If you encounter issues:

1. Check the raw prerequisite text from the page
2. Add new patterns to `prerequisites.py`
3. Submit a bug report with the problematic text

## License

MIT License
