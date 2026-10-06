"""Deterministic, read-only headline workflows; API access is injected by the caller.

No credentials, business-row caching, rendering, or direct database access lives here.
Decimal metric values are emitted as strings for lossless JSON serialization.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Context, Decimal, localcontext
from typing import Callable
from zoneinfo import ZoneInfo

NY = ZoneInfo('America/New_York')
SCHEMA_VERSION = '3.8.1'


class WorkflowFallback(Exception):
    """The curated workflow cannot safely answer; route to the governed general path."""

    def __init__(self, reason: str, evidence: dict | None = None):
        self.reason = self.reason_code = reason
        self.evidence = evidence or {}
        super().__init__(reason)


def build_plan(workflow: str, time_window: str, now: datetime | None = None) -> dict:
    windows = {'fleet_count': ('today', 'unspecified'), 'on_road_count': ('today',),
               'diesel_totals': ('last_full_week',), 'outside_repair_totals': ('last_full_week',),
               'returning_trucks': ('current_week', 'last_full_week'),
               'departing_trucks': ('current_week', 'last_full_week')}
    if workflow not in windows:
        raise WorkflowFallback('unsupported_workflow')
    if time_window not in windows[workflow]:
        raise WorkflowFallback('unsupported_time_window')
    now = now or datetime.now(NY)
    if now.tzinfo is None or now.utcoffset() is None:
        raise WorkflowFallback('naive_datetime')
    day = now.astimezone(NY).date()
    partial = time_window == 'current_week'
    if workflow in ('fleet_count', 'on_road_count'):
        start = end = day
    else:
        weekday = 0 if workflow == 'departing_trucks' else 1
        start = day - timedelta(days=(day.weekday() - weekday) % 7)
        if not partial:
            start -= timedelta(days=7)
        end = start + timedelta(days=6)
    period = {'from': start.isoformat(), 'to': end.isoformat(),
              'time_zone': 'America/New_York', 'partial': partial,
              'window': time_window}
    if workflow == 'fleet_count':
        queries = [{'report': 'trucks', 'params': {}}]
    elif workflow == 'on_road_count':
        queries = [{'report': 'driver_pay', 'params': {'on_road_at': period['from']}}]
    elif workflow == 'outside_repair_totals':
        queries = [{'report': 'outside_repairs', 'params': {'date_from': period['from'], 'date_to': period['to']}}]
    elif workflow == 'departing_trucks':
        queries = [{'report': 'departures', 'params': {'out_from': period['from'], 'out_to': period['to']}}]
    elif workflow == 'diesel_totals':
        queries = [{'report': 'fuel', 'params': {'store_from': period['from'], 'store_to': period['to']}}]
    else:
        queries = [{'report': report, 'params': {'return_from': period['from'], 'return_to': period['to']}}
                   for report in ('driver_pay', 'returns')]
    return {'workflow': workflow, 'period': period, 'queries': queries}


def _schema(payload):
    if not isinstance(payload, dict) or payload.get('schema_version') != SCHEMA_VERSION:
        raise WorkflowFallback('unsupported_schema')


def _evidence(payload):
    keys = ('schema_version', 'report', 'source', 'filters', 'complete', 'fetched_count',
            'total_count', 'pages_fetched', 'as_of', 'as_of_first_page', 'as_of_last_page',
            'source_freshness', 'status', 'period', 'source_status', 'reconciliation', 'truck_sets')
    return {key: payload[key] for key in keys if key in payload}


def _number(value):
    from decimal import Decimal, InvalidOperation
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise WorkflowFallback('invalid_numeric')
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        raise WorkflowFallback('invalid_numeric') from None
    if not number.is_finite():
        raise WorkflowFallback('invalid_numeric')
    return number


def _truck(value):
    if value is None or value == '':
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        # Preserve nonnumeric text business keys (case and punctuation unchanged).
        import re
        if not re.fullmatch(r'[+-]?\d+(?:\.\d+)?', value):
            return value
    number = _number(value)
    return format(number, 'f').rstrip('0').rstrip('.') if '.' in format(number, 'f') else format(number, 'f')


def _date(value, nullable=False):
    import re
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise WorkflowFallback('invalid_date')
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise WorkflowFallback('invalid_date') from None


def _onroad(rows, period):
    day = _date(period['from'])
    trucks, nulls = set(), 0
    for row in rows:
        out = _date(row['Out Date'], nullable=True)
        ret = _date(row['Return Date'], nullable=True)
        truck = _truck(row['Truck_Number'])
        nulls += ret is None
        if out is not None and ret is not None and out <= day < ret and truck is not None:
            trucks.add(truck)
    return {'on_road_count': len(trucks), 'excluded_null_return_rows': nulls}


def _in_window(value, period):
    day = _date(value)
    start, end = _date(period['from']), _date(period['to'])
    assert day is not None and start is not None and end is not None
    if not start <= day <= end:
        raise WorkflowFallback('date_outside_window')


def _repairs(rows, period):
    costs = []
    for row in rows:
        _in_window(row['Date'], period)
        if row['Total Cost'] is not None:
            costs.append(_number(row['Total Cost']))
    return {'total_cost': str(sum(costs, Decimal(0))) if costs or not rows else None,
            'repair_count': len(rows), 'populated_cost_rows': len(costs),
            'null_cost_rows': len(rows) - len(costs), 'cost_complete': len(costs) == len(rows)}


def _fuel_totals(rows):
    gallons, spend, eligible_gallons, eligible_spend, excluded_gallons = [], [], [], [], []
    null_gallons = null_spend = 0
    for row in rows:
        gallon = None if row['Gallons'] is None else _number(row['Gallons'])
        adjusted = None if row['Adjusted SubTotal'] is None else _number(row['Adjusted SubTotal'])
        null_gallons += gallon is None
        null_spend += adjusted is None
        if gallon is not None:
            gallons.append(gallon)
        if adjusted is not None:
            spend.append(adjusted)
        if gallon is not None and adjusted is not None:
            eligible_gallons.append(gallon)
            eligible_spend.append(adjusted)
        if gallon is not None and adjusted is None:
            excluded_gallons.append(gallon)
    eg, es = sum(eligible_gallons, Decimal(0)), sum(eligible_spend, Decimal(0))
    return {'transaction_count': len(rows),
            'gallons': str(sum(gallons, Decimal(0))) if gallons or not rows else None,
            'adjusted_spend': str(sum(spend, Decimal(0))) if spend or not rows else None,
            'eligible_gallons': str(eg), 'eligible_adjusted_spend': str(es),
            'weighted_price_per_gallon': str(es / eg) if eg > 0 else None,
            'null_gallon_rows': null_gallons, 'null_adjustment_rows': null_spend,
            'excluded_null_adjustment_gallons': str(sum(excluded_gallons, Decimal(0))),
            'gallons_complete': null_gallons == 0, 'spend_complete': null_spend == 0}


def _diesel(rows, period, metadata):
    # Exact identities verified through the approved, fully paginated fuel source
    # for 2026-09-29..2026-10-05. Review/verify future SKUs before adding them;
    # metadata membership or substring similarity cannot establish an identity.
    identities = {'Premium Diesel #2': 'diesel', 'DEF (bulk)': 'def'}
    enum = metadata['fields']['Product'].get('enum')
    if enum is not None and (not isinstance(enum, list) or any(not isinstance(x, str) for x in enum)):
        raise WorkflowFallback('metadata_mismatch')
    labels = {'basis': 'verified_exact_identity_policy', 'diesel': [], 'def': [], 'unrecognized': []}
    groups = {'diesel': [], 'def': []}
    for row in rows:
        _in_window(row['Store Date'], period)
        label = row['Product']
        if not isinstance(label, str) or label not in identities:
            # Do not echo malformed objects or return an understated mixed total.
            if label is None or isinstance(label, str):
                labels['unrecognized'].append(label)
            raise WorkflowFallback('unrecognized_product', {'product_labels': labels})
        if enum is not None and label not in enum:
            raise WorkflowFallback('product_metadata_contradiction')
        for field in ('Gallons', 'Adjusted SubTotal'):
            if row[field] is not None:
                _number(row[field])
        category = identities[label]
        if label not in labels[category]:
            labels[category].append(label)
        groups[category].append(row)
    for category in ('diesel', 'def', 'unrecognized'):
        labels[category].sort(key=lambda x: '' if x is None else str(x))
    if not groups['diesel']:
        raise WorkflowFallback('unidentified_diesel_product', {'product_labels': labels})
    metrics = {'diesel': _fuel_totals(groups['diesel']), 'unrecognized_product_rows': 0}
    if groups['def']:
        metrics['def'] = _fuel_totals(groups['def'])
    return metrics, labels


def _returns(driver_pay, returns, period):
    dp, rs = set(), set()
    tc = ts = excluded = 0
    for row in driver_pay:
        _in_window(row['Return Date'], period)
        solo = None if row['Solo_Driver_if_1'] is None else _number(row['Solo_Driver_if_1'])
        truck = _truck(row['Truck_Number'])
        if row['Termination'] == 'Driver Changed' or row['Transfer'] == 'Transfer To Other Truck':
            excluded += 1
            continue
        if solo == 1:
            ts += 1
        else:
            tc += 1
        if truck is not None:
            dp.add(truck)
    for row in returns:
        _in_window(row['Return Date'], period)
        truck = None if row['Truck'] is None else _truck(_number(row['Truck']))
        if truck is not None:
            rs.add(truck)
    overlap, dp_only, rs_only, combined = dp & rs, dp - rs, rs - dp, dp | rs
    formula = tc // 2 + ts
    metrics = {'returning_trucks': len(combined), 'driver_pay_count': len(dp), 'returns_count': len(rs),
               'overlap_count': len(overlap), 'driver_pay_only_count': len(dp_only), 'returns_only_count': len(rs_only),
               'tc': tc, 'ts': ts, 'formula_count': formula, 'formula_agrees': formula == len(dp),
               'excluded_driver_pay_rows': excluded}
    sets = {name: sorted(keys) for name, keys in [('driver_pay', dp), ('returns', rs), ('overlap', overlap),
                                                 ('driver_pay_only', dp_only), ('returns_only', rs_only), ('combined', combined)]}
    return metrics, sets


def _departures(payload, query, metadata):
    _schema(payload)
    safe = {'departures': _evidence(payload)}
    if payload.get('report') != 'departures' or payload.get('source') != metadata['source']:
        raise WorkflowFallback('invalid_source', safe)
    if payload.get('filters') != query['params']:
        raise WorkflowFallback('filter_mismatch', safe)
    period = {**query['params'], 'time_zone': 'America/New_York'}
    if payload.get('period') != period:
        raise WorkflowFallback('date_outside_window', safe)
    try:
        stamp = datetime.fromisoformat(payload['as_of'].replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            raise ValueError
    except (KeyError, ValueError, TypeError, AttributeError):
        raise WorkflowFallback('invalid_as_of', safe) from None
    reconciliation = payload.get('reconciliation')
    if not isinstance(reconciliation, dict):
        raise WorkflowFallback('invalid_aggregate', safe)
    if payload.get('complete') is False:
        if payload.get('status') != 'incomplete' or reconciliation.get('combined_distinct_total') is not None:
            raise WorkflowFallback('invalid_aggregate', safe)
        raise WorkflowFallback('incomplete_source', safe)
    if payload.get('complete') is not True or payload.get('status') != 'complete':
        raise WorkflowFallback('invalid_aggregate', safe)
    if any(type(payload.get(k)) is not int or payload[k] != 1 for k in ('total_count', 'page_count', 'count')):
        raise WorkflowFallback('count_mismatch', safe)
    if payload.get('has_more') is not False or payload.get('next_offset') is not None:
        raise WorkflowFallback('incomplete_source', safe)
    sets = payload.get('truck_sets')
    if not isinstance(sets, dict):
        raise WorkflowFallback('invalid_aggregate', safe)
    normalized = {}
    for name in ('driver_pay', 'schedule_teams', 'driver_pay_only', 'schedule_teams_only', 'overlap', 'combined'):
        keys = sets.get(name)
        if not isinstance(keys, list) or any(not isinstance(k, (str, int, float)) or isinstance(k, bool) for k in keys):
            raise WorkflowFallback('invalid_aggregate', safe)
        normalized[name] = {_truck(k) for k in keys}
        if None in normalized[name] or len(normalized[name]) != len(keys):
            raise WorkflowFallback('invalid_aggregate', safe)
        count_key = 'combined_distinct_total' if name == 'combined' else name + '_count'
        count = reconciliation.get(count_key)
        if type(count) is not int or count != len(keys):
            raise WorkflowFallback('count_mismatch', safe)
    dp, schedule = normalized['driver_pay'], normalized['schedule_teams']
    if (normalized['combined'] != dp | schedule or normalized['overlap'] != dp & schedule
            or normalized['driver_pay_only'] != dp - schedule or normalized['schedule_teams_only'] != schedule - dp):
        raise WorkflowFallback('invalid_aggregate', safe)
    statuses = payload.get('source_status')
    if not isinstance(statuses, dict) or any(not isinstance(statuses.get(s), dict) or statuses[s].get('status') != 'complete' for s in ('driver_pay', 'schedule_teams')):
        raise WorkflowFallback('incomplete_source', safe)
    return {'departing_trucks': reconciliation['combined_distinct_total'], **reconciliation}


def _required(workflow, report):
    return {'fleet_count': {'trucks': ('truck_number',)},
            'on_road_count': {'driver_pay': ('Truck_Number', 'Out Date', 'Return Date')},
            'diesel_totals': {'fuel': ('Product', 'Store Date', 'Gallons', 'Adjusted SubTotal')},
            'outside_repair_totals': {'outside_repairs': ('Date', 'Total Cost')},
            'returning_trucks': {'driver_pay': ('Truck_Number', 'Return Date', 'Termination', 'Transfer', 'Solo_Driver_if_1'),
                                 'returns': ('Truck', 'Return Date')},
            'departing_trucks': {'departures': ('combined_distinct_total',)}}[workflow][report]


def _validate_plan(plan):
    try:
        period = plan['period']
        anchor = date.fromisoformat(period['from'])
        if period['window'] == 'last_full_week':
            anchor += timedelta(days=7)
        canonical = build_plan(plan['workflow'], period['window'], datetime.combine(anchor, datetime.min.time(), NY))
        if plan != canonical:
            raise WorkflowFallback('invalid_plan')
    except (KeyError, TypeError, ValueError):
        raise WorkflowFallback('invalid_plan') from None


def _validate_payload(payload, query, metadata, fields):
    _schema(payload)
    if payload.get('report') != query['report'] or not payload.get('source') or payload['source'] != metadata.get('source'):
        raise WorkflowFallback('invalid_source')
    filters = payload.get('filters')
    if not isinstance(filters, dict) or {k: v for k, v in filters.items() if v is not None} != query['params']:
        raise WorkflowFallback('filter_mismatch')
    for key in ('as_of_first_page', 'as_of_last_page'):
        try:
            timestamp = datetime.fromisoformat(payload[key].replace('Z', '+00:00'))
            if timestamp.tzinfo is None:
                raise ValueError
        except (KeyError, TypeError, ValueError, AttributeError):
            raise WorkflowFallback('invalid_as_of') from None
    rows = payload.get('data')
    if not isinstance(rows, list):
        raise WorkflowFallback('invalid_rows')
    if payload.get('complete') is not True:
        raise WorkflowFallback('incomplete_source', _evidence(payload))
    for key in ('fetched_count', 'total_count'):
        if type(payload.get(key)) is not int or payload[key] != len(rows):
            raise WorkflowFallback('count_mismatch', _evidence(payload))
    for row in rows:
        if not isinstance(row, dict) or any(field not in row for field in fields):
            raise WorkflowFallback('missing_field')
    return rows


def _execute_plan(plan: dict, request: Callable, collect: Callable) -> dict:
    """Discover permissions/metadata, collect fresh complete sources, then aggregate.

    request(params) is agent_reporting.request; collect(report, params) adapts
    agent_reporting.collect_query. WorkflowFallback carries a sanitized reason and
    any safe evidence, never a successful answer or raw source rows.
    """
    _validate_plan(plan)
    catalog = request({'report': 'catalog', 'compact': True})
    _schema(catalog)
    reports = [query['report'] for query in plan['queries']]
    allowed = catalog.get('principal', {}).get('allowed_reports', [])
    if any(report not in allowed or report not in catalog.get('reports', {}) for report in reports):
        raise WorkflowFallback('permission_denied')
    metadatas = {}
    for query in plan['queries']:
        report = query['report']
        metadata = request({'report': report, 'metadata': 'true'})
        _schema(metadata)
        fields = metadata.get('fields')
        filters = metadata.get('filters')
        if report == 'departures':
            if (metadata.get('report') != report or not metadata.get('source') or not isinstance(filters, dict)
                    or any(f not in filters for f in query['params'])
                    or any(f not in metadata.get('returned_fields', []) for f in ('status', 'complete', 'period', 'reconciliation', 'truck_sets', 'source_status'))
                    or 'combined_distinct_total' not in metadata.get('reconciliation_fields', [])):
                raise WorkflowFallback('metadata_mismatch')
            dependencies = metadata.get('required_reports')
            if dependencies != ['departures', 'driver_pay', 'out_schedule']:
                raise WorkflowFallback('metadata_mismatch')
            if any(r not in allowed or r not in catalog['reports'] for r in dependencies):
                raise WorkflowFallback('permission_denied')
        elif (metadata.get('report') != report or not metadata.get('source')
                or not isinstance(fields, dict) or not isinstance(filters, dict)
                or any(f not in fields for f in _required(plan['workflow'], report))
                or any(f not in filters for f in query['params'])):
            raise WorkflowFallback('metadata_mismatch')
        metadatas[report] = metadata
    evidence, data = {}, {}
    for query in plan['queries']:
        report = query['report']
        payload = collect(report, {**query['params'], **({'limit': 1000} if report != 'departures' else {}), 'include_sensitive': False})
        if report == 'departures':
            data[report] = _departures(payload, query, metadatas[report])
        else:
            data[report] = _validate_payload(payload, query, metadatas[report], _required(plan['workflow'], report))
        evidence[report] = _evidence(payload)
    caveats = ['as_of is request time, not source-sync time.']
    if plan['period']['partial']:
        caveats.append('Current week is partial; planned operational rows may change.')
    if plan['workflow'] == 'fleet_count':
        metrics = {'fleet_count': len({_truck(_number(row['truck_number'])) for row in data['trucks']})}
    elif plan['workflow'] == 'outside_repair_totals':
        metrics = _repairs(data['outside_repairs'], plan['period'])
        if not metrics['cost_complete']:
            caveats.append('Cost is partial: null Total Cost amounts are unknown, not zero.')
        caveats.append('Total Cost counted once, including truckless rows; parts and labor already included.')
    elif plan['workflow'] == 'diesel_totals':
        metrics, evidence['product_labels'] = _diesel(data['fuel'], plan['period'], metadatas['fuel'])
        caveats.append('Diesel and DEF are separate under the verified exact identity policy; unknown products require fallback.')
        if metadatas['fuel']['fields']['Product'].get('enum') is None:
            caveats.append('Policy labels were confirmed in the approved source; metadata does not enumerate them.')
        if not metrics['diesel']['spend_complete'] or not metrics['diesel']['gallons_complete']:
            caveats.append('Diesel result is partial: null gallons/adjustments are unknown, never replaced with SubTotal.')
    elif plan['workflow'] == 'returning_trucks':
        metrics, evidence['truck_sets'] = _returns(data['driver_pay'], data['returns'], plan['period'])
        caveats.append('Returns is volatile and may not retain historical rows; both sources use the same Return Date period.')
        if not metrics['formula_agrees']:
            caveats.append('DriverPay formula and distinct qualifying truck counts disagree; union uses distinct trucks.')
    elif plan['workflow'] == 'departing_trucks':
        metrics = data['departures']
        caveats.append('Schedule_Teams fetched live by the gateway; planned rows are volatile, DriverPay sync time unknown.')
    else:
        metrics = _onroad(data['driver_pay'], plan['period'])
    return {'workflow': plan['workflow'], 'period': plan['period'], 'metrics': metrics,
            'evidence': evidence, 'caveats': caveats}


def execute_plan(plan: dict, request: Callable, collect: Callable) -> dict:
    """Execute with fixed Decimal semantics and sanitized runtime failures.

    request(params: dict) -> API envelope; collect(report: str, params: dict)
    -> existing helper's fully collected envelope. No network transport is owned
    by this module. Returns {workflow, period, metrics, evidence, caveats}.
    Raises WorkflowFallback(reason_code, evidence) rather than inventing totals.
    """
    try:
        with localcontext(Context(prec=28)):
            return _execute_plan(plan, request, collect)
    except WorkflowFallback:
        raise
    except (Exception, SystemExit):
        # Existing helper errors can contain server details; never echo them.
        raise WorkflowFallback('api_or_contract_failure') from None
