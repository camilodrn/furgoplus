import 'package:flutter/material.dart';

import 'parent_presentation.dart';
import 'furgo_widgets.dart';
import 'furgo_theme.dart';

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
        borderRadius: BorderRadius.circular(99),
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
        if (available == 0)
          const ExcludeSemantics(child: Text('Sin cupos disponibles')),
        FurgoCapacity(
          used: route['used_seats'] as int,
          total: capacity,
          available: available,
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
      soft: selected,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ParentServiceIdentity(driver: driver, compact: true),
          const SizedBox(height: 8),
          ParentMetadata(
            Icons.location_on_outlined,
            coverageSummary(driver['coverage'], commune),
          ),
          const SizedBox(height: 8),
          if (routes.isNotEmpty) ParentRouteSummary(routes.first),
          ParentMetadata(
            Icons.star_outline,
            '${reviewSummary(driver)}${routes.length > 1 ? ' · +${routes.length - 1} rutas' : ''}',
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (onOpen != null)
                OutlinedButton(
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
  const ParentServiceIdentity({
    super.key,
    required this.driver,
    this.compact = false,
  });
  final Map<String, dynamic> driver;
  final bool compact;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final identity = Column(
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
            icon: Icons.fact_check_outlined,
            color: FurgoColors.neutral,
          ),
          if (!compact) const SizedBox(height: 4),
          if (!compact)
            Text(
              'Revisión interna; no es una certificación de seguridad.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
        ],
      );
      // Decorative identity icon yields space to names and states at large text.
      if (compact ||
          constraints.maxWidth / MediaQuery.textScalerOf(context).scale(1) <
              240)
        return identity;
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ParentIcon(Icons.directions_bus_outlined),
          const SizedBox(width: 12),
          Expanded(child: identity),
        ],
      );
    },
  );
}

/// Public discovery attributes stay grouped so families compare the same facts.
/// No fees, reservations or private data are derived here.
class ParentServiceComparison extends StatelessWidget {
  const ParentServiceComparison({
    super.key,
    required this.drivers,
    this.commune,
    this.onOpen,
    this.onRemove,
  });
  final List<Map<String, dynamic>> drivers;
  final String? commune;
  final ValueChanged<int>? onOpen, onRemove;

  @override
  Widget build(BuildContext context) {
    final routes = drivers
        .map((driver) => displayRoutes(driver, commune).firstOrNull)
        .toList();
    // The same selected public route supplies schedule, coverage, date and seats.
    Widget attribute(
      String id,
      String title,
      Widget Function(int) value,
    ) => Padding(
      key: ValueKey('comparison-$id'),
      padding: const EdgeInsets.symmetric(vertical: FurgoLayout.space4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(title, style: Theme.of(context).textTheme.titleMedium),
          ),
          const SizedBox(height: FurgoLayout.space2),
          for (var index = 0; index < drivers.length; index++)
            Padding(
              key: id == 'schedule'
                  ? ValueKey('driver-card-${drivers[index]['id']}')
                  : null,
              padding: const EdgeInsets.symmetric(vertical: FurgoLayout.space2),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final name = Text(
                    drivers[index]['display_name'] as String,
                    style: Theme.of(context).textTheme.titleSmall,
                  );
                  final information = Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      value(index),
                      if (id == 'schedule')
                        Wrap(
                          spacing: FurgoLayout.space2,
                          children: [
                            OutlinedButton(
                              onPressed: onOpen == null
                                  ? null
                                  : () => onOpen!(drivers[index]['id'] as int),
                              child: const Text('Ver servicio'),
                            ),
                            TextButton.icon(
                              onPressed: onRemove == null
                                  ? null
                                  : () =>
                                        onRemove!(drivers[index]['id'] as int),
                              icon: const Icon(Icons.remove_circle_outline),
                              label: Text(
                                'Quitar',
                                semanticsLabel:
                                    'Quitar ${drivers[index]['display_name']} de comparación',
                              ),
                            ),
                          ],
                        ),
                    ],
                  );
                  if (constraints.maxWidth /
                          MediaQuery.textScalerOf(context).scale(1) <
                      300) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        name,
                        const SizedBox(height: FurgoLayout.space2),
                        information,
                      ],
                    );
                  }
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(flex: 2, child: name),
                      const SizedBox(width: FurgoLayout.space4),
                      Expanded(flex: 3, child: information),
                    ],
                  );
                },
              ),
            ),
        ],
      ),
    );
    String routeValue(int index, String Function(Map<String, dynamic>) read) =>
        routes[index] == null
        ? 'Información por confirmar'
        : read(routes[index]!);
    return FurgoSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          attribute(
            'schedule',
            'Días y horario',
            (i) => Text(routeValue(i, routeSchedule)),
          ),
          const Divider(height: 1),
          attribute(
            'route',
            'Ruta comparada',
            (i) => Text(routeValue(i, (route) => route['label'] as String)),
          ),
          const Divider(height: 1),
          attribute(
            'coverage',
            'Cobertura de la ruta',
            (i) =>
                Text(routeValue(i, (route) => coverageText(route['coverage']))),
          ),
          const Divider(height: 1),
          attribute(
            'capacity',
            'Fecha y cupos',
            (i) => routes[i] == null
                ? const Text('Información por confirmar')
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Para el ${parentDate(routes[i]!['next_service_date'] as String)}',
                      ),
                      const SizedBox(height: FurgoLayout.space2),
                      FurgoCapacity(
                        used: routes[i]!['used_seats'] as int,
                        total: routes[i]!['seat_capacity'] as int,
                        available: routes[i]!['available_seats'] as int,
                      ),
                    ],
                  ),
          ),
          const Divider(height: 1),
          attribute(
            'reviews',
            'Reseñas',
            (i) => Text(reviewSummary(drivers[i])),
          ),
          const Divider(),
          const Divider(),
          const Text(
            'Los datos de cada servicio corresponden a la ruta indicada. Las fechas y los cupos pueden ser distintos entre servicios.',
          ),
          const Divider(height: 1),
          const SizedBox(height: FurgoLayout.space4),
          const Text(
            'Conductores validados: revisión interna de información y documentos. No es una certificación estatal ni una garantía de seguridad.',
          ),
          const SizedBox(height: FurgoLayout.space2),
          const Text('Solicitar contacto no reserva un cupo.'),
        ],
      ),
    );
  }
}
