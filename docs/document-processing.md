# Document processing engine

`backend/app/modules/document_processing/` — a modular pipeline behind `POST /api/v1/statement-processing/process`.

```
validate → detect type & encryption → decrypt → extract → identify bank → parse → normalize
        → categorize → flag duplicates → reconcile
```

| Module | Job |
|---|---|
| `detect.py` | Content-based type sniffing; extension must agree; zip-bomb guard |
| `extract.py` | PDF text layer (PyMuPDF words with positions), OCR fallback, CSV (encoding/delimiter detection), XLSX (openpyxl) / XLS (xlrd), Office decryption (msoffcrypto) |
| `ocr.py` | `OcrEngine` protocol + Tesseract implementation (injectable) |
| `parsers/table.py` | CSV/Excel: header detection, column mapping, wrapped descriptions, opening/closing rows |
| `parsers/pdf_table.py` | PDF: rebuild lines from words, find the header, assign amounts to columns by horizontal position, multi-page, repeated headers |
| `parsers/common.py` | Debit/credit direction, newest-first reordering, opening/closing derivation |
| `parsers/banks.py` | **Bank adapters** — extension point for bank-specific rules (merchant/method extraction, labels) |
| `money.py` | Exact `Decimal` amount parsing (Indian/Western grouping, decimal comma, `(neg)`, `Dr/Cr`) and date parsing with day-/month-first inference |
| `categorize.py` | Keyword category *suggestions* with confidence |
| `analysis.py` | Duplicate flags and reconciliation |
| `service.py` | Orchestration, limits, result assembly |

## Supported
- **PDF** with a text layer and a header row (Date / Description / Debit / Credit / Amount / Balance, in many wordings). Password-protected PDFs (AES-256, RC4-128 tested).
- **Scanned PDF** via OCR — *when* `OCR_ENABLED=true` and Tesseract is installed. Each OCR row carries its confidence; low-confidence rows are flagged.
- **CSV** (`,` `;` tab `|`; UTF-8/UTF-16/Windows-1252), **XLSX**, **XLS**, including password-protected Excel.
- Statements with split debit/credit columns, or one signed amount column, or amount + Dr/Cr marker. Unsigned amounts are inferred from balance changes **only when that's unambiguous**; otherwise the file is refused (`ambiguous_amounts`).

## Not supported / limitations (honest list)
- **OCR has not been exercised with real Tesseract in this repo's tests** — Tesseract isn't installed on the development machine. The OCR path is tested with an injected fake engine that returns the words a real OCR would; real-world accuracy on actual scans is unmeasured.
- Layouts without a recognisable header row, headers split across two lines, multi-column ("two statements per page") layouts, and image-embedded tables inside text PDFs.
- No bank-specific adapters beyond labelling and generic merchant/method extraction; each bank's quirks will need real sample statements.
- Credit-card statements (purchases vs. payments, double-counting) are not specially modelled.
- Foreign currency: amounts are parsed as numbers; currency isn't detected (the app assumes INR).
- Parsed statements aren't persisted by the API yet (Phase 6).

## Adding a bank
Subclass `BankAdapter` in `parsers/banks.py` (override `merchant`/`method`), add its keywords, register it before `GENERIC`, and add a test using a real (anonymised) statement.

## Tests
`backend/tests/test_dp_*.py` — 117 tests that build **real files** (PDFs with columns, AES/RC4-encrypted PDFs, image-only PDFs, CSV variants, XLSX with real Office encryption, XLS) with `tests/dp_fixtures.py` and run the real pipeline. Run `cd backend && .venv/Scripts/python -m pytest tests -q`.
