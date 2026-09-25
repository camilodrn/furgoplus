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
  bool loading = true;
  String? error;

  NativeSessionApi get api => widget.auth.api;
  DestinationLauncher get launcher =>
      widget.launcher ?? ExternalDestinationLauncher();

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _run(Future<void> Function() action) async {
    if (mounted)
      setState(() {
        loading = true;
        error = null;
      });
    try {
      await action();
    } on AuthFailure catch (failure) {
      if (failure.code == 'not_authenticated') {
        if (mounted) widget.auth.expire();
        return;
      }
      if (mounted) setState(() => error = failure.message);
    } catch (_) {
      if (mounted) setState(() => error = 'No se pudo conectar. Reintenta.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _refresh() => _run(() async {
    final body = await api.get('driver/today/');
    if (mounted) setState(() => today = body);
  });

  Future<void> _start(int routeId) => _run(() async {
    await api.write('driver/routes/$routeId/start/', {});
    final body = await api.get('driver/today/');
    if (mounted) setState(() => today = body);
  });

  Future<void> _end(int runId) => _run(() async {
    await api.write('driver/runs/$runId/end/', {});
    final body = await api.get('driver/today/');
    if (mounted) setState(() => today = body);
  });

  Future<void> _openMaps(String address) async {
    try {
      if (address.trim().isEmpty || !await launcher.open(address)) {
        throw StateError('No external maps provider');
      }
      if (mounted) setState(() => error = null);
    } catch (_) {
      if (mounted) {
        setState(() => error = 'No se pudo abrir mapas. Intenta de nuevo.');
      }
    }
  }

  String _date(String iso) {
    final parts = iso.split('-');
    return parts.length == 3 ? '${parts[2]}-${parts[1]}-${parts[0]}' : iso;
  }

  String _state(String state) => switch (state) {
    'in_progress' => 'En curso',
    'completed' => 'Completada',
    _ => 'Planificada',
  };

  Widget _route(Map<String, dynamic> route) {
    final run = route['run'] as Map<String, dynamic>?;
    final state = run?['state'] as String? ?? 'planned';
    final roster = (route['roster'] as List).cast<Map<String, dynamic>>();
    return Card(
      key: ValueKey('today-route-${route['route_id']}'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              route['label'] as String,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            Text(
              '${route['start_time']}–${route['end_time']} · ${_state(state)}',
            ),
            Text(
              '${route['used_seats']} usados · ${route['available_seats']} disponibles · ${route['seat_capacity']} total',
            ),
            const SizedBox(height: 8),
            Text('Destino: ${route['destination_label']}'),
            Text(route['destination_address'] as String),
            TextButton(
              key: ValueKey('maps-${route['route_id']}'),
              onPressed: () =>
                  _openMaps(route['destination_address'] as String),
              child: const Text('Abrir en mapas'),
            ),
            const Text('El destino se compartirá con la aplicación de mapas.'),
            const SizedBox(height: 8),
            const Text('Pasajeros'),
            if (roster.isEmpty) const Text('Sin pasajeros asignados para hoy.'),
            ...roster.map(
              (row) => ListTile(
                title: Text(row['student_display_name'] as String),
                subtitle: Text(
                  '${row['pickup_instruction']}\n${row['guardian_display_name']} · ${row['guardian_contact']}',
                ),
                isThreeLine: true,
              ),
            ),
            if (state == 'planned')
              FilledButton(
                key: ValueKey('start-${route['route_id']}'),
                onPressed: loading
                    ? null
                    : () => _start(route['route_id'] as int),
                child: const Text('Iniciar ruta'),
              ),
            if (state == 'in_progress')
              FilledButton(
                key: ValueKey('end-${run!['id']}'),
                onPressed: loading ? null : () => _end(run['id'] as int),
                child: const Text('Completar ruta'),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final routes = (today?['routes'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    final unfinished = (today?['unfinished_runs'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('FurgoPlus · Conductor'),
        actions: [
          TextButton(onPressed: widget.auth.logout, child: const Text('Salir')),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (loading) const LinearProgressIndicator(),
            if (error != null) ...[
              Text(error!, key: const Key('driver-error')),
              TextButton(onPressed: _refresh, child: const Text('Reintentar')),
            ],
            if (today != null)
              Text(
                'Hoy en Chile: ${_date(today!['service_date'] as String)}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            TextButton(
              onPressed: loading ? null : _refresh,
              child: const Text('Actualizar'),
            ),
            Expanded(
              child: ListView(
                children: [
                  if (today != null && routes.isEmpty)
                    const Text('No hay rutas programadas para hoy.'),
                  ...routes.map(_route),
                  if (unfinished.isNotEmpty)
                    const Text('Rutas anteriores sin completar'),
                  ...unfinished.map(
                    (run) => Card(
                      child: ListTile(
                        title: Text(
                          '${run['label']} · ${_date(run['service_date'] as String)}',
                        ),
                        subtitle: Text(
                          '${run['start_time']}–${run['end_time']} · En curso',
                        ),
                        trailing: TextButton(
                          key: ValueKey('recover-${run['id']}'),
                          onPressed: loading
                              ? null
                              : () => _end(run['id'] as int),
                          child: const Text('Completar'),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
