import 'package:flutter/material.dart';

import 'auth_controller.dart';
import 'legal_access.dart';
import 'parent_service.dart';
import 'parent_presentation.dart';
import 'session_api.dart';

String _status(String status) => switch (status) {
  'pending' => 'Pendiente',
  'accepted' => 'Aceptada',
  'declined' => 'Rechazada',
  'cancelled' => 'Cancelada',
  _ => 'Estado por confirmar',
};

class ParentHome extends StatefulWidget {
  const ParentHome({super.key, required this.auth});
  final AuthController auth;
  @override
  State<ParentHome> createState() => _ParentHomeState();
}

class _ParentHomeState extends State<ParentHome> {
  int tab = 0;
  late int sessionVersion;
  int operation = 0;
  bool loading = false;
  bool sending = false;
  bool searched = false;
  bool requestsLoaded = false;
  bool filtersOpen = false;
  bool contactOpen = false;
  bool nameOpen = false;
  bool consent = false;
  bool uncertainSend = false;
  bool duplicate = false;
  int? duplicateDriver;
  int shownRequests = 3;
  int shownReviews = 3;
  String? commune;
  String? filterDraft;
  String? error;
  String? feedback;
  String? formError;
  Future<void> Function()? retry;
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
  final scroll = ScrollController();
  final messenger = GlobalKey<ScaffoldMessengerState>();
  final contactErrorAnchor = GlobalKey();
  final actionArea = GlobalKey();

  NativeSessionApi get api => widget.auth.api;
  bool get active =>
      mounted &&
      sessionVersion == widget.auth.sessionVersion &&
      widget.auth.state == AuthState.parent;
  bool current(int ticket) => active && ticket == operation;

  @override
  void initState() {
    super.initState();
    sessionVersion = widget.auth.sessionVersion;
    widget.auth.addListener(_sessionChanged);
    _bootstrap();
  }

  @override
  void didUpdateWidget(ParentHome oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.auth != widget.auth) {
      oldWidget.auth.removeListener(_sessionChanged);
      widget.auth.addListener(_sessionChanged);
      _clearPrivate();
      sessionVersion = widget.auth.sessionVersion;
      if (active) _bootstrap();
    }
  }

  void _sessionChanged() {
    if (sessionVersion == widget.auth.sessionVersion &&
        widget.auth.state == AuthState.parent)
      return;
    setState(_clearPrivate);
    sessionVersion = widget.auth.sessionVersion;
    if (active) _bootstrap();
  }

  void _clearPrivate() {
    operation++;
    tab = 0;
    loading = sending = searched = requestsLoaded = false;
    filtersOpen = contactOpen = nameOpen = consent = false;
    uncertainSend = duplicate = false;
    duplicateDriver = null;
    commune = filterDraft = error = feedback = formError = null;
    retry = null;
    communes = [];
    drivers = [];
    requests = [];
    selected.clear();
    detail = requestDetail = profile = null;
    comparison = null;
    shownRequests = shownReviews = 3;
    message.clear();
    name.clear();
    messenger.currentState
      ?..clearSnackBars()
      ..removeCurrentSnackBar();
  }

  @override
  void dispose() {
    widget.auth.removeListener(_sessionChanged);
    operation++;
    message.dispose();
    name.dispose();
    scroll.dispose();
    super.dispose();
  }

  void _top() {
    FocusManager.instance.primaryFocus?.unfocus();
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  void _notice(String text) {
    feedback = text;
    messenger.currentState
      ?..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(text),
          duration: const Duration(seconds: 6),
          behavior: SnackBarBehavior.floating,
          margin: EdgeInsets.fromLTRB(
            16,
            8,
            16,
            12 + (actionArea.currentContext?.size?.height ?? 0),
          ),
        ),
      );
  }

  void _revealContactError() {
    final ticket = operation;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!current(ticket) || !contactOpen) return;
      final anchor = contactErrorAnchor.currentContext;
      if (anchor != null) {
        Scrollable.ensureVisible(
          anchor,
          alignment: 1,
          duration: const Duration(milliseconds: 200),
        );
      }
    });
  }

  int _begin() {
    final ticket = ++operation;
    setState(() {
      loading = true;
      error = null;
      retry = null;
    });
    return ticket;
  }

  void _unavailable() {
    detail = null;
    comparison = null;
    drivers = [];
    selected.clear();
    searched = false;
    contactOpen = consent = false;
    message.clear();
    formError = null;
    uncertainSend = duplicate = false;
    duplicateDriver = null;
    feedback = null;
  }

  void _failure(
    Object failure,
    int ticket,
    Future<void> Function() read, {
    bool service = false,
  }) {
    if (!current(ticket)) return;
    if (failure is AuthFailure && failure.code == 'not_authenticated') {
      widget.auth.expire();
      return;
    }
    setState(() {
      if (service &&
          failure is AuthFailure &&
          (failure.status == 404 || failure.code == 'driver_ineligible')) {
        _unavailable();
        error = 'Este servicio ya no está disponible.';
        retry = null;
        _top();
      } else if (failure is AuthFailure && failure.status < 500) {
        error = failure.code == 'throttled'
            ? 'Hay demasiados intentos. Espera un momento antes de actualizar.'
            : 'No pudimos mostrar esta información. Vuelve a la lista para continuar.';
        retry = null;
      } else {
        error =
            'No pudimos actualizar. La información anterior puede haber cambiado.';
        retry = read;
      }
    });
  }

  Future<void> _bootstrap() async {
    // Discovery is useful immediately; a catalog read never erases its failure.
    final searching = _search();
    final ticket = operation;
    await searching;
    if (current(ticket) &&
        error == null &&
        tab == 0 &&
        detail == null &&
        comparison == null) {
      await _loadCommunes();
    }
  }

  Future<void> _loadCommunes() async {
    final ticket = _begin();
    try {
      final body = await api.get('discovery/communes/');
      if (!current(ticket)) return;
      setState(() => communes = publicRows(body['communes']));
    } catch (failure) {
      _failure(failure, ticket, _loadCommunes);
    } finally {
      if (current(ticket)) setState(() => loading = false);
    }
  }

  Future<void> _search() async {
    final ticket = _begin();
    setState(() {
      detail = null;
      comparison = null;
      drivers = [];
      selected.clear();
      searched = false;
      filtersOpen = false;
    });
    _top();
    final query = commune == null
        ? ''
        : '?commune=${Uri.encodeQueryComponent(commune!)}';
    try {
      final body = await api.get('discovery/drivers/$query');
      if (!current(ticket)) return;
      setState(() {
        drivers = publicRows(body['results']);
        searched = true;
      });
    } catch (failure) {
      _failure(failure, ticket, _search);
    } finally {
      if (current(ticket)) setState(() => loading = false);
    }
  }

  Future<void> _openDriver(int id) async {
    final ticket = _begin();
    setState(() {
      detail = null;
      comparison = null;
      contactOpen = consent = false;
      formError = null;
      uncertainSend = duplicate = false;
      message.clear();
      shownReviews = 3;
    });
    _top();
    try {
      final body = await api.get('discovery/drivers/$id/');
      if (!current(ticket)) return;
      setState(() => detail = body);
    } catch (failure) {
      _failure(failure, ticket, () => _openDriver(id), service: true);
    } finally {
      if (current(ticket)) setState(() => loading = false);
    }
  }

  void _toggle(int id) {
    if (loading) return;
    setState(() {
      if (selected.contains(id)) {
        selected.remove(id);
      } else if (selected.length < 3) {
        selected.add(id);
      } else {
        error = 'Selecciona como máximo 3 servicios.';
        _notice(error!);
      }
    });
  }

  Future<void> _compare() async {
    if (loading || selected.length < 2) return;
    final ticket = _begin();
    final ids = selected.join(',');
    comparison = null;
    _top();
    try {
      final body = await api.get('discovery/compare/?ids=$ids');
      if (!current(ticket)) return;
      setState(() => comparison = publicRows(body['results']));
    } catch (failure) {
      _failure(failure, ticket, _compare, service: true);
    } finally {
      if (current(ticket)) setState(() => loading = false);
    }
  }

  Future<void> _startContact() async {
    if (loading || detail == null) return;
    // Revalidate direct-ID access immediately before exposing the request action.
    final id = detail!['id'] as int;
    final version = sessionVersion;
    final opening = _openDriver(id);
    var ticket = operation;
    await opening;
    if (!current(ticket) ||
        version != sessionVersion ||
        detail == null ||
        detail!['id'] != id ||
        error != null)
      return;
    if (widget.auth.email == null && profile == null) {
      final reading = _loadProfile();
      ticket = operation;
      await reading;
      if (!current(ticket) || version != sessionVersion || profile == null)
        return;
    }
    setState(() => contactOpen = true);
    _top();
  }

  Future<void> _send() async {
    if (sending || loading || uncertainSend || duplicate || detail == null)
      return;
    if (!consent ||
        message.text.trim().isEmpty ||
        message.text.trim().length > 500) {
      setState(
        () => formError =
            'Escribe un mensaje de hasta 500 caracteres y acepta compartir tu correo.',
      );
      _revealContactError();
      return;
    }
    final id = detail!['id'] as int;
    final text = message.text.trim();
    final ticket = _begin();
    setState(() {
      sending = true;
      formError = null;
    });
    try {
      final body = await api.write('parent/contact-requests/', {
        'driver_id': id,
        'message': text,
        'consent_share_email': true,
      });
      if (!current(ticket)) return;
      setState(() {
        requests = [body, ...requests.where((row) => row['id'] != body['id'])];
        tab = 1;
        requestDetail = null;
        contactOpen = consent = false;
        detail = null;
        message.clear();
        shownRequests = 3;
        _notice('Solicitud enviada');
      });
      _top();
      // The confirmed mutation is retained even if this read fails.
      await _refreshRequests(ticket, confirmed: 'Solicitud enviada');
    } catch (failure) {
      if (!current(ticket)) return;
      if (failure is AuthFailure && failure.code == 'not_authenticated') {
        widget.auth.expire();
        return;
      }
      setState(() {
        if (failure is AuthFailure &&
            failure.code == 'pending_request_exists') {
          duplicate = true;
          duplicateDriver = id;
          formError = 'Ya tienes una solicitud activa para este servicio.';
        } else if (failure is AuthFailure &&
            (failure.status == 404 || failure.code == 'driver_ineligible')) {
          _unavailable();
          error = 'Este servicio ya no está disponible.';
          _top();
        } else if (failure is AuthFailure && failure.status < 500) {
          formError = failure.code == 'csrf_failed'
              ? 'La verificación caducó. Revisa la solicitud antes de enviarla nuevamente.'
              : 'No pudimos enviar la solicitud. Revisa el mensaje y el consentimiento.';
        } else {
          uncertainSend = true;
          formError =
              'No pudimos confirmar el envío. Revisa Solicitudes antes de crear otra solicitud.';
        }
        _notice(
          uncertainSend
              ? 'No pudimos confirmar el envío'
              : 'No pudimos enviar la solicitud',
        );
        _revealContactError();
      });
    } finally {
      if (current(ticket))
        setState(() {
          loading = false;
          sending = false;
        });
    }
  }

  Future<void> _refreshRequests(int ticket, {String? confirmed}) async {
    try {
      final body = await api.get('parent/contact-requests/');
      if (!current(ticket)) return;
      setState(() {
        requests = publicRows(body['results']);
        requestsLoaded = true;
      });
    } catch (failure) {
      _failure(failure, ticket, _loadRequests);
      if (current(ticket) && confirmed != null) {
        setState(() {
          error =
              '$confirmed. No pudimos actualizar la lista; el cambio está confirmado.';
        });
      }
    }
  }

  Future<void> _loadRequests() async {
    final ticket = _begin();
    await _refreshRequests(ticket);
    if (current(ticket)) setState(() => loading = false);
  }

  Future<void> _openRequest(int id) async {
    final ticket = _begin();
    setState(() => requestDetail = null);
    _top();
    try {
      final body = await api.get('parent/contact-requests/$id/');
      if (!current(ticket)) return;
      setState(() => requestDetail = body);
    } catch (failure) {
      _failure(failure, ticket, () => _openRequest(id));
      if (current(ticket) && failure is AuthFailure && failure.status == 404) {
        setState(() {
          requests.removeWhere((row) => row['id'] == id);
          error = 'Esta solicitud ya no está disponible para tu cuenta.';
        });
      }
    } finally {
      if (current(ticket)) setState(() => loading = false);
    }
  }

  Future<void> _showDuplicate() async {
    final id = duplicateDriver;
    _navigate(1);
    final reading = _loadRequests();
    final ticket = operation;
    await reading;
    if (!current(ticket) || error != null || id == null) return;
    final matches = requests.where(
      (row) => row['driver_id'] == id && row['status'] == 'pending',
    );
    if (matches.isNotEmpty) await _openRequest(matches.first['id'] as int);
  }

  Future<void> _cancel() async {
    if (loading || requestDetail == null) return;
    final id = requestDetail!['id'] as int;
    final ticket = _begin();
    setState(() => sending = true);
    try {
      final body = await api.write('parent/contact-requests/$id/cancel/', {});
      if (!current(ticket)) return;
      setState(() {
        requestDetail = body;
        requests = requests.map((row) => row['id'] == id ? body : row).toList();
        _notice('Solicitud cancelada');
      });
      await _refreshRequests(ticket, confirmed: 'Solicitud cancelada');
    } catch (failure) {
      if (!current(ticket)) return;
      if (failure is AuthFailure && failure.code == 'not_authenticated') {
        widget.auth.expire();
        return;
      }
      setState(() {
        // No automatic or unchanged-data replay, including uncertain cancellation.
        requestDetail = null;
        if (failure is AuthFailure && failure.status == 404) {
          requests.removeWhere((row) => row['id'] == id);
        }
        error = failure is AuthFailure && failure.code == 'contact_conflict'
            ? 'La solicitud cambió. Actualiza Solicitudes para ver su estado.'
            : 'No pudimos confirmar la cancelación. Actualiza Solicitudes para ver su estado.';
        retry = null;
        _notice('Revisa el estado de la solicitud');
      });
    } finally {
      if (current(ticket))
        setState(() {
          loading = false;
          sending = false;
        });
    }
  }

  Future<void> _loadProfile() async {
    final ticket = _begin();
    try {
      final body = await api.get('parent/profile/');
      if (!current(ticket)) return;
      setState(() {
        profile = body;
        name.text = body['display_name'] as String;
      });
    } catch (failure) {
      _failure(failure, ticket, _loadProfile);
    } finally {
      if (current(ticket)) setState(() => loading = false);
    }
  }

  Future<void> _saveName() async {
    if (loading) return;
    if (name.text.trim().isEmpty || name.text.trim().length > 100) {
      setState(() => formError = 'Escribe un nombre de 1 a 100 caracteres.');
      return;
    }
    final ticket = _begin();
    setState(() => sending = true);
    try {
      final body = await api.write('parent/profile/', {
        'display_name': name.text.trim(),
      }, method: 'PATCH');
      if (!current(ticket)) return;
      setState(() {
        profile = body;
        nameOpen = false;
        formError = null;
        _notice('Nombre actualizado');
      });
      _top();
    } catch (failure) {
      if (!current(ticket)) return;
      if (failure is AuthFailure && failure.code == 'not_authenticated') {
        widget.auth.expire();
        return;
      }
      setState(() {
        formError = failure is AuthFailure && failure.status < 500
            ? 'No pudimos guardar. Revisa el nombre.'
            : 'No pudimos confirmar el cambio. Cierra el formulario y actualiza Mi cuenta para comprobarlo.';
        _notice('No pudimos confirmar el cambio');
      });
    } finally {
      if (current(ticket))
        setState(() {
          loading = false;
          sending = false;
        });
    }
  }

  void _navigate(int value) {
    operation++;
    setState(() {
      tab = value;
      loading = false;
      filtersOpen = contactOpen = nameOpen = consent = false;
      detail = requestDetail = null;
      comparison = null;
      error = feedback = formError = null;
      retry = null;
      message.clear();
      uncertainSend = duplicate = false;
    });
    messenger.currentState?.clearSnackBars();
    _top();
  }

  bool get _subpage =>
      filtersOpen ||
      contactOpen ||
      nameOpen ||
      detail != null ||
      comparison != null ||
      requestDetail != null;

  void _androidBack() {
    if (loading) return;
    final wasSubpage = _subpage;
    setState(() {
      if (contactOpen) {
        contactOpen = consent = false;
        message.clear();
        formError = null;
      } else if (filtersOpen) {
        filtersOpen = false;
      } else if (nameOpen) {
        nameOpen = false;
        formError = null;
        name.text = profile!['display_name'] as String;
      } else {
        detail = requestDetail = null;
        comparison = null;
      }
    });
    if (!wasSubpage && tab != 0) {
      _navigate(0);
      _search();
    }
    _top();
  }

  TextTheme get _type => parentTheme(Theme.of(context)).textTheme;

  Widget _heading(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Semantics(
      header: true,
      child: Text(text, style: _type.headlineMedium),
    ),
  );

  Widget _back(String text, VoidCallback action, {Key? key}) => Align(
    alignment: Alignment.centerLeft,
    child: TextButton.icon(
      key: key,
      onPressed: loading
          ? null
          : () {
              setState(action);
              _top();
            },
      icon: const Icon(Icons.arrow_back),
      label: Text(text),
    ),
  );

  Widget _errorNotice(String text, {Key? key}) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(
        text,
        key: key,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
    ),
  );

  List<Widget> _searchPage() {
    if (filtersOpen)
      return [
        _back('Volver a Buscar', () => filtersOpen = false),
        _heading('Filtrar servicios'),
        DropdownButtonFormField<String>(
          key: const Key('commune-filter'),
          initialValue: filterDraft,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Comuna'),
          items: [
            const DropdownMenuItem(value: '', child: Text('Todas las comunas')),
            ...communes.map(
              (row) => DropdownMenuItem(
                value: row['code'] as String,
                child: Text(row['display_name'] as String),
              ),
            ),
          ],
          onChanged: loading
              ? null
              : (value) => setState(() => filterDraft = value),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: loading
              ? null
              : () {
                  commune = filterDraft == '' ? null : filterDraft;
                  _search();
                },
          child: const Text('Buscar servicios'),
        ),
      ];
    if (comparison != null)
      return [
        _back(
          'Volver a Buscar',
          () => comparison = null,
          key: const Key('comparison-back'),
        ),
        _heading('Comparar servicios'),
        const Text(
          'Los cupos pueden cambiar. Compara la ruta y la fecha que necesitas.',
        ),
        const SizedBox(height: 16),
        ...comparison!.map(
          (driver) => ParentServiceCard(
            driver: driver,
            commune: commune,
            onOpen: loading ? null : () => _openDriver(driver['id'] as int),
            onRemove: loading
                ? null
                : () => setState(() {
                    selected.remove(driver['id']);
                    comparison!.removeWhere((row) => row['id'] == driver['id']);
                    if (comparison!.length < 2) comparison = null;
                  }),
          ),
        ),
      ];
    if (detail != null && contactOpen) return _contactPage();
    if (detail != null) return _servicePage();
    final communeName = communes
        .where((row) => row['code'] == commune)
        .map((row) => row['display_name'])
        .firstOrNull;
    return [
      _heading('Encuentra transporte'),
      const Text('Busca un servicio que cubra tu comuna.'),
      const SizedBox(height: 8),
      Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          OutlinedButton.icon(
            key: const Key('open-filters'),
            onPressed: loading
                ? null
                : () {
                    setState(() {
                      filtersOpen = true;
                      filterDraft = commune ?? '';
                    });
                    _top();
                    if (communes.isEmpty) _loadCommunes();
                  },
            icon: const Icon(Icons.tune),
            label: Wrap(
              spacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text('Filtros'),
                if (commune != null) ...[
                  Semantics(
                    label: '1 filtro activo',
                    excludeSemantics: true,
                    child: const ParentStateLabel('1', icon: Icons.check),
                  ),
                ],
              ],
            ),
          ),
          Tooltip(
            message: 'Actualizar búsqueda',
            child: TextButton.icon(
              key: const Key('refresh-search'),
              onPressed: loading ? null : _search,
              icon: const Icon(Icons.refresh),
              label: const Text('Actualizar'),
            ),
          ),
        ],
      ),
      if (communeName != null)
        ParentMetadata(Icons.location_on_outlined, communeName as String),
      if (selected.isNotEmpty)
        Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              '${selected.length} de 3 servicios seleccionados',
              style: _type.bodySmall,
            ),
          ),
        ),
      const SizedBox(height: 4),
      if (searched && drivers.isEmpty && !loading)
        ParentPanel(
          soft: true,
          child: ParentMetadata(
            Icons.directions_bus_outlined,
            commune == null
                ? 'No hay servicios disponibles por ahora.'
                : 'No hay servicios disponibles en esta comuna. Prueba otra comuna.',
          ),
        ),
      ...drivers.map(
        (driver) => ParentServiceCard(
          driver: driver,
          commune: commune,
          onOpen: loading ? null : () => _openDriver(driver['id'] as int),
          onSelect: () => _toggle(driver['id'] as int),
          selected: selected.contains(driver['id']),
        ),
      ),
      if (drivers.isNotEmpty)
        Text(
          'Los cupos pueden cambiar. Consulta el detalle antes de solicitar contacto.',
          style: _type.bodySmall,
        ),
    ];
  }

  List<Widget> _servicePage() {
    final driver = detail!;
    final routes = displayRoutes(driver, commune);
    final reviews = publicRows(driver['reviews']);
    return [
      _back('Volver a Buscar', () {
        detail = null;
        message.clear();
        consent = false;
      }),
      ParentPanel(
        key: const Key('service-hero'),
        soft: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ParentServiceIdentity(driver: driver),
            const SizedBox(height: 12),
            ParentMetadata(
              Icons.location_on_outlined,
              coverageSummary(driver['coverage'], commune),
            ),
            if (routes.isNotEmpty) ParentRouteSummary(routes.first),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const Key('start-contact'),
              onPressed: loading ? null : _startContact,
              icon: const Icon(Icons.mail_outline),
              label: const Text('Solicitar contacto'),
            ),
            const SizedBox(height: 8),
            Text(
              'Los cupos pueden cambiar. Solicitar contacto no reserva un cupo.',
              style: _type.bodySmall,
            ),
          ],
        ),
      ),
      Align(
        alignment: Alignment.centerLeft,
        child: ParentCompareAction(
          key: ValueKey('compare-driver-${driver['id']}'),
          selected: selected.contains(driver['id']),
          onPressed: loading ? null : () => _toggle(driver['id'] as int),
        ),
      ),
      const SizedBox(height: 8),
      ParentDisclosure(
        key: const Key('service-coverage'),
        title: 'Cobertura y horario',
        icon: Icons.route_outlined,
        children: [
          ParentMetadata(
            Icons.location_on_outlined,
            coverageText(driver['coverage']),
          ),
          ...routes.map(
            (route) => Padding(
              padding: const EdgeInsets.only(top: 12),
              child: ParentRouteSummary(route, showCoverage: true),
            ),
          ),
        ],
      ),
      ParentDisclosure(
        key: const Key('service-about'),
        title: 'Acerca del servicio',
        icon: Icons.directions_bus_outlined,
        children: [Text(driver['service_summary'] as String)],
      ),
      const ParentDisclosure(
        key: Key('service-trust'),
        title: '¿Qué significa validado?',
        icon: Icons.verified_outlined,
        children: [
          Text(
            'FurgoPlus revisó la información y los documentos enviados por el conductor según su proceso de validación. No es una certificación estatal ni una garantía de seguridad.',
          ),
        ],
      ),
      if (reviews.isEmpty)
        const ParentPanel(
          key: Key('service-reviews'),
          child: ParentMetadata(Icons.star_outline, 'Sin reseñas'),
        )
      else
        ParentDisclosure(
          key: const Key('service-reviews'),
          title: 'Reseñas publicadas',
          icon: Icons.star_outline,
          subtitle: Text(
            '${reviewSummary(driver)}${reviews.any((review) => review['is_demo'] == true) ? ' · Incluye datos de demostración' : ''}',
          ),
          children: [
            ...reviews
                .take(shownReviews)
                .map(
                  (review) => Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${review['score']} / 5 · ${parentDate(review['created_on'] as String)}',
                        ),
                        if (review['is_demo'] == true)
                          const Text('Datos de demostración'),
                        Text(review['text'] as String),
                      ],
                    ),
                  ),
                ),
            if (reviews.length > shownReviews)
              TextButton(
                onPressed: () => setState(() => shownReviews += 3),
                child: const Text('Ver más reseñas'),
              ),
          ],
        ),
    ];
  }

  List<Widget> _contactPage() {
    final email = widget.auth.email ?? profile?['email'];
    return [
      _back('Volver al servicio', () {
        contactOpen = false;
        consent = false;
        message.clear();
        formError = null;
      }),
      _heading('Solicitar contacto'),
      Text(
        'Para: ${detail!['display_name']}',
        key: const Key('contact-recipient'),
        style: _type.titleMedium,
      ),
      const SizedBox(height: 12),
      ParentPanel(
        key: const Key('contact-summary'),
        soft: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const ParentMetadata(Icons.alternate_email, 'Se compartirá:'),
            SelectableText(
              email as String,
              style: _type.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              'Este correo se compartirá con ${detail!['display_name']} para facilitar el contacto.',
              style: _type.bodySmall,
            ),
          ],
        ),
      ),
      TextField(
        key: const Key('contact-message'),
        controller: message,
        enabled: !loading && !uncertainSend && !duplicate,
        minLines: 1,
        maxLines: 3,
        maxLength: 500,
        decoration: const InputDecoration(
          labelText: 'Mensaje',
          helperText: 'No incluyas datos de niños ni tu dirección.',
          helperMaxLines: 3,
        ),
      ),
      CheckboxListTile(
        key: const Key('contact-consent'),
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
        value: consent,
        onChanged: loading || uncertainSend || duplicate
            ? null
            : (value) => setState(() => consent = value ?? false),
        title: const Text(
          'Acepto compartir este correo con el servicio indicado.',
        ),
      ),
      _contactAction(),
      if (formError != null)
        Padding(
          key: contactErrorAnchor,
          padding: EdgeInsets.zero,
          child: _errorNotice(formError!, key: const Key('contact-error')),
        ),
      const SizedBox(height: 8),
      const ParentDisclosure(
        key: Key('contact-privacy'),
        title: 'Privacidad de este contacto',
        icon: Icons.privacy_tip_outlined,
        children: [
          Text(
            'Este permiso es solo para compartir este correo con el servicio al enviar la solicitud. No es aceptación de Términos ni de la Política de Privacidad. No es autorización sobre datos de niños ni datos sensibles, ni permiso para marketing.',
          ),
          SizedBox(height: 8),
          Text(
            'Si el servicio acepta, verás su correo para coordinar el contacto.',
          ),
        ],
      ),
    ];
  }

  Widget _contactAction() => duplicate
      ? FilledButton(
          onPressed: loading ? null : _showDuplicate,
          child: const Text('Ver solicitud'),
        )
      : uncertainSend
      ? FilledButton(
          onPressed: loading
              ? null
              : () {
                  _navigate(1);
                  _loadRequests();
                },
          child: const Text('Ver Solicitudes'),
        )
      : FilledButton(
          key: const Key('send-contact-request'),
          style: FilledButton.styleFrom(
            minimumSize: const Size(48, 56),
            disabledBackgroundColor: const Color(0xFFE0E4EA),
            disabledForegroundColor: const Color(0xFF526176),
          ),
          onPressed: loading || !consent ? null : _send,
          child: Text(sending ? 'Enviando solicitud…' : 'Enviar solicitud'),
        );

  List<Widget> _requestsPage() {
    if (requestDetail != null) {
      final row = requestDetail!;
      final status = row['status'] as String;
      return [
        _back('Volver a Solicitudes', () => requestDetail = null),
        ParentPanel(
          soft: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _requestState(status),
              const SizedBox(height: 12),
              Text(
                row['driver_display_name'] as String,
                style: _type.titleLarge,
              ),
              const SizedBox(height: 8),
              ParentMetadata(
                Icons.calendar_today_outlined,
                'Enviada el ${parentDate(row['created_at'] as String)}',
              ),
              const SizedBox(height: 12),
              Text(switch (status) {
                'pending' =>
                  'El servicio aún no ha aceptado. Su correo estará disponible si acepta tu solicitud.',
                'accepted' =>
                  'El servicio aceptó tu solicitud. Ya puedes coordinar el contacto.',
                'declined' =>
                  'El servicio rechazó esta solicitud. Puedes buscar otras opciones.',
                'cancelled' =>
                  'Cancelaste esta solicitud. Ya no espera una respuesta.',
                _ => 'Actualiza la solicitud para confirmar su estado.',
              }),
            ],
          ),
        ),
        if (status == 'accepted')
          ParentPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const ParentMetadata(
                  Icons.mark_email_read_outlined,
                  'Correo del servicio',
                ),
                if (row['driver_service_email'] != null)
                  SelectableText(
                    row['driver_service_email'] as String,
                    style: _type.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                const SizedBox(height: 8),
                Text(
                  '${row['driver_display_name']} compartió este correo al aceptar tu solicitud.',
                  style: _type.bodySmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'La aceptación permite contactar al servicio; no reserva un cupo.',
                  style: _type.bodySmall,
                ),
              ],
            ),
          ),
        ParentDisclosure(
          key: const Key('request-message'),
          title: 'Tu mensaje',
          icon: Icons.chat_bubble_outline,
          children: [
            Text(row['message'] as String),
            if (row['resolved_at'] != null) ...[
              const SizedBox(height: 12),
              Text('Respuesta del ${parentDate(row['resolved_at'] as String)}'),
            ],
          ],
        ),
        if (status == 'pending') ...[
          OutlinedButton(
            onPressed: loading ? null : _cancel,
            child: const Text('Cancelar solicitud'),
          ),
          const SizedBox(height: 8),
          Text(
            'Si cancelas, esta solicitud dejará de esperar una respuesta.',
            style: _type.bodySmall,
          ),
        ],
        TextButton.icon(
          onPressed: loading ? null : () => _openRequest(row['id'] as int),
          icon: const Icon(Icons.refresh),
          label: const Text('Actualizar solicitud'),
        ),
        // Historical snapshots do not confer discovery access or new-request rights.
      ];
    }
    return [
      _heading('Tus solicitudes'),
      Align(
        alignment: Alignment.centerRight,
        child: TextButton.icon(
          onPressed: loading ? null : _loadRequests,
          icon: const Icon(Icons.refresh),
          label: const Text('Actualizar Solicitudes'),
        ),
      ),
      if (requestsLoaded && requests.isEmpty && !loading) ...[
        const ParentPanel(
          soft: true,
          child: ParentMetadata(
            Icons.mail_outline,
            'Aún no tienes solicitudes. Encuentra un servicio y solicita contacto.',
          ),
        ),
        FilledButton(
          onPressed: () {
            _navigate(0);
            _search();
          },
          child: const Text('Ir a Buscar'),
        ),
      ],
      ...requests
          .take(shownRequests)
          .map(
            (row) => ParentPanel(
              key: ValueKey('request-card-${row['id']}'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _requestState(row['status'] as String),
                  const SizedBox(height: 8),
                  Text(
                    row['driver_display_name'] as String,
                    style: _type.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  ParentMetadata(
                    Icons.calendar_today_outlined,
                    'Enviada el ${parentDate(row['created_at'] as String)}',
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: loading
                          ? null
                          : () => _openRequest(row['id'] as int),
                      icon: const Icon(Icons.arrow_forward),
                      label: const Text('Ver solicitud'),
                    ),
                  ),
                ],
              ),
            ),
          ),
      if (requests.length > shownRequests) ...[
        Semantics(
          liveRegion: true,
          child: Text('$shownRequests de ${requests.length} solicitudes'),
        ),
        OutlinedButton(
          onPressed: () => setState(() => shownRequests += 3),
          child: const Text('Ver solicitudes anteriores'),
        ),
      ],
    ];
  }

  Widget _requestState(String status) => ParentStateLabel(
    _status(status),
    icon: requestStatusIcon(status),
    color: requestStatusColor(status),
  );

  List<Widget> _accountPage() {
    if (nameOpen)
      return [
        _back('Volver a Mi cuenta', () {
          nameOpen = false;
          formError = null;
          name.text = profile!['display_name'] as String;
        }),
        _heading('Editar nombre'),
        TextField(
          controller: name,
          enabled: !loading,
          maxLength: 100,
          decoration: const InputDecoration(labelText: 'Nombre visible'),
        ),
        if (formError != null) _errorNotice(formError!),
        FilledButton(
          onPressed: loading ? null : _saveName,
          child: const Text('Guardar nombre'),
        ),
      ];
    final email = widget.auth.email ?? profile?['email'];
    return [
      _heading('Tu cuenta'),
      ParentPanel(
        soft: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const ParentIcon(Icons.person_outline),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const ParentStateLabel(
                        'Apoderado/a',
                        icon: Icons.school_outlined,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        profile?['display_name'] as String? ??
                            widget.auth.displayName ??
                            '',
                        style: _type.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const ParentMetadata(Icons.alternate_email, 'Correo de cuenta'),
            if (email != null) SelectableText(email as String),
          ],
        ),
      ),
      if (profile != null)
        Card(
          child: ListTile(
            minVerticalPadding: 12,
            leading: const Icon(Icons.edit_outlined, color: parentBlue),
            title: const Text('Editar nombre'),
            trailing: const Icon(Icons.chevron_right),
            onTap: loading
                ? null
                : () {
                    setState(() {
                      nameOpen = true;
                      formError = null;
                    });
                    _top();
                  },
          ),
        ),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: loading ? null : _loadProfile,
          icon: const Icon(Icons.refresh),
          label: const Text('Actualizar Mi cuenta'),
        ),
      ),
      const SizedBox(height: 16),
      Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: widget.auth.logout,
          icon: const Icon(Icons.logout),
          label: const Text('Cerrar sesión'),
        ),
      ),
      const LegalLinks(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (!active)
      return const Scaffold(body: SafeArea(child: SizedBox.shrink()));
    return Theme(
      data: parentTheme(Theme.of(context)),
      child: Builder(builder: _buildWorkspace),
    );
  }

  Widget _buildWorkspace(BuildContext context) {
    final children = switch (tab) {
      0 => _searchPage(),
      1 => _requestsPage(),
      _ => _accountPage(),
    };
    return PopScope(
      canPop: !_subpage && tab == 0 && !sending,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _androidBack();
      },
      child: ScaffoldMessenger(
        key: messenger,
        child: Scaffold(
          appBar: AppBar(
            toolbarHeight: 60,
            title: Image.asset(
              'assets/furgoplus-logo.png',
              width: 188,
              height: 40,
              fit: BoxFit.contain,
              semanticLabel: 'FurgoPlus · Transporte Escolar',
            ),
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            centerTitle: false,
          ),
          body: SafeArea(
            child: Column(
              children: [
                if (loading)
                  const LinearProgressIndicator(
                    semanticsLabel: 'Cargando información',
                  ),
                Expanded(
                  child: ListView(
                    key: ValueKey(
                      'parent-page-$tab-$filtersOpen-$contactOpen-$nameOpen-${detail?['id']}-${requestDetail?['id']}-${comparison != null}',
                    ),
                    controller: scroll,
                    padding: EdgeInsets.fromLTRB(
                      16,
                      tab == 0 && !_subpage ? 8 : 16,
                      16,
                      tab == 0 && !_subpage ? 24 : 16,
                    ),
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    children: [
                      if (feedback != null)
                        Semantics(
                          liveRegion: true,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(feedback!),
                          ),
                        ),
                      if (error != null) ...[
                        _errorNotice(error!, key: const Key('parent-error')),
                        if (retry != null)
                          TextButton(
                            onPressed: loading ? null : retry,
                            child: const Text('Reintentar'),
                          ),
                        if (error == 'Este servicio ya no está disponible.')
                          TextButton(
                            onPressed: loading ? null : _search,
                            child: const Text('Volver a Buscar'),
                          ),
                      ],
                      ...children,
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
                if (tab == 0 && !_subpage && selected.length >= 2)
                  SafeArea(
                    key: actionArea,
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                      child: FilledButton.icon(
                        key: const Key('compare-selected'),
                        onPressed: loading ? null : _compare,
                        icon: const Icon(Icons.compare_arrows),
                        label: Text('Comparar servicios · ${selected.length}'),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          bottomNavigationBar: MediaQuery.viewInsetsOf(context).bottom > 0
              ? null
              : NavigationBar(
                  selectedIndex: tab,
                  onDestinationSelected: sending
                      ? null
                      : (value) {
                          _navigate(value);
                          if (value == 0) _search();
                          if (value == 1) _loadRequests();
                          if (value == 2) _loadProfile();
                        },
                  destinations: const [
                    NavigationDestination(
                      icon: Icon(Icons.search),
                      label: 'Buscar',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.mail_outline),
                      label: 'Solicitudes',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.person_outline),
                      label: 'Mi cuenta',
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
