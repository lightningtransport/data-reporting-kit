"""Synthetic canonical workflow regression checks, NOT historical/native-client evidence."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/itpros-supabase-reporting/scripts'))
from reporting_workflows import _fuel_totals, WorkflowFallback  # pyright: ignore[reportMissingImports]


class FuelNumericContractTests(unittest.TestCase):
    def test_decimals_zero_and_legitimate_negatives(self):
        rows = [{'Gallons': '1.25', 'Adjusted SubTotal': '2.50'},
                {'Gallons': 0, 'Adjusted SubTotal': 0},
                {'Gallons': '-0.25', 'Adjusted SubTotal': '-0.50'}]
        result = _fuel_totals(rows)
        self.assertEqual(result['gallons'], '1.00')
        self.assertEqual(result['adjusted_spend'], '2.00')
        self.assertTrue(result['gallons_complete'])
        self.assertTrue(result['spend_complete'])

    def test_partial_null_counts_and_matching_price_population(self):
        rows = [{'Gallons': '1.25', 'Adjusted SubTotal': None, 'SubTotal': 999},
                {'Gallons': None, 'Adjusted SubTotal': '2.50'},
                {'Gallons': 2, 'Adjusted SubTotal': 8}]
        result = _fuel_totals(rows)
        self.assertEqual(result['gallons'], '3.25')
        self.assertEqual(result['adjusted_spend'], '10.50')
        self.assertEqual(result['weighted_price_per_gallon'], '4')
        self.assertEqual(result['null_gallon_rows'], 1)
        self.assertEqual(result['null_adjustment_rows'], 1)
        self.assertFalse(result['gallons_complete'])
        self.assertFalse(result['spend_complete'])

    def test_nonempty_all_null_returns_null_not_zero(self):
        result = _fuel_totals([{'Gallons': None, 'Adjusted SubTotal': None}])
        self.assertIsNone(result['gallons'])
        self.assertIsNone(result['adjusted_spend'])
        self.assertIsNone(result['weighted_price_per_gallon'])
        self.assertEqual(result['null_gallon_rows'], 1)
        self.assertEqual(result['null_adjustment_rows'], 1)

    def test_validated_empty_selection_is_zero_transactions(self):
        result = _fuel_totals([])
        self.assertEqual(result['transaction_count'], 0)
        self.assertEqual(result['gallons'], '0')
        self.assertEqual(result['adjusted_spend'], '0')

    def test_malformed_boolean_and_nonfinite_fail_closed(self):
        for value in ('', 'unknown', '1,23', '$3', True, False,
                      float('nan'), float('inf'), '-Infinity'):
            for field in ('Gallons', 'Adjusted SubTotal'):
                with self.subTest(field=field, value=repr(value)):
                    row: dict[str, object] = {'Gallons': None, 'Adjusted SubTotal': None}
                    row[field] = value
                    with self.assertRaises(WorkflowFallback):
                        _fuel_totals([row])

    def test_missing_projected_key_is_not_permitted_null(self):
        for field in ('Gallons', 'Adjusted SubTotal'):
            row: dict[str, object] = {'Gallons': None, 'Adjusted SubTotal': None}
            del row[field]
            with self.subTest(field=field), self.assertRaises(KeyError):
                _fuel_totals([row])

    def test_disjoint_owner_pairs_do_not_duplicate_shared_transaction(self):
        rows = [{'owner': 'SOLO INC.', 'shared_owner': 'Jorge',
                 'Gallons': '1.25', 'Adjusted SubTotal': '2.50'},
                {'owner': 'Jorge', 'shared_owner': None,
                 'Gallons': '2.75', 'Adjusted SubTotal': '5.50'}]
        groups = {}
        for row in rows:
            groups.setdefault((row['owner'], row['shared_owner']), []).append(row)
        self.assertEqual(sum(_fuel_totals(g)['transaction_count'] for g in groups.values()), 2)
        self.assertEqual(_fuel_totals(rows)['adjusted_spend'], '8.00')


if __name__ == '__main__':
    unittest.main()
