import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'auth_controller.dart';
import 'legal_access.dart';
import 'furgo_theme.dart';
import 'furgo_widgets.dart';
import 'plan_help_screen.dart';
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
  int destination = 0;
  final visitedDestinations = <int>{0};
  bool accountOpen = false;
  String? journeyPage;
  String? passengerOrigin;
  Map<String, dynamic>? today;
  bool loading = false;
  bool needsReload = false;
  bool transitionUncertain = false;
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
    destination = 0;
    visitedDestinations.clear();
    visitedDestinations.add(0);
    accountOpen = false;
    journeyPage = passengerOrigin = null;
    error = mapError = null;
    selectedRoute = null;
    loading = needsReload = transitionUncertain = false;
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

  void _selectDestination(int index) {
    if (!active ||
        confirmation != null ||
        (destination == index && !accountOpen && journeyPage == null))
      return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      destination = index;
      visitedDestinations.add(index);
      accountOpen = false;
    });
  }

  void _openJourney(String? page) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      if (page == 'passengers') passengerOrigin = journeyPage;
      journeyPage = page;
      if (scroll.hasClients) scroll.jumpTo(0);
    });
  }

  Widget _capacity(Map<String, dynamic> route, {Key? key}) => FurgoCapacity(
    key: key,
    used: route['used_seats'] as int,
    total: route['seat_capacity'] as int,
    available: route['available_seats'] as int,
  );

  Widget _routeContext(Map<String, dynamic> route) => FurgoSurface(
    emphasis: true,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ExcludeSemantics(
              child: Icon(Icons.route_outlined, color: FurgoColors.blue),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                route['label'] as String,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: [
            Text(
              '${route['start_time']}–${route['end_time']}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text(_date(today!['service_date'] as String)),
          ],
        ),
      ],
    ),
  );

  Widget _journeyDetails(Map<String, dynamic> route) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _routeContext(route),
      _surface(child: _destination(route)),
      _surface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FurgoFact('Estado', _state(_runState(route))),
            _capacity(route),
            const SizedBox(height: 12),
            TextButton.icon(
              key: const Key('detail-passengers'),
              onPressed: () => _openJourney('passengers'),
              icon: const Icon(Icons.people_outline),
              label: const Text('Consultar pasajeros'),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _journeyPassengers(Map<String, dynamic> route) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _routeContext(route),
      const SizedBox(height: 16),
      KeyedSubtree(
        key: ValueKey('roster-$sessionVersion-${route['route_id']}'),
        child: DriverTodayPassengers(route: route),
      ),
    ],
  );

  Widget _account() => ListView(
    key: const Key('driver-account'),
    padding: const EdgeInsets.all(20),
    children: [
      FurgoAccountSummary(
        role: 'Conductor',
        name: widget.auth.displayName,
        email: widget.auth.email,
      ),
      const SizedBox(height: 24),
      Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: widget.auth.logout,
          icon: const Icon(Icons.logout),
          label: const Text('Cerrar sesión'),
        ),
      ),
      const SizedBox(height: 16),
      const Divider(),
      const LegalLinks(),
    ],
  );

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
      final body = validateDriverToday(await api.get('driver/today/'));
      if (!current(ticket)) return;
      setState(() {
        today = body;
        needsReload = false;
        transitionUncertain = false;
      });
    } on AuthFailure catch (failure) {
      if (!current(ticket)) return;
      if (failure.code == 'not_authenticated') {
        widget.auth.expire();
        return;
      }
      setState(() => error = loadFailureMessage(failure, 'tu día'));
    } catch (cause) {
      if (current(ticket)) {
        setState(() => error = loadFailureMessage(cause, 'tu día'));
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
      final body = validateDriverToday(await api.get('driver/today/'));
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
      transitionUncertain = !confirmed;
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
    if (!active || widget.auth.usesSyntheticData) return;
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
    child: Text(text, style: Theme.of(context).textTheme.titleLarge),
  );

  Widget _surface({required Widget child}) => Padding(
    padding: const EdgeInsets.only(top: FurgoLayout.space4),
    child: FurgoOperationalPanel(child: child),
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
    final statusColor = transitionUncertain
        ? FurgoColors.warning
        : switch (state) {
            'in_progress' => FurgoColors.blue,
            'completed' => FurgoColors.success,
            _ => FurgoColors.muted,
          };
    return FurgoOperationalPanel(
      key: ValueKey('today-route-${route['route_id']}'),
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: FurgoColors.blueSoft,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Recorrido seleccionado',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: FurgoLayout.space2),
                Semantics(
                  liveRegion: true,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ExcludeSemantics(
                        child: Icon(icon, color: statusColor, size: 22),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          transitionUncertain
                              ? 'Estado por confirmar'
                              : _state(state),
                          key: const Key('daily-state'),
                          style: Theme.of(
                            context,
                          ).textTheme.titleSmall?.copyWith(color: statusColor),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  '${route['start_time']} → ${route['end_time']}',
                  style: Theme.of(
                    context,
                  ).textTheme.headlineMedium?.copyWith(color: FurgoColors.blue),
                ),
                const SizedBox(height: 8),
                Semantics(
                  header: true,
                  child: Text(
                    route['label'] as String,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
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
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _capacity(route, key: const Key('driver-capacity')),
                const SizedBox(height: 8),
                TextButton.icon(
                  key: const Key('journey-details'),
                  onPressed: () => _openJourney('details'),
                  label: const Text('Información del recorrido'),
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _destination(Map<String, dynamic> route) {
    final address = route['destination_address'] as String;
    return Column(
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
                  Text('Destino', style: Theme.of(context).textTheme.bodySmall),
                  Text(
                    route['destination_label'] as String,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (address.trim().isNotEmpty)
                    Text(address, style: Theme.of(context).textTheme.bodySmall),
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
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            onPressed: widget.auth.usesSyntheticData
                ? null
                : () => _openMaps(address),
            icon: const Icon(Icons.near_me_outlined, size: 20),
            label: const Text('Abrir en mapas'),
          ),
        ],
        if (widget.auth.usesSyntheticData)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: FurgoMessage(
              'Ubicación ficticia. Mapas no está disponible para datos de ensayo.',
            ),
          ),
        if (mapError != null)
          Semantics(
            liveRegion: true,
            child: Text(
              mapError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
      ],
    );
  }

  Widget _otherRoutes(
    List<Map<String, dynamic>> routes,
    Map<String, dynamic> focus,
  ) => ExpansionTile(
    key: const Key('other-routes'),
    tilePadding: EdgeInsets.zero,
    title: Text(
      'Otras rutas de hoy · ${routes.length - 1}',
      style: Theme.of(context).textTheme.titleMedium,
    ),
    children: [
      for (final route in routes)
        if (route['route_id'] != focus['route_id'])
          ListTile(
            key: ValueKey('select-route-${route['route_id']}'),
            contentPadding: EdgeInsets.zero,
            title: Text(route['label'] as String),
            subtitle: Text(
              '${route['start_time']}–${route['end_time']} · ${_state(_runState(route))}\n${route['available_seats']} ${route['available_seats'] == 1 ? 'cupo disponible' : 'cupos disponibles'} · ${route['used_seats']} ${route['used_seats'] == 1 ? 'ocupado' : 'ocupados'}',
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
  );

  Widget _unfinished(List<Map<String, dynamic>> runs) => ExpansionTile(
    key: const Key('unfinished-runs'),
    tilePadding: EdgeInsets.zero,
    leading: const ExcludeSemantics(
      child: Icon(Icons.pending_actions, color: FurgoColors.warning),
    ),
    title: Text(
      'Rutas anteriores sin completar · ${runs.length}',
      style: Theme.of(context).textTheme.titleMedium,
    ),
    children: [
      for (final run in runs)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('${run['label']} · ${_date(run['service_date'] as String)}'),
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
  );

  @override
  Widget build(BuildContext context) {
    if (!active) return const SizedBox.shrink();
    final accountSession = sessionVersion;
    final journeyVisible = destination == 0 && journeyPage != null;
    final routes = _rows('routes');
    final unfinished = _rows('unfinished_runs');
    final focus = _focus(routes);
    final passengerCount = focus == null
        ? null
        : (focus['roster'] as List).length;
    return PopScope(
      canPop:
          (!accountOpen && !journeyVisible) ||
          LegalScope.documentOpenOf(context),
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !LegalScope.documentOpenOf(context)) {
          if (accountOpen) {
            setState(() => accountOpen = false);
          } else if (journeyVisible) {
            _openJourney(journeyPage == 'passengers' ? passengerOrigin : null);
          }
        }
      },
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: 32 + MediaQuery.textScalerOf(context).scale(24),
          leading: accountOpen || journeyVisible
              ? IconButton(
                  key: const Key('journey-back'),
                  tooltip: accountOpen
                      ? 'Volver'
                      : journeyPage == 'passengers' &&
                            passengerOrigin == 'details'
                      ? 'Volver al recorrido'
                      : 'Volver a Hoy',
                  onPressed: () {
                    if (accountOpen) {
                      setState(() => accountOpen = false);
                    } else {
                      _openJourney(
                        journeyPage == 'passengers' ? passengerOrigin : null,
                      );
                    }
                  },
                  icon: const Icon(Icons.arrow_back),
                )
              : null,
          title: accountOpen || journeyVisible
              ? Text(
                  accountOpen
                      ? 'Mi cuenta'
                      : journeyPage == 'details'
                      ? 'Tu recorrido'
                      : 'Pasajeros',
                  style: Theme.of(context).textTheme.titleMedium,
                )
              : Image.asset(
                  'assets/furgoplus-logo.png',
                  width: 136,
                  height: 36,
                  fit: BoxFit.contain,
                  semanticLabel: 'FurgoPlus Transporte Escolar',
                ),
          actions: [
            if (!accountOpen) ...[
              if (journeyVisible ||
                  MediaQuery.textScalerOf(context).scale(16) > 24)
                IconButton(
                  key: const Key('open-driver-account'),
                  tooltip: 'Cuenta',
                  onPressed: () {
                    if (!active ||
                        accountSession != sessionVersion ||
                        confirmation != null)
                      return;
                    FocusManager.instance.primaryFocus?.unfocus();
                    setState(() => accountOpen = !accountOpen);
                  },
                  icon: const Icon(Icons.account_circle_outlined),
                )
              else
                TextButton.icon(
                  key: const Key('open-driver-account'),
                  onPressed: () {
                    if (!active ||
                        accountSession != sessionVersion ||
                        confirmation != null)
                      return;
                    FocusManager.instance.primaryFocus?.unfocus();
                    setState(() => accountOpen = !accountOpen);
                  },
                  icon: const Icon(Icons.account_circle_outlined),
                  label: const Text('Cuenta'),
                ),
            ],
          ],
        ),
        bottomNavigationBar: Padding(
          // Keep the primary destinations above the keyboard in support forms.
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: NavigationBar(
            height: 56 + MediaQuery.textScalerOf(context).scale(20),
            selectedIndex: destination,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            onDestinationSelected: _selectDestination,
            destinations: const [
              NavigationDestination(
                key: Key('driver-nav-today'),
                icon: Icon(Icons.today_outlined),
                selectedIcon: Icon(Icons.today),
                label: 'Hoy',
              ),
              NavigationDestination(
                key: Key('driver-nav-plan'),
                icon: Icon(Icons.workspace_premium_outlined),
                selectedIcon: Icon(Icons.workspace_premium),
                label: 'Mi plan',
              ),
              NavigationDestination(
                key: Key('driver-nav-help'),
                icon: Icon(Icons.help_outline),
                selectedIcon: Icon(Icons.help),
                label: 'Ayuda',
              ),
            ],
          ),
        ),
        body: Stack(
          fit: StackFit.expand,
          children: [
            Offstage(
              offstage: accountOpen,
              child: FocusScope(
                canRequestFocus: !accountOpen,
                descendantsAreFocusable: !accountOpen,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Offstage(
                      offstage: destination != 0,
                      child: TickerMode(
                        enabled: destination == 0 && !accountOpen,
                        child: SafeArea(
                          top: false,
                          child: Align(
                            alignment: Alignment.topCenter,
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(
                                maxWidth: FurgoLayout.contentWidth,
                              ),
                              child: SingleChildScrollView(
                                controller: scroll,
                                padding: const EdgeInsets.fromLTRB(
                                  16,
                                  8,
                                  16,
                                  24,
                                ),
                                child: journeyPage != null && focus != null
                                    ? journeyPage == 'details'
                                          ? _journeyDetails(focus)
                                          : _journeyPassengers(focus)
                                    : Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          Row(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Semantics(
                                                      header: true,
                                                      child: Text(
                                                        'Hoy',
                                                        style: Theme.of(context)
                                                            .textTheme
                                                            .headlineMedium,
                                                      ),
                                                    ),
                                                    Text(
                                                      today == null
                                                          ? 'Tu jornada de transporte'
                                                          : _date(
                                                              today!['service_date']
                                                                  as String,
                                                              natural: true,
                                                            ),
                                                      style: Theme.of(
                                                        context,
                                                      ).textTheme.bodySmall,
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              IconButton(
                                                key: const Key('reload-today'),
                                                tooltip: 'Actualizar día',
                                                constraints:
                                                    const BoxConstraints(
                                                      minWidth: 48,
                                                      minHeight: 48,
                                                    ),
                                                onPressed:
                                                    loading ||
                                                        confirmation != null
                                                    ? null
                                                    : _refresh,
                                                icon: const Icon(Icons.refresh),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 16),
                                          if (widget
                                              .auth
                                              .usesSyntheticData) ...[
                                            const FurgoSyntheticNotice(
                                              key: Key('synthetic-data-notice'),
                                            ),
                                            const SizedBox(height: 16),
                                          ],
                                          if (loading) ...[
                                            const LinearProgressIndicator(
                                              semanticsLabel:
                                                  'Consultando tu día',
                                            ),
                                            const SizedBox(height: 12),
                                          ],
                                          if (error != null) ...[
                                            Semantics(
                                              liveRegion: true,
                                              child: Container(
                                                key: const Key('driver-error'),
                                                padding: const EdgeInsets.all(
                                                  16,
                                                ),
                                                margin: const EdgeInsets.only(
                                                  bottom: 16,
                                                ),
                                                decoration: BoxDecoration(
                                                  color:
                                                      FurgoColors.warningSoft,
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                        FurgoLayout.panelRadius,
                                                      ),
                                                ),
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment
                                                          .stretch,
                                                  children: [
                                                    if (today == null)
                                                      _heading(
                                                        'No pudimos cargar tu día',
                                                      ),
                                                    Text(
                                                      error!,
                                                      style: const TextStyle(
                                                        color:
                                                            FurgoColors.warning,
                                                        fontSize: 16,
                                                      ),
                                                    ),
                                                    TextButton(
                                                      onPressed: loading
                                                          ? null
                                                          : _refresh,
                                                      child: const Text(
                                                        'Actualizar estado',
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ],
                                          if (focus != null) ...[
                                            _hero(focus),
                                            if (unfinished.isNotEmpty)
                                              _surface(
                                                child: _unfinished(unfinished),
                                              ),
                                            _surface(
                                              child: FurgoTaskRow(
                                                key: const Key(
                                                  'journey-passengers',
                                                ),
                                                icon: Icons.people_outline,
                                                title:
                                                    'Pasajeros del recorrido',
                                                subtitle:
                                                    '${passengerCount} ${passengerCount == 1 ? 'pasajero asignado' : 'pasajeros asignados'}',
                                                onTap: () =>
                                                    _openJourney('passengers'),
                                              ),
                                            ),
                                            if (routes.length > 1)
                                              _surface(
                                                child: _otherRoutes(
                                                  routes,
                                                  focus,
                                                ),
                                              ),
                                          ] else if (today != null) ...[
                                            _surface(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Row(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      const ExcludeSemantics(
                                                        child: Icon(
                                                          Icons
                                                              .event_available_outlined,
                                                          color:
                                                              FurgoColors.blue,
                                                        ),
                                                      ),
                                                      const SizedBox(width: 12),
                                                      Expanded(
                                                        child: _heading(
                                                          'Sin servicio para hoy',
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                  const SizedBox(height: 8),
                                                  const Text(
                                                    'Aquí verás tus recorridos cuando estén programados.',
                                                  ),
                                                  const SizedBox(height: 16),
                                                  FilledButton.icon(
                                                    onPressed: () =>
                                                        _selectDestination(2),
                                                    icon: const Icon(
                                                      Icons.menu_book_outlined,
                                                    ),
                                                    label: const Text(
                                                      'Consultar guías',
                                                    ),
                                                  ),
                                                  ExpansionTile(
                                                    tilePadding:
                                                        EdgeInsets.zero,
                                                    title: const Text(
                                                      '¿Esperabas un recorrido?',
                                                    ),
                                                    children: [
                                                      const Text(
                                                        'Revisa tus rutas y horarios en la web. Luego actualiza tu día.',
                                                      ),
                                                      TextButton(
                                                        onPressed: loading
                                                            ? null
                                                            : _refresh,
                                                        child: const Text(
                                                          'Actualizar día',
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                            if (unfinished.isNotEmpty)
                                              _surface(
                                                child: _unfinished(unfinished),
                                              ),
                                          ] else if (loading)
                                            Semantics(
                                              liveRegion: true,
                                              child: const Text(
                                                'Consultando tus servicios…',
                                              ),
                                            ),
                                        ],
                                      ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    for (final target in [1, 2])
                      if (visitedDestinations.contains(target))
                        Offstage(
                          key: ValueKey(
                            'driver-destination-$sessionVersion-$target',
                          ),
                          offstage: destination != target,
                          child: TickerMode(
                            enabled: destination == target && !accountOpen,
                            child: FocusScope(
                              canRequestFocus:
                                  destination == target && !accountOpen,
                              descendantsAreFocusable:
                                  destination == target && !accountOpen,
                              child: PlanHelpScreen(
                                key: ValueKey(
                                  'driver-help-$sessionVersion-$target',
                                ),
                                auth: widget.auth,
                                showPlan: target == 1,
                                embedded: true,
                                handleBack:
                                    !accountOpen && destination == target,
                                activePage:
                                    !accountOpen && destination == target,
                                close: () => _selectDestination(0),
                              ),
                            ),
                          ),
                        ),
                  ],
                ),
              ),
            ),
            if (accountOpen)
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: _account(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// Validate fields consumed by the widget before committing a read. A malformed
// response is an application/protocol error, never an empty day or a network claim.
Map<String, dynamic> validateDriverToday(Map<String, dynamic> body) {
  Never invalid() => throw const FormatException('Invalid Today response');
  List<Map<String, dynamic>> rows(Object? value) {
    if (value is! List || value.any((row) => row is! Map<String, dynamic>))
      invalid();
    return value.cast<Map<String, dynamic>>();
  }

  void strings(Map<String, dynamic> row, List<String> keys) {
    if (keys.any((key) => row[key] is! String)) invalid();
  }

  void run(Object? value) {
    if (value is! Map<String, dynamic> ||
        value['id'] is! int ||
        value['state'] is! String)
      invalid();
  }

  strings(body, ['service_date']);
  if (DateTime.tryParse(body['service_date'] as String) == null) invalid();
  for (final route in rows(body['routes'])) {
    strings(route, [
      'label',
      'start_time',
      'end_time',
      'destination_label',
      'destination_address',
    ]);
    for (final key in [
      'route_id',
      'seat_capacity',
      'used_seats',
      'available_seats',
    ]) {
      if (route[key] is! int) invalid();
    }
    for (final passenger in rows(route['roster'])) {
      strings(passenger, [
        'student_display_name',
        'pickup_instruction',
        'guardian_display_name',
        'guardian_contact',
      ]);
    }
    if (route['run'] != null) run(route['run']);
  }
  for (final previous in rows(body['unfinished_runs'])) {
    run(previous);
    strings(previous, ['label', 'service_date', 'start_time', 'end_time']);
  }
  return body;
}

// Native roster navigation is limited to the selected day's route. Identity and
// route changes remount it through the existing keyed private-data boundary.
class DriverTodayPassengers extends StatefulWidget {
  const DriverTodayPassengers({super.key, required this.route});
  final Map<String, dynamic> route;
  @override
  State<DriverTodayPassengers> createState() => _DriverTodayPassengersState();
}

class _DriverTodayPassengersState extends State<DriverTodayPassengers> {
  String query = '';
  final search = TextEditingController();
  int page = 1;

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  String _search(String value) {
    var normalized = value.toLowerCase().trim();
    const accents = {
      'á': 'a',
      'é': 'e',
      'í': 'i',
      'ó': 'o',
      'ú': 'u',
      'ü': 'u',
      'ñ': 'n',
    };
    accents.forEach((from, to) => normalized = normalized.replaceAll(from, to));
    return normalized;
  }

  @override
  void didUpdateWidget(DriverTodayPassengers oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.route['route_id'] != widget.route['route_id']) {
      query = '';
      search.clear();
      page = 1;
    }
  }

  @override
  Widget build(BuildContext context) {
    final route = widget.route;
    final all = (route['roster'] as List).cast<Map<String, dynamic>>();
    final roster = all
        .where(
          (row) => _search(
            '${row['student_display_name']} ${row['guardian_display_name']}',
          ).contains(_search(query)),
        )
        .toList();
    final pages = (roster.length / 10).ceil().clamp(1, 1000000);
    final currentPage = page.clamp(1, pages);
    final start = (currentPage - 1) * 10;
    final end = (start + 10).clamp(0, roster.length);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FurgoSurface(
          padding: const EdgeInsets.all(16),
          child: FurgoCapacity(
            key: const Key('driver-capacity'),
            used: route['used_seats'] as int,
            total: route['seat_capacity'] as int,
            available: route['available_seats'] as int,
          ),
        ),
        const SizedBox(height: 12),
        ExcludeSemantics(
          child: Text(
            'Buscar pasajero o apoderado',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        const SizedBox(height: 8),
        Semantics(
          label: 'Buscar pasajero o apoderado en esta ruta',
          child: TextField(
            key: ValueKey('roster-search-${route['route_id']}'),
            controller: search,
            decoration: InputDecoration(
              hintText: 'Nombre o apoderado',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: query.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Limpiar búsqueda',
                      icon: const Icon(Icons.close),
                      onPressed: () => setState(() {
                        search.clear();
                        query = '';
                        page = 1;
                      }),
                    ),
            ),
            onChanged: (value) => setState(() {
              query = value;
              page = 1;
            }),
          ),
        ),
        const SizedBox(height: 12),
        if (roster.isEmpty)
          Text(
            all.isEmpty
                ? 'Sin pasajeros asignados para hoy.'
                : 'Sin coincidencias en esta ruta.',
          )
        else
          FurgoSurface(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Theme(
              key: ValueKey('$query-$currentPage'),
              data: Theme.of(
                context,
              ).copyWith(dividerColor: Colors.transparent),
              child: Column(
                children: [
                  for (var i = start; i < end; i++) ...[
                    if (i > 0)
                      const Divider(height: 1, color: FurgoColors.divider),
                    ExpansionTile(
                      leading: const ExcludeSemantics(
                        child: CircleAvatar(
                          backgroundColor: FurgoColors.blueSoft,
                          foregroundColor: FurgoColors.blue,
                          child: Icon(Icons.person_outline),
                        ),
                      ),
                      key: ValueKey('passenger-${route['route_id']}-$i'),
                      tilePadding: EdgeInsets.zero,
                      childrenPadding: const EdgeInsets.only(bottom: 12),
                      minTileHeight: 64,
                      title: Text(
                        roster[i]['student_display_name'] as String,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const ExcludeSemantics(
                              child: Icon(
                                Icons.place_outlined,
                                size: 18,
                                color: FurgoColors.muted,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                roster[i]['pickup_instruction'] as String,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                          ],
                        ),
                      ),
                      children: [
                        FurgoSurface(
                          emphasis: true,
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const ExcludeSemantics(
                                child: Icon(
                                  Icons.contact_phone_outlined,
                                  color: FurgoColors.blue,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Contacto del apoderado',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      roster[i]['guardian_display_name']
                                          as String,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleSmall,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      roster[i]['guardian_contact'] as String,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        if (query.isNotEmpty || pages > 1) ...[
          const SizedBox(height: 12),
          Semantics(
            liveRegion: true,
            child: Text(
              pages > 1
                  ? '${start + 1}–$end de ${roster.length} · Página $currentPage de $pages'
                  : '${roster.length} ${roster.length == 1 ? 'resultado' : 'resultados'}',
            ),
          ),
        ],
        if (pages > 1)
          Wrap(
            spacing: 12,
            children: [
              OutlinedButton(
                onPressed: currentPage > 1
                    ? () => setState(() => page = currentPage - 1)
                    : null,
                child: const Text('Anterior'),
              ),
              OutlinedButton(
                onPressed: currentPage < pages
                    ? () => setState(() => page = currentPage + 1)
                    : null,
                child: const Text('Siguiente'),
              ),
            ],
          ),
      ],
    );
  }
}
