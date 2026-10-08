import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'auth_controller.dart';
import 'session_api.dart';

abstract interface class DestinationLauncher {
  Future<bool> open(String address);
}

Uri destinationUri(String address) => Uri.https(
  'www.google.com',
  '/maps/dir/',
  {'api': '1', 'destination': address},
);

class ExternalDestinationLauncher implements DestinationLauncher {
  @override
  Future<bool> open(String address) async {
    return launchUrl(
      destinationUri(address),
      mode: LaunchMode.externalApplication,
    );
  }
}

class DriverHome extends StatefulWidget {
  const DriverHome({super.key, required this.auth, this.launcher});
  final AuthController auth;
  final DestinationLauncher? launcher;

  @override
  State<DriverHome> createState() => _DriverHomeState();
}

class _DriverHomeState extends State<DriverHome> {
  Map<String, dynamic>? today;
  bool loading = false;
  bool needsReload = false;
  String? error;
  String? mapError;
  int? selectedRoute;
  late int sessionVersion;
  int operation = 0;
  final scroll = ScrollController();
  DialogRoute<bool>? confirmation;
  NavigatorState? confirmationNavigator;

  NativeSessionApi get api => widget.auth.api;
  DestinationLauncher get launcher =>
      widget.launcher ?? ExternalDestinationLauncher();
  bool get active =>
      mounted &&
      sessionVersion == widget.auth.sessionVersion &&
      widget.auth.state == AuthState.driver;
  bool current(int ticket) => active && ticket == operation;

  @override
  void initState() {
    super.initState();
    sessionVersion = widget.auth.sessionVersion;
    widget.auth.addListener(_sessionChanged);
    _refresh();
  }

  @override
  void didUpdateWidget(DriverHome oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.auth != widget.auth) {
      oldWidget.auth.removeListener(_sessionChanged);
      widget.auth.addListener(_sessionChanged);
      _clearPrivate();
      sessionVersion = widget.auth.sessionVersion;
      if (active) _refresh();
    }
  }

  void _sessionChanged() {
    if (sessionVersion == widget.auth.sessionVersion &&
        widget.auth.state == AuthState.driver) {
      return;
    }
    setState(_clearPrivate);
    sessionVersion = widget.auth.sessionVersion;
    if (active) _refresh();
  }

  void _clearPrivate() {
    operation++;
    today = null;
    error = mapError = null;
    selectedRoute = null;
    loading = needsReload = false;
    _closeConfirmation();
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  void _closeConfirmation() {
    final route = confirmation;
    final navigator = confirmationNavigator;
    confirmation = null;
    confirmationNavigator = null;
    if (route != null && route.isActive && navigator != null) {
      navigator.removeRoute(route);
    }
  }

  @override
  void dispose() {
    widget.auth.removeListener(_sessionChanged);
    operation++;
    scroll.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    if (!active || loading || confirmation != null) return;
    final ticket = ++operation;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final body = await api.get('driver/today/');
      if (!current(ticket)) return;
      setState(() {
        today = body;
        needsReload = false;
      });
    } on AuthFailure catch (failure) {
      if (!current(ticket)) return;
      if (failure.code == 'not_authenticated') {
        widget.auth.expire();
        return;
      }
      setState(() => error = 'No pudimos actualizar tu día. Intenta de nuevo.');
    } catch (_) {
      if (current(ticket)) {
        setState(() => error = 'Revisa tu conexión y vuelve a intentarlo.');
      }
    } finally {
      if (current(ticket)) setState(() => loading = false);
    }
  }

  Future<void> _transition(String path, {required bool ending}) async {
    if (!active || loading || needsReload) return;
    final ticket = ++operation;
    var confirmed = false;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final run = await api.write(path, {});
      if (!current(ticket)) return;
      // The mutation response is authoritative even if the following read fails.
      setState(() {
        final routes = _rows('routes');
        today = {
          ...today!,
          'routes': [
            for (final route in routes)
              if (route['route_id'] == run['route_id'])
                {...route, 'run': run}
              else
                route,
          ],
          'unfinished_runs': [
            for (final previous in _rows('unfinished_runs'))
              if (previous['id'] != run['id'] || run['state'] != 'completed')
                previous,
          ],
        };
      });
      confirmed = true;
      final body = await api.get('driver/today/');
      if (!current(ticket)) return;
      setState(() => today = body);
    } on AuthFailure catch (failure) {
      if (!current(ticket)) return;
      if (failure.code == 'not_authenticated') {
        widget.auth.expire();
        return;
      }
      _transitionFailure(confirmed, ending);
    } catch (_) {
      if (current(ticket)) _transitionFailure(confirmed, ending);
    } finally {
      if (current(ticket)) setState(() => loading = false);
    }
  }

  void _transitionFailure(bool confirmed, bool ending) {
    setState(() {
      needsReload = true;
      error = confirmed
          ? 'El cambio se confirmó. Actualiza para consultar el resto de tu día.'
          : 'No pudimos confirmar ${ending ? 'el cierre' : 'el inicio'}. Actualiza el estado antes de volver a actuar.';
    });
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  Future<void> _confirmEnd(Map<String, dynamic> run, String label) async {
    if (!active || loading || needsReload || confirmation != null) return;
    final ticket = operation;
    final navigator = Navigator.of(context);
    final route = DialogRoute<bool>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('¿Finalizar servicio?'),
        content: Text(
          '$label quedará completada. Confirma cuando hayas terminado el recorrido.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Seguir en curso'),
          ),
          FilledButton(
            key: const Key('confirm-end'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Finalizar servicio'),
          ),
        ],
      ),
    );
    confirmation = route;
    confirmationNavigator = navigator;
    final accepted = await navigator.push(route);
    if (confirmation == route) {
      confirmation = null;
      confirmationNavigator = null;
    }
    if (accepted == true && current(ticket)) {
      await _transition('driver/runs/${run['id']}/end/', ending: true);
    }
  }

  Future<void> _openMaps(String address) async {
    if (!active || address.trim().isEmpty) return;
    final ticket = operation;
    try {
      if (!await launcher.open(address)) {
        throw StateError('No external maps provider');
      }
      if (current(ticket)) {
        setState(() => mapError = null);
      }
    } catch (_) {
      if (current(ticket)) {
        setState(() => mapError = 'No se pudo abrir mapas. Intenta de nuevo.');
      }
    }
  }

  List<Map<String, dynamic>> _rows(String key) =>
      (today?[key] as List? ?? []).cast<Map<String, dynamic>>();

  String _date(String iso, {bool natural = false}) {
    if (natural) {
      // service_date is already Chile-local; UTC keeps calendar arithmetic
      // independent of the device timezone without converting that date.
      final date = DateTime.tryParse('${iso}T00:00:00Z');
      if (date == null) return iso;
      const weekdays = [
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
        'Domingo',
      ];
      const months = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      return '${weekdays[date.weekday - 1]}, ${date.day} de ${months[date.month - 1]}';
    }
    final parts = iso.split('-');
    return parts.length == 3 ? '${parts[2]}-${parts[1]}-${parts[0]}' : iso;
  }

  String _runState(Map<String, dynamic> route) =>
      (route['run'] as Map<String, dynamic>?)?['state'] as String? ?? 'planned';

  String _state(String state) => switch (state) {
    'planned' => 'Planificada',
    'in_progress' => 'En curso',
    'completed' => 'Completada',
    _ => 'Estado por confirmar',
  };

  Map<String, dynamic>? _focus(List<Map<String, dynamic>> routes) {
    for (final route in routes) {
      if (route['route_id'] == selectedRoute) return route;
    }
    for (final state in ['in_progress', 'planned', 'completed']) {
      for (final route in routes) {
        if (_runState(route) == state) return route;
      }
    }
    return routes.firstOrNull;
  }

  Widget _heading(String text) => Semantics(
    header: true,
    child: Text(
      text,
      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
    ),
  );

  Widget _surface({required Widget child}) => Padding(
    padding: const EdgeInsets.only(top: 16),
    child: Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    ),
  );

  Widget _hero(Map<String, dynamic> route) {
    final state = _runState(route);
    final run = route['run'] as Map<String, dynamic>?;
    final enabled = !loading && !needsReload;
    final icon = switch (state) {
      'in_progress' => Icons.directions_bus_outlined,
      'completed' => Icons.check_circle_outline,
      _ => Icons.schedule,
    };
    return Container(
      key: ValueKey('today-route-${route['route_id']}'),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            liveRegion: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: Colors.white, size: 26),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _state(state),
                    key: const Key('daily-state'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            route['label'] as String,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            '${route['start_time']}–${route['end_time']}',
            style: const TextStyle(color: Colors.white, fontSize: 16),
          ),
          const SizedBox(height: 16),
          if (state == 'planned' || state == 'in_progress')
            FilledButton(
              key: ValueKey(
                state == 'planned'
                    ? 'start-${route['route_id']}'
                    : 'end-${run!['id']}',
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: Colors.white,
                foregroundColor: Theme.of(context).colorScheme.primary,
                disabledBackgroundColor: const Color(0xFFDFE9F7),
                disabledForegroundColor: const Color(0xFF526176),
              ),
              onPressed: enabled
                  ? () => state == 'planned'
                        ? _transition(
                            'driver/routes/${route['route_id']}/start/',
                            ending: false,
                          )
                        : _confirmEnd(run!, route['label'] as String)
                  : null,
              child: Text(
                loading
                    ? 'Consultando estado…'
                    : needsReload
                    ? 'Actualiza el estado'
                    : state == 'planned'
                    ? 'Iniciar servicio'
                    : 'Finalizar servicio',
              ),
            )
          else
            Text(
              state == 'completed'
                  ? 'Servicio finalizado por hoy.'
                  : 'Actualiza para consultar el estado.',
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
        ],
      ),
    );
  }

  Widget _destination(Map<String, dynamic> route) {
    final address = route['destination_address'] as String;
    return _surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.place_outlined,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Destino',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    Text(
                      route['destination_label'] as String,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (address.trim().isNotEmpty)
                      Text(
                        address,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (address.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              key: ValueKey('maps-${route['route_id']}'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
              onPressed: () => _openMaps(address),
              icon: const Icon(Icons.near_me_outlined, size: 20),
              label: const Text('Abrir en mapas'),
            ),
          ],
          if (mapError != null)
            Semantics(
              liveRegion: true,
              child: Text(
                mapError!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
        ],
      ),
    );
  }

  Widget _passengers(Map<String, dynamic> route) {
    final roster = (route['roster'] as List).cast<Map<String, dynamic>>();
    final used = route['used_seats'] as int;
    final total = route['seat_capacity'] as int;
    final available = route['available_seats'] as int;
    final capacity = '$used usados · $available disponibles · $total total';
    return _surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _heading('Pasajeros · ${roster.length}'),
          const SizedBox(height: 8),
          Semantics(
            key: const Key('driver-capacity'),
            label: 'Capacidad: $capacity',
            child: ExcludeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '$used de $total cupos usados · $available disponibles',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: total > 0 ? (used / total).clamp(0, 1) : 0,
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(4),
                    backgroundColor: const Color(0xFFEAF3FF),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (roster.isEmpty)
            const Text('Sin pasajeros asignados para hoy.')
          else
            Theme(
              data: Theme.of(
                context,
              ).copyWith(dividerColor: Colors.transparent),
              child: Column(
                children: [
                  for (var i = 0; i < roster.length; i++) ...[
                    if (i > 0)
                      const Divider(height: 1, color: Color(0xFFD8E0EB)),
                    ExpansionTile(
                      key: ValueKey('passenger-${route['route_id']}-$i'),
                      tilePadding: EdgeInsets.zero,
                      childrenPadding: const EdgeInsets.only(bottom: 12),
                      minTileHeight: 64,
                      title: Text(
                        roster[i]['student_display_name'] as String,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      subtitle: Text(
                        roster[i]['pickup_instruction'] as String,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Contacto del apoderado',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF526176),
                                ),
                              ),
                              Text(
                                roster[i]['guardian_display_name'] as String,
                              ),
                              Text(roster[i]['guardian_contact'] as String),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _otherRoutes(
    List<Map<String, dynamic>> routes,
    Map<String, dynamic> focus,
  ) => _surface(
    child: ExpansionTile(
      key: const Key('other-routes'),
      tilePadding: EdgeInsets.zero,
      title: Text(
        'Otras rutas de hoy · ${routes.length - 1}',
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      ),
      children: [
        for (final route in routes)
          if (route['route_id'] != focus['route_id'])
            ListTile(
              key: ValueKey('select-route-${route['route_id']}'),
              contentPadding: EdgeInsets.zero,
              title: Text(route['label'] as String),
              subtitle: Text(
                '${route['start_time']}–${route['end_time']} · ${_state(_runState(route))}',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: loading
                  ? null
                  : () => setState(() {
                      selectedRoute = route['route_id'] as int;
                      mapError = null;
                    }),
            ),
      ],
    ),
  );

  Widget _unfinished(List<Map<String, dynamic>> runs) => _surface(
    child: ExpansionTile(
      key: const Key('unfinished-runs'),
      tilePadding: EdgeInsets.zero,
      leading: const Icon(Icons.pending_actions, color: Color(0xFF835313)),
      title: Text(
        'Rutas anteriores sin completar · ${runs.length}',
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      ),
      children: [
        for (final run in runs)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${run['label']} · ${_date(run['service_date'] as String)}',
                ),
                Text(
                  '${run['start_time']}–${run['end_time']} · En curso',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                OutlinedButton(
                  key: ValueKey('recover-${run['id']}'),
                  onPressed: loading || needsReload
                      ? null
                      : () => _confirmEnd(run, run['label'] as String),
                  child: const Text('Finalizar servicio pendiente'),
                ),
              ],
            ),
          ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final routes = _rows('routes');
    final unfinished = _rows('unfinished_runs');
    final focus = _focus(routes);
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 32 + MediaQuery.textScalerOf(context).scale(24),
        title: const Text(
          'FurgoPlus',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        actions: [
          TextButton(onPressed: widget.auth.logout, child: const Text('Salir')),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(
                          header: true,
                          child: Text(
                            'Hoy',
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                        ),
                        Text(
                          today == null
                              ? 'Tu jornada de transporte'
                              : _date(
                                  today!['service_date'] as String,
                                  natural: true,
                                ),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    key: const Key('reload-today'),
                    tooltip: 'Actualizar día',
                    constraints: const BoxConstraints(
                      minWidth: 48,
                      minHeight: 48,
                    ),
                    onPressed: loading || confirmation != null
                        ? null
                        : _refresh,
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (loading) ...[
                const LinearProgressIndicator(
                  semanticsLabel: 'Consultando tu día',
                ),
                const SizedBox(height: 12),
              ],
              if (error != null) ...[
                Semantics(
                  liveRegion: true,
                  child: Container(
                    key: const Key('driver-error'),
                    padding: const EdgeInsets.all(16),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF5DF),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (today == null) _heading('No pudimos cargar tu día'),
                        Text(
                          error!,
                          style: const TextStyle(
                            color: Color(0xFF835313),
                            fontSize: 16,
                          ),
                        ),
                        TextButton(
                          onPressed: loading ? null : _refresh,
                          child: const Text('Actualizar estado'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              if (focus != null) ...[
                _hero(focus),
                if (unfinished.isNotEmpty) _unfinished(unfinished),
                _destination(focus),
                // Reset contact disclosure when changing service or identity.
                KeyedSubtree(
                  key: ValueKey('roster-$sessionVersion-${focus['route_id']}'),
                  child: _passengers(focus),
                ),
                if (routes.length > 1) _otherRoutes(routes, focus),
              ] else if (today != null) ...[
                _surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.event_available_outlined,
                        size: 32,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(height: 12),
                      _heading('Sin servicio para hoy'),
                      const SizedBox(height: 8),
                      const Text('No hay rutas programadas para hoy.'),
                    ],
                  ),
                ),
                if (unfinished.isNotEmpty) _unfinished(unfinished),
              ] else if (loading)
                Semantics(
                  liveRegion: true,
                  child: const Text('Consultando tus servicios…'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
