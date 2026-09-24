import 'package:flutter/material.dart';

import 'auth_controller.dart';
import 'session_api.dart';

const _days = {
  'monday': 'lunes',
  'tuesday': 'martes',
  'wednesday': 'miércoles',
  'thursday': 'jueves',
  'friday': 'viernes',
  'saturday': 'sábado',
  'sunday': 'domingo',
};

String _schedule(Map<String, dynamic> route) {
  final days = (route['weekdays'] as List)
      .map((day) => _days[day] ?? day)
      .join(', ');
  return '$days · ${route['start_time']}–${route['end_time']} · ${_date(route['next_service_date'] as String)} · ${route['available_seats']} cupos';
}

String _date(String iso) {
  final parts = iso.split('T').first.split('-');
  return parts.length == 3 ? '${parts[2]}-${parts[1]}-${parts[0]}' : iso;
}

String _reviews(Map<String, dynamic> driver) => driver['review_count'] == 0
    ? 'Sin reseñas'
    : '${driver['review_average']} / 5 · ${driver['review_count']} reseñas';

String _status(String status) => switch (status) {
  'pending' => 'Pendiente',
  'accepted' => 'Aceptada',
  'declined' => 'Rechazada',
  'cancelled' => 'Cancelada',
  _ => status,
};

class ParentHome extends StatefulWidget {
  const ParentHome({super.key, required this.auth});
  final AuthController auth;
  @override
  State<ParentHome> createState() => _ParentHomeState();
}

class _ParentHomeState extends State<ParentHome> {
  int tab = 0;
  String? commune;
  String? error;
  bool loading = false;
  bool searched = false;
  List<Map<String, dynamic>> communes = [];
  List<Map<String, dynamic>> drivers = [];
  List<Map<String, dynamic>> requests = [];
  final selected = <int>[];
  Map<String, dynamic>? detail;
  List<Map<String, dynamic>>? comparison;
  Map<String, dynamic>? requestDetail;
  Map<String, dynamic>? profile;
  final message = TextEditingController();
  final name = TextEditingController();
  bool consent = false;

  NativeSessionApi get api => widget.auth.api;

  @override
  void initState() {
    super.initState();
    _loadCommunes();
  }

  @override
  void dispose() {
    message.dispose();
    name.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _rows(dynamic raw) =>
      (raw as List).cast<Map<String, dynamic>>();

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await action();
    } on AuthFailure catch (failure) {
      if (failure.code == 'not_authenticated') {
        widget.auth.expire();
        return;
      }
      if (mounted)
        setState(
          () => error = failure.code == 'pending_request_exists'
              ? 'Ya tienes una solicitud pendiente para este conductor.'
              : failure.code == 'driver_ineligible' || failure.status == 404
              ? 'Este conductor ya no está disponible. Actualiza la búsqueda.'
              : failure.message,
        );
    } catch (_) {
      if (mounted) setState(() => error = 'No se pudo conectar. Reintenta.');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _loadCommunes() => _run(() async {
    final body = await api.get('discovery/communes/');
    setState(() => communes = _rows(body['communes']));
  });

  Future<void> _search() => _run(() async {
    if (commune == null) return;
    final body = await api.get(
      'discovery/drivers/?commune=${Uri.encodeQueryComponent(commune!)}',
    );
    setState(() {
      drivers = _rows(body['results']);
      searched = true;
      detail = null;
      comparison = null;
      selected.clear();
    });
  });

  Future<void> _openDriver(int id) => _run(() async {
    final body = await api.get('discovery/drivers/$id/');
    setState(() {
      detail = body;
      comparison = null;
      consent = false;
      message.clear();
    });
  });

  void _toggle(int id) {
    setState(() {
      if (selected.contains(id)) {
        selected.remove(id);
      } else if (selected.length < 3) {
        selected.add(id);
      } else {
        error = 'Selecciona como máximo 3 conductores.';
      }
    });
  }

  Future<void> _compare() async {
    if (selected.length < 2) {
      setState(() => error = 'Selecciona 2 o 3 conductores.');
      return;
    }
    await _run(() async {
      try {
        final body = await api.get(
          'discovery/compare/?ids=${selected.join(',')}',
        );
        setState(() {
          comparison = _rows(body['results']);
          detail = null;
        });
      } on AuthFailure catch (failure) {
        if (failure.status == 404) {
          setState(() {
            comparison = null;
            drivers = [];
            searched = false;
            selected.clear();
            error = 'La selección cambió. Actualiza y vuelve a elegir.';
          });
          return;
        }
        rethrow;
      }
    });
  }

  Future<void> _send() async {
    if (detail == null ||
        message.text.trim().isEmpty ||
        message.text.trim().length > 500 ||
        !consent) {
      setState(
        () => error =
            'Escribe un mensaje de hasta 500 caracteres y acepta compartir tu correo.',
      );
      return;
    }
    await _run(() async {
      try {
        await api.write('parent/contact-requests/', {
          'driver_id': detail!['id'],
          'message': message.text.trim(),
          'consent_share_email': true,
        });
      } on AuthFailure catch (failure) {
        if (failure.status == 404) {
          setState(() {
            detail = null;
            drivers = [];
            searched = false;
            selected.clear();
          });
        }
        rethrow;
      }
      final body = await api.get('parent/contact-requests/');
      setState(() {
        requests = _rows(body['results']);
        detail = null;
        tab = 1;
      });
    });
  }

  Future<void> _loadRequests() => _run(() async {
    final body = await api.get('parent/contact-requests/');
    setState(() => requests = _rows(body['results']));
  });

  Future<void> _openRequest(int id) => _run(() async {
    final body = await api.get('parent/contact-requests/$id/');
    setState(() => requestDetail = body);
  });

  Future<void> _cancel(int id) => _run(() async {
    final body = await api.write('parent/contact-requests/$id/cancel/', {});
    final list = await api.get('parent/contact-requests/');
    setState(() {
      requestDetail = body;
      requests = _rows(list['results']);
    });
  });

  Future<void> _loadProfile() => _run(() async {
    final body = await api.get('parent/profile/');
    setState(() {
      profile = body;
      name.text = body['display_name'] as String;
    });
  });

  Future<void> _saveProfile() => _run(() async {
    final body = await api.write('parent/profile/', {
      'display_name': name.text.trim(),
    }, method: 'PATCH');
    setState(() => profile = body);
  });

  Widget _driverCard(Map<String, dynamic> driver, {bool selectable = false}) =>
      Card(
        key: ValueKey('driver-card-${driver['id']}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                driver['display_name'] as String,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Text('Validado'),
              Text(driver['service_summary'] as String),
              Text(
                (driver['coverage'] as List)
                    .map((c) => c['display_name'])
                    .join(', '),
              ),
              ..._rows(
                driver['routes'],
              ).map((route) => Text('${route['label']}: ${_schedule(route)}')),
              Text(_reviews(driver)),
              if (selectable) ...[
                TextButton(
                  onPressed: () => _openDriver(driver['id'] as int),
                  child: const Text('Ver detalle'),
                ),
                CheckboxListTile(
                  key: ValueKey('compare-driver-${driver['id']}'),
                  title: const Text('Comparar'),
                  value: selected.contains(driver['id']),
                  onChanged: (_) => _toggle(driver['id'] as int),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                ),
              ],
            ],
          ),
        ),
      );

  Widget _searchPage() {
    if (comparison != null)
      return ListView(
        children: [
          TextButton(
            key: const Key('comparison-back'),
            onPressed: () => setState(() => comparison = null),
            child: const Text('Volver'),
          ),
          const Text('Comparación'),
          ...comparison!.map((item) => _driverCard(item)),
        ],
      );
    if (detail != null)
      return ListView(
        children: [
          TextButton(
            onPressed: () => setState(() => detail = null),
            child: const Text('Volver'),
          ),
          _driverCard(detail!),
          const Text('Reseñas publicadas'),
          if ((detail!['reviews'] as List).isEmpty) const Text('Sin reseñas'),
          ..._rows(detail!['reviews']).map(
            (review) => Card(
              child: ListTile(
                title: Text(
                  '${review['score']} / 5 ${review['is_demo'] == true ? '· Datos de demostración' : ''}',
                ),
                subtitle: Text(
                  '${review['text']} · ${_date(review['created_on'] as String)}',
                ),
              ),
            ),
          ),
          const Text('Solicitar contacto'),
          TextField(
            key: const Key('contact-message'),
            controller: message,
            maxLength: 500,
            maxLines: 4,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Mensaje (sin datos de niños ni dirección de hogar)',
            ),
          ),
          CheckboxListTile(
            key: const Key('contact-consent'),
            value: consent,
            onChanged: (value) => setState(() => consent = value ?? false),
            title: const Text(
              'Acepto compartir mi correo de cuenta con este conductor.',
            ),
          ),
          FilledButton(
            key: const Key('send-contact-request'),
            onPressed: loading ? null : _send,
            child: const Text('Enviar solicitud'),
          ),
        ],
      );
    return ListView(
      children: [
        DropdownButtonFormField<String>(
          initialValue: commune,
          decoration: const InputDecoration(labelText: 'Comuna'),
          items: communes
              .map(
                (c) => DropdownMenuItem(
                  value: c['code'] as String,
                  child: Text(c['display_name'] as String),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() {
            commune = value;
            drivers = [];
            searched = false;
            selected.clear();
          }),
        ),
        FilledButton(
          onPressed: commune == null || loading ? null : _search,
          child: const Text('Buscar conductores'),
        ),
        if (searched && drivers.isEmpty && !loading)
          const Text('No hay conductores disponibles en esta comuna.'),
        ...drivers.map((driver) => _driverCard(driver, selectable: true)),
        if (selected.isNotEmpty) Text('${selected.length} seleccionados'),
        if (selected.length >= 2)
          FilledButton(
            key: const Key('compare-selected'),
            onPressed: _compare,
            child: const Text('Comparar'),
          ),
      ],
    );
  }

  Widget _requestsPage() {
    if (requestDetail != null) {
      final row = requestDetail!;
      return ListView(
        children: [
          TextButton(
            onPressed: () => setState(() => requestDetail = null),
            child: const Text('Volver'),
          ),
          Text(
            row['driver_display_name'] as String,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          Text(_status(row['status'] as String)),
          Text(_date(row['created_at'] as String)),
          Text(row['message'] as String),
          if (row['status'] == 'accepted' &&
              row['driver_service_email'] != null)
            SelectableText(
              'Correo de servicio compartido al aceptar: ${row['driver_service_email']}',
            ),
          if (row['status'] == 'pending')
            FilledButton(
              onPressed: () => _cancel(row['id'] as int),
              child: const Text('Cancelar solicitud'),
            ),
        ],
      );
    }
    return ListView(
      children: [
        TextButton(onPressed: _loadRequests, child: const Text('Actualizar')),
        if (requests.isEmpty) const Text('Aún no tienes solicitudes.'),
        ...requests.map(
          (row) => ListTile(
            title: Text(row['driver_display_name'] as String),
            subtitle: Text(
              '${_status(row['status'] as String)} · ${_date(row['created_at'] as String)}',
            ),
            onTap: () => _openRequest(row['id'] as int),
          ),
        ),
      ],
    );
  }

  Widget _profilePage() => ListView(
    children: [
      if (profile == null)
        TextButton(onPressed: _loadProfile, child: const Text('Cargar perfil')),
      if (profile != null) ...[
        TextField(
          controller: name,
          maxLength: 100,
          decoration: const InputDecoration(labelText: 'Nombre visible'),
        ),
        Text('Correo de cuenta: ${profile!['email']}'),
        FilledButton(
          onPressed: _saveProfile,
          child: const Text('Guardar nombre'),
        ),
      ],
    ],
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('FurgoPlus'),
      actions: [
        TextButton(onPressed: widget.auth.logout, child: const Text('Salir')),
      ],
    ),
    body: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          if (loading) const LinearProgressIndicator(),
          if (error != null)
            Row(
              children: [
                Expanded(child: Text(error!, key: const Key('parent-error'))),
                TextButton(
                  onPressed: () {
                    if (tab == 0) {
                      if (commune == null) {
                        _loadCommunes();
                      } else {
                        _search();
                      }
                    }
                    if (tab == 1) _loadRequests();
                    if (tab == 2) _loadProfile();
                  },
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          Expanded(
            child: switch (tab) {
              0 => _searchPage(),
              1 => _requestsPage(),
              _ => _profilePage(),
            },
          ),
        ],
      ),
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: (value) {
        setState(() {
          tab = value;
          detail = null;
          comparison = null;
          requestDetail = null;
        });
        if (value == 1) _loadRequests();
        if (value == 2) _loadProfile();
      },
      destinations: const [
        NavigationDestination(icon: Icon(Icons.search), label: 'Buscar'),
        NavigationDestination(
          icon: Icon(Icons.mail_outline),
          label: 'Solicitudes',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          label: 'Perfil',
        ),
      ],
    ),
  );
}
