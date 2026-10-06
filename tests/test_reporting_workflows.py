"""Offline synthetic mock-API fixtures; never operational business data."""
import importlib.util
import json
from pathlib import Path
import unittest
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / 'skills/itpros-supabase-reporting/scripts/reporting_workflows.py'


def load_module():
    assert MODULE.exists(), 'workflow module not implemented'
    spec = importlib.util.spec_from_file_location('reporting_workflows', MODULE)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PlanTests(unittest.TestCase):
    def test_operational_periods_are_tuesday_monday_and_monday_is_partial(self):
        w = load_module()
        monday = datetime(2026, 10, 5, 16, tzinfo=timezone.utc)
        last = w.build_plan('diesel_totals', 'last_full_week', monday)
        self.assertEqual(last['period']['from'], '2026-09-22')
        self.assertEqual(last['period']['to'], '2026-09-28')
        current = w.build_plan('returning_trucks', 'current_week', monday)
        self.assertEqual(current['period']['from'], '2026-09-29')
        self.assertEqual(current['period']['to'], '2026-10-05')
        self.assertTrue(current['period']['partial'])
        self.assertEqual(last['queries'], [{'report': 'fuel', 'params': {'store_from': '2026-09-22', 'store_to': '2026-09-28'}}])

    def test_departures_today_and_rejected_windows(self):
        w = load_module()
        now = datetime(2026, 10, 6, 2, tzinfo=timezone.utc)  # Monday in NY
        plan = w.build_plan('departing_trucks', 'current_week', now)
        self.assertEqual(plan['queries'], [{'report': 'departures', 'params': {'out_from': '2026-10-05', 'out_to': '2026-10-11'}}])
        plan = w.build_plan('fleet_count', 'unspecified', now)
        self.assertEqual(plan['period']['from'], '2026-10-05')
        self.assertEqual(plan['queries'], [{'report': 'trucks', 'params': {}}])
        self.assertEqual(w.build_plan('on_road_count', 'today', now)['queries'], [{'report': 'driver_pay', 'params': {'on_road_at': '2026-10-05'}}])
        for workflow, window in [('bogus', 'today'), ('diesel_totals', 'current_week'), ('fleet_count', 'last_full_week'), ('returning_trucks', '2026-09-01'), ('on_road_count', 'unspecified')]:
            with self.subTest(workflow=workflow, window=window):
                with self.assertRaises(w.WorkflowFallback):
                    w.build_plan(workflow, window, now)
        with self.assertRaises(w.WorkflowFallback):
            w.build_plan('fleet_count', 'today', datetime(2026, 10, 5))


FIELDS = {
    'trucks': ['truck_number'],
    'driver_pay': ['Truck_Number', 'Out Date', 'Return Date', 'Termination', 'Transfer', 'Solo_Driver_if_1'],
    'returns': ['Truck', 'Return Date'],
    'fuel': ['Product', 'Store Date', 'Gallons', 'Adjusted SubTotal'],
    'outside_repairs': ['Date', 'Total Cost'],
    'departures': ['combined_distinct_total'],
}
FILTERS = {'trucks': [], 'driver_pay': ['on_road_at', 'return_from', 'return_to'],
           'returns': ['return_from', 'return_to'], 'fuel': ['store_from', 'store_to'],
           'outside_repairs': ['date_from', 'date_to'], 'departures': ['out_from', 'out_to']}


class MockAPI:
    """Synthetic envelopes emulate the authenticated API and existing collection helper."""
    def __init__(self, rows=None):
        self.calls = []
        self.catalog = {'schema_version': '3.8.1', 'principal': {'allowed_reports': list(FIELDS)}, 'reports': {r: {} for r in FIELDS}}
        self.metadata = {r: {'schema_version': '3.8.1', 'report': r, 'source': 'mock.' + r,
                            'fields': {f: {'type': 'mock'} for f in fields},
                            'filters': {f: 'mock' for f in FILTERS[r]}} for r, fields in FIELDS.items()}
        self.metadata['departures'].pop('fields')
        self.metadata['departures'].update(required_reports=['departures', 'driver_pay', 'out_schedule'],
            returned_fields=['status', 'complete', 'period', 'reconciliation', 'truck_sets', 'source_status'],
            reconciliation_fields=['driver_pay_count', 'schedule_teams_count', 'driver_pay_only_count', 'schedule_teams_only_count', 'overlap_count', 'combined_distinct_total'])
        self.catalog['principal']['allowed_reports'].append('out_schedule')
        self.catalog['reports']['out_schedule'] = {}
        self.rows = rows or {}
        self.envelopes = {}

    def request(self, params):
        self.calls.append(('request', params.copy()))
        return self.catalog if params['report'] == 'catalog' else self.metadata[params['report']]

    def collect(self, report, params):
        self.calls.append(('collect', report, params.copy()))
        rows = self.rows.get(report, [])
        return {'schema_version': '3.8.1', 'report': report, 'source': 'mock.' + report,
                'filters': {k: v for k, v in params.items() if k not in ('limit', 'include_sensitive')},
                'data': rows, 'complete': True, 'fetched_count': len(rows), 'total_count': len(rows),
                'as_of_first_page': '2026-10-06T15:00:00Z', 'as_of_last_page': '2026-10-06T15:00:01Z',
                'source_freshness': 'mock sync unknown', **self.envelopes.get(report, {})}


class ExecuteTests(unittest.TestCase):
    def setUp(self):
        self.w = load_module()
        self.now = datetime(2026, 10, 6, 15, tzinfo=timezone.utc)

    def run_workflow(self, workflow, api, window='today'):
        self.assertTrue(callable(getattr(self.w, 'execute_plan', None)), 'executor not implemented')
        return self.w.execute_plan(self.w.build_plan(workflow, window, self.now), api.request, api.collect)

    def test_verified_fuel_policy_caveats_do_not_claim_unknown_products_are_excluded(self):
        api = MockAPI({'fuel':[{'Product':'Premium Diesel #2','Store Date':'2026-09-30',
                              'Gallons':1,'Adjusted SubTotal':3}]})
        result=self.run_workflow('diesel_totals',api,'last_full_week')
        self.assertTrue(any('verified exact identity policy' in text for text in result['caveats']))
        self.assertTrue(any('metadata does not enumerate' in text for text in result['caveats']))
        self.assertFalse(any('unrecognized products are excluded' in text for text in result['caveats']))

    def test_fleet_distinct_numeric_keys_includes_one_two_three_and_evidence(self):
        api = MockAPI({'trucks': [{'truck_number': n, 'SECRET': 'must not return'} for n in [1, '1.0', 2, 3, '004', 4]]})
        result = self.run_workflow('fleet_count', api)
        self.assertEqual(result['metrics']['fleet_count'], 4)
        self.assertEqual(api.calls[0], ('request', {'report': 'catalog', 'compact': True}))
        self.assertEqual(api.calls[1], ('request', {'report': 'trucks', 'metadata': 'true'}))
        self.assertEqual(len(api.calls), 3)
        self.assertEqual(result['evidence']['trucks']['fetched_count'], 6)
        self.assertEqual(result['evidence']['trucks']['as_of_last_page'], '2026-10-06T15:00:01Z')
        self.assertNotIn('SECRET', json.dumps(result))
        self.assertNotIn('data', result['evidence']['trucks'])

    def test_catalog_denial_and_schema_mismatch_never_query_data(self):
        for schema, allowed, reason in [('unknown', list(FIELDS), 'unsupported_schema'), ('3.8.1', [], 'permission_denied')]:
            api = MockAPI()
            api.catalog['schema_version'] = schema
            api.catalog['principal']['allowed_reports'] = allowed
            with self.assertRaises(self.w.WorkflowFallback) as ctx:
                self.run_workflow('fleet_count', api)
            self.assertEqual(ctx.exception.reason, reason)
            self.assertEqual(len(api.calls), 1)

    def test_invalid_envelopes_rows_metadata_and_unapproved_plan_fallback(self):
        for patch in [{'complete': False}, {'fetched_count': 0}, {'total_count': True}, {'report': 'fuel'}, {'source': None}, {'as_of_first_page': None}, {'schema_version': '3.8.0'}, {'filters': {'owner': 'unrequested'}}]:
            with self.subTest(patch=patch):
                api = MockAPI({'trucks': [{'truck_number': 1}]})
                api.envelopes['trucks'] = patch
                with self.assertRaises(self.w.WorkflowFallback):
                    self.run_workflow('fleet_count', api)
        for row in [{}, {'truck_number': True}, {'truck_number': float('nan')}, {'truck_number': float('inf')}, {'truck_number': None}, {'truck_number': 'ABC'}]:
            with self.subTest(row=row):
                with self.assertRaises(self.w.WorkflowFallback):
                    self.run_workflow('fleet_count', MockAPI({'trucks': [row]}))
        api = MockAPI()
        api.metadata['trucks']['fields'] = {}
        with self.assertRaises(self.w.WorkflowFallback):
            self.run_workflow('fleet_count', api)
        self.assertFalse(any(c[0] == 'collect' for c in api.calls))
        api = MockAPI()
        plan = self.w.build_plan('fleet_count', 'today', self.now)
        plan['queries'][0]['params']['owner'] = 'unapproved'
        with self.assertRaises(self.w.WorkflowFallback):
            self.w.execute_plan(plan, api.request, api.collect)
        self.assertEqual(api.calls, [])

    def test_onroad_date_predicate_null_and_return_day_excluded_no_other_exclusions(self):
        rows = [{'Truck_Number': truck, 'Out Date': out, 'Return Date': ret, 'Termination': 'Driver Changed'}
                for truck, out, ret in [('001', '2020-01-01', '2026-10-07'), ('1.0', '2026-10-06', '2026-10-08'),
                                        ('2', '2026-10-01', '2026-10-06'), ('3', '2026-10-01', None),
                                        ('4', '2026-10-07', '2026-10-09'), (' ', '2026-10-01', '2026-10-09')]]
        api = MockAPI({'driver_pay': rows})
        result = self.run_workflow('on_road_count', api)
        self.assertEqual(result['metrics']['on_road_count'], 1)
        self.assertEqual(result['metrics']['excluded_null_return_rows'], 1)
        self.assertEqual(api.calls[-1][2]['on_road_at'], '2026-10-06')
        for invalid in ['2026-02-30', '20261001', 123, 'yesterday']:
            rows[0]['Out Date'] = invalid
            with self.subTest(invalid=invalid), self.assertRaises(self.w.WorkflowFallback):
                self.run_workflow('on_road_count', api)

    def test_outside_repairs_once_truckless_and_null_cost_coverage(self):
        rows = [{'Date': '2026-09-29', 'Total Cost': '10.10', 'Truck': None},
                {'Date': '2026-10-05', 'Total Cost': '20.20', 'Truck': 1, 'Choice': 'Trailer', 'Type of Work': 'A,B'},
                {'Date': '2026-10-01', 'Total Cost': None}]
        api = MockAPI({'outside_repairs': rows})
        result = self.run_workflow('outside_repair_totals', api, 'last_full_week')
        self.assertEqual(result['metrics'], {'total_cost': '30.30', 'repair_count': 3, 'populated_cost_rows': 2, 'null_cost_rows': 1, 'cost_complete': False})
        self.assertTrue(any('partial' in c for c in result['caveats']))
        self.assertNotIn('breakdown', json.dumps(result))
        for bad in [True, 'NaN', 'Infinity', 'oops']:
            rows[0]['Total Cost'] = bad
            with self.subTest(bad=bad), self.assertRaises(self.w.WorkflowFallback):
                self.run_workflow('outside_repair_totals', api, 'last_full_week')
        rows[0]['Total Cost'] = '10.10'
        rows[0]['Date'] = '2026-09-28'
        with self.assertRaises(self.w.WorkflowFallback):
            self.run_workflow('outside_repair_totals', api, 'last_full_week')
        null_result = self.run_workflow('outside_repair_totals', MockAPI({'outside_repairs': [{'Date': '2026-10-01', 'Total Cost': None}]}), 'last_full_week')
        self.assertIsNone(null_result['metrics']['total_cost'])

    def test_diesel_unverified_product_identity_fails_closed(self):
        unknown_labels = ['Diesel fuel additive', 'Diesel engine oil', 'Biodiesel',
                          'Diesel / DEF', 'Diesel', 'ULTRA DIESEL #2', 'Bulk DEF',
                          'premium diesel #2', 'Premium Diesel #2 ', 'DEF (Bulk)',
                          None, '', 1, {'label': 'Premium Diesel #2'}, ['DEF (bulk)']]
        for label in unknown_labels:
            for mixed in (False, True):
                with self.subTest(label=label, mixed=mixed):
                    rows = [{'Product': label, 'Store Date': '2026-09-29',
                             'Gallons': '100', 'Adjusted SubTotal': '500',
                             'SECRET': 'must not return'}]
                    if mixed:
                        rows.insert(0, {'Product': 'Premium Diesel #2', 'Store Date': '2026-09-29',
                                        'Gallons': '10', 'Adjusted SubTotal': '40'})
                    api = MockAPI({'fuel': rows})
                    # Metadata membership alone must not authorize a new SKU.
                    if isinstance(label, str):
                        api.metadata['fuel']['fields']['Product']['enum'] = ['Premium Diesel #2', label]
                    with self.assertRaises(self.w.WorkflowFallback) as ctx:
                        self.run_workflow('diesel_totals', api, 'last_full_week')
                    self.assertEqual(ctx.exception.reason, 'unrecognized_product')
                    self.assertIsInstance(ctx.exception.evidence, dict)
                    self.assertNotIn('metrics', ctx.exception.evidence)
                    self.assertNotIn('SECRET', json.dumps(ctx.exception.evidence))
                    self.assertNotIn('data', ctx.exception.evidence)

    def test_def_missing_values_remain_unknown_and_separate_from_diesel(self):
        rows = [{'Product': 'Premium Diesel #2', 'Store Date': '2026-09-29',
                 'Gallons': '10', 'Adjusted SubTotal': '40'},
                {'Product': 'DEF (bulk)', 'Store Date': '2026-09-29',
                 'Gallons': None, 'Adjusted SubTotal': None}]
        result = self.run_workflow('diesel_totals', MockAPI({'fuel': rows}), 'last_full_week')
        self.assertEqual(result['metrics']['diesel']['gallons'], '10')
        self.assertEqual(result['metrics']['diesel']['adjusted_spend'], '40')
        def_metrics = result['metrics']['def']
        self.assertIsNone(def_metrics['gallons'])
        self.assertIsNone(def_metrics['adjusted_spend'])
        self.assertIsNone(def_metrics['weighted_price_per_gallon'])
        self.assertEqual(def_metrics['null_gallon_rows'], 1)
        self.assertEqual(def_metrics['null_adjustment_rows'], 1)
        self.assertFalse(def_metrics['gallons_complete'])
        self.assertFalse(def_metrics['spend_complete'])

    def test_diesel_exact_source_labels_def_separate_nulls_and_weighted_price(self):
        def fuel(label, gallons, spend):
            return {'Product': label, 'Store Date': '2026-09-29', 'Gallons': gallons, 'Adjusted SubTotal': spend, 'SubTotal': '9999'}
        rows = [fuel('Premium Diesel #2', '10', '40'), fuel('Premium Diesel #2', '20', '100'),
                fuel('Premium Diesel #2', '5', None), fuel('Premium Diesel #2', None, '30'),
                fuel('DEF (bulk)', '2', '4')]
        api = MockAPI({'fuel': rows})
        result = self.run_workflow('diesel_totals', api, 'last_full_week')
        m = result['metrics']['diesel']
        self.assertEqual(m['gallons'], '35')
        self.assertEqual(m['adjusted_spend'], '170')
        self.assertEqual(m['eligible_gallons'], '30')
        self.assertEqual(m['eligible_adjusted_spend'], '140')
        self.assertEqual(m['excluded_null_adjustment_gallons'], '5')
        self.assertEqual(m['null_adjustment_rows'], 1)
        self.assertEqual(m['null_gallon_rows'], 1)
        self.assertEqual(m['transaction_count'], 4)
        self.assertEqual(m['weighted_price_per_gallon'], '4.666666666666666666666666667')
        self.assertFalse(m['spend_complete'])
        self.assertFalse(m['gallons_complete'])
        self.assertEqual(result['metrics']['def']['gallons'], '2')
        labels = result['evidence']['product_labels']
        self.assertEqual(labels['basis'], 'verified_exact_identity_policy')
        self.assertEqual(labels['diesel'], ['Premium Diesel #2'])
        self.assertEqual(labels['def'], ['DEF (bulk)'])
        self.assertEqual(labels['unrecognized'], [])
        self.assertTrue(any('verified exact identity policy' in c for c in result['caveats']))
        self.assertEqual(len([c for c in api.calls if c[0] == 'collect']), 1)
        self.assertNotIn('product', api.calls[-1][2])
        self.assertTrue(any('partial' in c for c in result['caveats']))

    def test_diesel_uninformed_zero_refused_metadata_enums_and_bad_values(self):
        for label in [None, 'Biodiesel', 'DEF', 'Diesel DEF', 'Dieselish']:
            rows = [] if label is None else [{'Product': label, 'Store Date': '2026-09-29', 'Gallons': 1, 'Adjusted SubTotal': 1}]
            with self.subTest(label=label), self.assertRaises(self.w.WorkflowFallback):
                self.run_workflow('diesel_totals', MockAPI({'fuel': rows}), 'last_full_week')
        row = {'Product': 'Premium Diesel #2', 'Store Date': '2026-09-29', 'Gallons': None, 'Adjusted SubTotal': None}
        api = MockAPI({'fuel': [row]})
        api.metadata['fuel']['fields']['Product']['enum'] = ['Premium Diesel #2', 'DEF (bulk)']
        result = self.run_workflow('diesel_totals', api, 'last_full_week')
        self.assertIsNone(result['metrics']['diesel']['gallons'])
        self.assertIsNone(result['metrics']['diesel']['adjusted_spend'])
        self.assertNotIn('def', result['metrics'])
        self.assertEqual(result['evidence']['product_labels']['basis'], 'verified_exact_identity_policy')
        self.assertFalse(any('does not enumerate' in c for c in result['caveats']))
        api.metadata['fuel']['fields']['Product']['enum'] = ['DEF (bulk)']
        with self.assertRaises(self.w.WorkflowFallback):
            self.run_workflow('diesel_totals', api, 'last_full_week')
        api.metadata['fuel']['fields']['Product'].pop('enum')
        for field, bad in [('Gallons', True), ('Adjusted SubTotal', 'NaN'), ('Product', 1), ('Store Date', '2026-10-06')]:
            bad_row = {**row, field: bad}
            with self.subTest(field=field), self.assertRaises(self.w.WorkflowFallback):
                self.run_workflow('diesel_totals', MockAPI({'fuel': [bad_row]}), 'last_full_week')

    def test_return_union_exclusions_formula_reconciliation_and_same_period(self):
        def dp(truck, solo=None, termination=None, transfer=None):
            return {'Truck_Number': truck, 'Return Date': '2026-10-06', 'Solo_Driver_if_1': solo, 'Termination': termination, 'Transfer': transfer}
        api = MockAPI({'driver_pay': [dp('001'), dp('1.0'), dp('2', '1'), dp('3', 0),
                                     dp('8', termination='Driver Changed'), dp('9', transfer='Transfer To Other Truck')],
                       'returns': [{'Truck': 1, 'Return Date': '2026-10-06'}, {'Truck': '4.0', 'Return Date': '2026-10-12'}]})
        result = self.run_workflow('returning_trucks', api, 'current_week')
        self.assertEqual(result['metrics'], {'returning_trucks': 4, 'driver_pay_count': 3, 'returns_count': 2,
                                            'overlap_count': 1, 'driver_pay_only_count': 2, 'returns_only_count': 1,
                                            'tc': 3, 'ts': 1, 'formula_count': 2, 'formula_agrees': False,
                                            'excluded_driver_pay_rows': 2})
        self.assertEqual(result['evidence']['truck_sets']['combined'], ['1', '2', '3', '4'])
        self.assertTrue(any('disagree' in c for c in result['caveats']))
        self.assertTrue(any('volatile' in c for c in result['caveats']))
        collects = [c for c in api.calls if c[0] == 'collect']
        self.assertEqual([c[1] for c in collects], ['driver_pay', 'returns'])
        self.assertEqual(collects[0][2], collects[1][2])
        self.assertEqual([c[0] for c in api.calls], ['request', 'request', 'request', 'collect', 'collect'])
        api.envelopes['returns'] = {'complete': False}
        with self.assertRaises(self.w.WorkflowFallback):
            self.run_workflow('returning_trucks', api, 'current_week')
        api.envelopes = {}
        api.rows['returns'][0]['Return Date'] = '2026-10-05'
        with self.assertRaises(self.w.WorkflowFallback):
            self.run_workflow('returning_trucks', api, 'current_week')

    def departure_api(self):
        api = MockAPI()
        api.envelopes['departures'] = {
            'as_of': '2026-10-06T15:00:00Z', 'status': 'complete', 'complete': True,
            'period': {'out_from': '2026-10-05', 'out_to': '2026-10-11', 'time_zone': 'America/New_York'},
            'reconciliation': {'driver_pay_count': 2, 'schedule_teams_count': 2, 'driver_pay_only_count': 1,
                               'schedule_teams_only_count': 1, 'overlap_count': 1, 'combined_distinct_total': 3},
            'truck_sets': {'driver_pay': ['1', '2'], 'schedule_teams': ['2', '3'], 'driver_pay_only': ['1'],
                           'schedule_teams_only': ['3'], 'overlap': ['2'], 'combined': ['1', '2', '3']},
            'source_status': {'driver_pay': {'status': 'complete'}, 'schedule_teams': {'status': 'complete'}},
            'total_count': 1, 'page_count': 1, 'count': 1, 'has_more': False, 'next_offset': None,
            'data': [{'SECRET': 'do not expose'}]}
        return api

    def test_departure_aggregate_preserves_evidence_and_incomplete_null_total(self):
        api = self.departure_api()
        result = self.run_workflow('departing_trucks', api, 'current_week')
        self.assertEqual(result['metrics']['departing_trucks'], 3)
        evidence = result['evidence']['departures']
        for key in ('period', 'complete', 'status', 'source_status', 'reconciliation', 'truck_sets'):
            self.assertEqual(evidence[key], api.envelopes['departures'][key])
        self.assertNotIn('SECRET', json.dumps(result))
        self.assertEqual(len(api.calls), 3)
        envelope = api.envelopes['departures']
        envelope['complete'], envelope['status'] = False, 'incomplete'
        envelope['reconciliation']['combined_distinct_total'] = None
        envelope['source_status']['schedule_teams']['status'] = 'failed'
        with self.assertRaises(self.w.WorkflowFallback) as ctx:
            self.run_workflow('departing_trucks', api, 'current_week')
        self.assertEqual(ctx.exception.reason, 'incomplete_source')
        self.assertIsNone(ctx.exception.evidence['departures']['reconciliation']['combined_distinct_total'])
        self.assertNotIn('data', ctx.exception.evidence['departures'])

    def test_departure_bad_counts_period_and_dependency_permission_refused(self):
        for key, value in [('status', 'incomplete'), ('period', {}), ('total_count', 2), ('has_more', True), ('truck_sets', {}), ('reconciliation', {})]:
            api = self.departure_api()
            api.envelopes['departures'][key] = value
            with self.subTest(key=key), self.assertRaises(self.w.WorkflowFallback):
                self.run_workflow('departing_trucks', api, 'current_week')
        api = self.departure_api()
        api.catalog['principal']['allowed_reports'].remove('out_schedule')
        with self.assertRaises(self.w.WorkflowFallback):
            self.run_workflow('departing_trucks', api, 'current_week')
        self.assertFalse(any(c[0] == 'collect' for c in api.calls))

    def test_runtime_failures_are_sanitized_fallback_and_decimal_context_is_fixed(self):
        from decimal import localcontext
        plan = self.w.build_plan('fleet_count', 'today', self.now)
        def denied(_):
            raise SystemExit('credential-must-never-leak')
        with self.assertRaises(self.w.WorkflowFallback) as ctx:
            self.w.execute_plan(plan, denied, MockAPI().collect)
        self.assertNotIn('credential', str(ctx.exception))
        api = MockAPI()
        def failed(*args):
            raise RuntimeError('private raw rows must never leak')
        with self.assertRaises(self.w.WorkflowFallback) as ctx:
            self.w.execute_plan(plan, api.request, failed)
        self.assertNotIn('private', str(ctx.exception))
        row = {'Product': 'Premium Diesel #2', 'Store Date': '2026-09-29', 'Gallons': '3', 'Adjusted SubTotal': '14'}
        api = MockAPI({'fuel': [row]})
        normal = self.run_workflow('diesel_totals', api, 'last_full_week')
        with localcontext() as decimal_context:
            decimal_context.prec = 4
            modified = self.run_workflow('diesel_totals', api, 'last_full_week')
        self.assertEqual(normal['metrics'], modified['metrics'])

    def test_metadata_schema_changed_or_source_denied_cannot_collect(self):
        api = MockAPI()
        api.metadata['trucks']['schema_version'] = '3.8.2'
        with self.assertRaises(self.w.WorkflowFallback) as ctx:
            self.run_workflow('fleet_count', api)
        self.assertEqual(ctx.exception.reason, 'unsupported_schema')
        self.assertFalse(any(c[0] == 'collect' for c in api.calls))
        api = MockAPI()
        api.catalog['principal'] = None
        with self.assertRaises(self.w.WorkflowFallback):
            self.run_workflow('fleet_count', api)
        self.assertEqual(len(api.calls), 1)

    def test_diesel_negated_and_exhaust_fluid_labels_are_not_diesel(self):
        for label in ['Diesel Exhaust Fluid', 'NOT Diesel', 'Non-Diesel', 'Diesel and gasoline']:
            row = {'Product': label, 'Store Date': '2026-09-29', 'Gallons': 1, 'Adjusted SubTotal': 1}
            with self.subTest(label=label), self.assertRaises(self.w.WorkflowFallback):
                self.run_workflow('diesel_totals', MockAPI({'fuel': [row]}), 'last_full_week')

    def test_executor_uses_real_complete_collection_helper_across_two_mock_pages(self):
        import argparse
        from unittest.mock import patch
        spec = importlib.util.spec_from_file_location('workflow_test_helper', ROOT / 'skills/itpros-supabase-reporting/scripts/agent_reporting.py')
        assert spec is not None and spec.loader is not None
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        api = MockAPI()
        def mock_request(params):
            if params.get('metadata') or params['report'] == 'catalog':
                return api.request(params)
            offset = params['offset']
            api.calls.append(('page', params.copy()))
            return {'schema_version': '3.8.1', 'report': 'trucks', 'source': 'mock.trucks', 'filters': {},
                    'offset': offset, 'page_count': 1, 'count': 1, 'total_count': 2,
                    'has_more': offset == 0, 'next_offset': 1 if offset == 0 else None,
                    'data': [{'ID': offset + 1, 'truck_number': offset + 1}],
                    'as_of': '2026-10-06T15:00:00Z', 'source_freshness': 'mock sync unknown'}
        def collect(report, params):
            return helper.collect_query(argparse.Namespace(report=report, params=json.dumps(params), one_page=False, max_pages=100))
        with patch.object(helper, 'request', mock_request):
            result = self.w.execute_plan(self.w.build_plan('fleet_count', 'today', self.now), mock_request, collect)
        self.assertEqual(result['metrics']['fleet_count'], 2)
        self.assertTrue(result['evidence']['trucks']['complete'])
        self.assertEqual(result['evidence']['trucks']['pages_fetched'], 2)
        self.assertEqual([c[1]['limit'] for c in api.calls if c[0] == 'page'], [1000, 1000])


if __name__ == '__main__':
    unittest.main()
