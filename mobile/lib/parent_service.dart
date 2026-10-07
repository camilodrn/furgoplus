import 'package:flutter/material.dart';

import 'parent_presentation.dart';

// Render only the public discovery allowlist; never inspect private profile data.
List<Map<String, dynamic>> publicRows(dynamic value) =>
    (value as List).cast<Map<String, dynamic>>();

const _days = {
  'monday': 'Lun',
  'tuesday': 'Mar',
  'wednesday': 'Mié',
  'thursday': 'Jue',
  'friday': 'Vie',
  'saturday': 'Sáb',
  'sunday': 'Dom',
};

String compactWeekdays(List days) {
  final ordered = _days.keys.where(days.contains).toList();
  if (days.any((day) => !_days.containsKey(day))) {
    return days.map((day) => _days[day] ?? 'día por confirmar').join(' · ');
  }
  if (ordered.length == 7) return 'Todos los días';
  final indices = ordered
      .map((day) => _days.keys.toList().indexOf(day))
      .toList();
  final contiguous =
      indices.length >= 3 && indices.last - indices.first == indices.length - 1;
  if (contiguous) return '${_days[ordered.first]}–${_days[ordered.last]}';
  return ordered.map((day) => _days[day]).join(' · ');
}

String parentDate(String iso) {
  final parts = iso.split('T').first.split('-');
  return parts.length == 3 ? '${parts[2]}-${parts[1]}-${parts[0]}' : iso;
}

String routeSchedule(Map<String, dynamic> route) =>
    '${compactWeekdays(route['weekdays'] as List)} · ${route['start_time']}–${route['end_time']}';

String coverageText(dynamic coverage) =>
    publicRows(coverage).map((item) => item['display_name']).join(', ');

// Summarize public coverage without truncating names or changing eligibility.
String coverageSummary(dynamic coverage, String? commune) {
  final rows = publicRows(coverage);
  if (rows.isEmpty) return 'Cobertura por confirmar';
  final primary =
      rows.where((row) => row['code'] == commune).firstOrNull ?? rows.first;
  final more = rows.length - 1;
  return '${primary['display_name']}${more > 0 ? ' · +$more ${more == 1 ? 'comuna' : 'comunas'}' : ''}';
}

// The filter remains server-owned. Only prioritize the matching route's public
// date/capacity within an already-authorized service; never infer service access.
List<Map<String, dynamic>> displayRoutes(
  Map<String, dynamic> driver,
  String? commune,
) {
  final routes = publicRows(driver['routes']);
  if (commune == null) return routes;
  bool matches(Map<String, dynamic> route) =>
      publicRows(route['coverage']).any((item) => item['code'] == commune);
  return [
    ...routes.where(matches),
    ...routes.where((route) => !matches(route)),
  ];
}

String reviewSummary(Map<String, dynamic> driver) => driver['review_count'] == 0
    ? 'Sin reseñas'
    : '${driver['review_average']} / 5 · ${driver['review_count']} reseñas';

class ParentStateLabel extends StatelessWidget {
  const ParentStateLabel(
    this.label, {
    super.key,
    this.icon = Icons.info_outline,
    this.color = parentBlue,
  });
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    label: label,
    excludeSemantics: true,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class ParentRouteSummary extends StatelessWidget {
  const ParentRouteSummary(this.route, {super.key, this.showCoverage = false});
  final Map<String, dynamic> route;
  final bool showCoverage;

  @override
  Widget build(BuildContext context) {
    final available = route['available_seats'] as int;
    final capacity = route['seat_capacity'] as int;
    final date = parentDate(route['next_service_date'] as String);
    final availability = '$available de $capacity disponibles';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          route['label'] as String,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
        ),
        ParentMetadata(Icons.schedule, routeSchedule(route)),
        if (showCoverage)
          ParentMetadata(
            Icons.location_on_outlined,
            coverageText(route['coverage']),
          ),
        const SizedBox(height: 6),
        Text(
          'Cupos para el $date',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        Semantics(
          container: true,
          label: 'Cupos disponibles, $availability',
          excludeSemantics: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                available == 0
                    ? 'Sin cupos disponibles · $availability'
                    : availability,
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: capacity > 0 ? (available / capacity).clamp(0, 1) : 0,
                color: available <= 0 ? parentAmber : parentGreen,
                backgroundColor: const Color(0xFFE4EBE7),
                minHeight: 6,
                borderRadius: BorderRadius.circular(4),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ParentServiceCard extends StatelessWidget {
  const ParentServiceCard({
    super.key,
    required this.driver,
    this.onOpen,
    this.onSelect,
    this.selected = false,
    this.onRemove,
    this.commune,
  });
  final Map<String, dynamic> driver;
  final VoidCallback? onOpen;
  final VoidCallback? onSelect;
  final VoidCallback? onRemove;
  final bool selected;
  final String? commune;

  @override
  Widget build(BuildContext context) {
    final routes = displayRoutes(driver, commune);
    return ParentPanel(
      key: ValueKey('driver-card-${driver['id']}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ParentServiceIdentity(driver: driver),
          const SizedBox(height: 8),
          ParentMetadata(
            Icons.location_on_outlined,
            coverageSummary(driver['coverage'], commune),
          ),
          if (routes.isNotEmpty) ParentRouteSummary(routes.first),
          ParentMetadata(
            Icons.star_outline,
            '${reviewSummary(driver)}${routes.length > 1 ? ' · +${routes.length - 1} rutas' : ''}',
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (onOpen != null)
                FilledButton(
                  onPressed: onOpen,
                  child: const Text('Ver servicio'),
                ),
              if (onSelect != null)
                ParentCompareAction(
                  key: ValueKey('compare-driver-${driver['id']}'),
                  selected: selected,
                  onPressed: onSelect,
                ),
              if (onRemove != null)
                TextButton.icon(
                  onPressed: onRemove,
                  icon: const Icon(Icons.remove_circle_outline),
                  label: const Text('Quitar de comparación'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class ParentServiceIdentity extends StatelessWidget {
  const ParentServiceIdentity({super.key, required this.driver});
  final Map<String, dynamic> driver;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const ParentIcon(Icons.directions_bus_outlined),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(
                driver['display_name'] as String,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 6),
            const ParentStateLabel(
              'Conductor validado',
              icon: Icons.verified_outlined,
              color: parentGreen,
            ),
          ],
        ),
      ),
    ],
  );
}
