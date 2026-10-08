"""Synthetic importer regressions; not a replay of the historical fuel incident.

No API calls or database writes. FUEL_IMPORTER_PATH can exercise the runtime
copy with this same suite; the default is the versioned canonical importer.
"""
import contextlib
import importlib.util
import io
import json
import math
import os
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
IMPORTER_PATH = Path(os.environ.get(
    "FUEL_IMPORTER_PATH", str(ROOT / "scripts/importers/ninox_to_supabase_fuel.py")))
spec = importlib.util.spec_from_file_location("fuel_importer", IMPORTER_PATH)
assert spec is not None and spec.loader is not None
fuel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fuel)


class FuelImporterTests(unittest.TestCase):
    def number(self, value):
        return fuel.normalize_number(value, field="A3", record_id=42)

    def test_ambiguous_currency_and_locale_are_rejected_not_reinterpreted(self):
        # Ninox documents number -> JSON number, not a currency/locale grammar.
        for value in ["1,23", "1.234,56", "$123", "12$3", "1,234.56", "1,,2",
                      "1_000", "１２３"]:
            with self.subTest(value=value), self.assertRaisesRegex(
                    fuel.SyncError, "Ninox record 42: invalid numeric A3"):
                self.number(value)

    def test_values_outside_finite_float_range_are_rejected(self):
        for value in ["1e309", "-1e309", "1" + "0" * 309 + ".1"]:
            with self.subTest(value=value), self.assertRaisesRegex(
                    fuel.SyncError, "Ninox record 42: out-of-range numeric A3"):
                self.number(value)

    def test_nonzero_values_that_underflow_to_zero_are_rejected(self):
        for value in ["1e-10000", "-1e-10000"]:
            with self.subTest(value=value), self.assertRaisesRegex(
                    fuel.SyncError, "Ninox record 42: out-of-range numeric A3"):
                self.number(value)

    def test_null_and_blank_are_unknown_not_zero(self):
        for value in [None, "", " ", "\t\n"]:
            with self.subTest(value=value):
                try:
                    actual = self.number(value)
                except fuel.SyncError as error:
                    self.fail(f"Blank should remain unknown/null, not fail: {error}")
                self.assertIsNone(actual)

    def test_unambiguous_numbers_preserve_existing_int_float_behavior(self):
        for value, expected in [(0, 0), ("0", 0), ("-0.00", 0), (42, 42),
                                (42.0, 42), (" 12.50 ", 12.5),
                                ("-1.25", -1.25), ("+2.5e2", 250),
                                (Decimal("3.125"), 3.125), (5e-324, 5e-324)]:
            with self.subTest(value=value):
                actual = self.number(value)
                self.assertEqual(actual, expected)
                self.assertIs(type(actual), type(expected))
                self.assertTrue(math.isfinite(actual))

    def test_booleans_nonfinite_and_nonnumeric_values_remain_rejected(self):
        for value in [True, False, "NaN", "Infinity", "-Infinity",
                      float("nan"), float("inf"), Decimal("sNaN"),
                      [], {}, "unknown", "12 gallons"]:
            with self.subTest(value=repr(value)), self.assertRaises(fuel.SyncError):
                self.number(value)

    def test_mapping_and_source_text_are_unchanged(self):
        names = {fid: fid for fid in fuel.FIELD_MAPPING.values()}
        record = {"id": 42, "fields": {
            "F": 901, "Z": "2026-10-01", "L4": " Diesel ", "G3": 12.5,
            "A3": "10.25", "V4": 3, "N3": " City ", "O3": "NY",
            "I5": 3.5, "R4": " OWNER "}}
        self.assertEqual(fuel.transform(record, names), {
            "Ninox_ID": 42, "Unit": 901, "Store Date": "2026-10-01",
            "Product": " Diesel ", "SubTotal": 12.5, "Adjusted SubTotal": 10.25,
            "Gallons": 3, "City": " City ", "State": "NY",
            "Price_Per_Gallon": 3.5, "owner": " OWNER "})

    def test_omitted_numeric_source_key_fails_until_sparse_contract_is_documented(self):
        names = {fid: fid for fid in fuel.FIELD_MAPPING.values()}
        fields = {names[fid]: None for col, fid in fuel.FIELD_MAPPING.items()
                  if col in fuel.NUMERIC_COLUMNS}
        for col in ('Gallons', 'Adjusted SubTotal'):
            source = dict(fields)
            del source[names[fuel.FIELD_MAPPING[col]]]
            with self.subTest(col=col), self.assertRaisesRegex(fuel.SyncError, 'missing numeric source field'):
                fuel.transform({'id': 42, 'fields': source}, names)
        row = fuel.transform({'id': 42, 'fields': fields}, names)
        self.assertIsNone(row['Gallons'])
        self.assertIsNone(row['Adjusted SubTotal'])

    def test_http_decode_preserves_decimal_until_validation(self):
        response = io.BytesIO(b'{"amount":1.234567890123456789}')
        with patch.object(fuel.urllib.request, 'urlopen', return_value=response):
            result = fuel.request_json(fuel.urllib.request.Request('https://example.invalid'))
        self.assertIsInstance(result['amount'], Decimal)
        self.assertEqual(result['amount'], Decimal('1.234567890123456789'))
        with self.assertRaises(fuel.SyncError):
            self.number(result['amount'])

    def test_precision_changing_float_conversion_is_rejected(self):
        for value in ('1.234567890123456789', '0.1000000000000000001'):
            with self.subTest(value=value), self.assertRaisesRegex(fuel.SyncError, 'precision-changing numeric'):
                self.number(value)

    def test_transform_rejects_bad_numeric_source_with_record_and_field_context(self):
        names = {fid: fid for fid in fuel.FIELD_MAPPING.values()}
        with self.assertRaisesRegex(fuel.SyncError, "Ninox record 42: invalid numeric A3"):
            fuel.transform({"id": 42, "fields": {"F": None, "G3": None, "A3": "1,23", "V4": None, "I5": None}}, names)

    def test_dry_run_keeps_cursor_and_never_invokes_write(self):
        names = {fid: fid for fid in fuel.FIELD_MAPPING.values()}
        output = io.StringIO()
        with patch("sys.argv", ["fuel", "--dry-run"]), \
                patch.object(fuel, "require_env", return_value="unused"), \
                patch.object(fuel, "get_supabase_max_ninox_id", return_value=41), \
                patch.object(fuel, "get_field_names_by_id", return_value=names), \
                patch.object(fuel, "iter_ninox_records", return_value=iter([
                    {"id": 42, "fields": {"F": None, "G3": None, "A3": 10.25, "V4": None, "I5": None}}])) as records, \
                patch.object(fuel, "supabase_upsert") as write, \
                contextlib.redirect_stdout(output):
            self.assertEqual(fuel.main(), 0)
            records.assert_called_once_with(100, None, 41)
            write.assert_not_called()
        result = json.loads(output.getvalue())
        self.assertEqual(result["mode"], "dry-run")
        self.assertEqual(result["records_validated"], 1)
        self.assertEqual(result["after_ninox_id"], 41)


if __name__ == "__main__":
    unittest.main()
