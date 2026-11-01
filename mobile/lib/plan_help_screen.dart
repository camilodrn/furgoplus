import 'dart:async';

import 'package:flutter/material.dart';

import 'auth_controller.dart';
import 'furgo_theme.dart';
import 'furgo_widgets.dart';
import 'legal_access.dart';
import 'plan_help_service.dart';
import 'session_api.dart';

enum HelpPage { overview, guides, article, tickets, detail, create, assistant }

class PlanHelpScreen extends StatefulWidget {
  const PlanHelpScreen({
    super.key,
    required this.auth,
    required this.close,
    this.showPlan = false,
    this.embedded = false,
    this.handleBack = true,
    this.activePage = true,
  });
  final AuthController auth;
  final VoidCallback close;
  final bool showPlan;
  final bool embedded;
  final bool handleBack;
  final bool activePage;

  @override
  State<PlanHelpScreen> createState() => _PlanHelpScreenState();
}

class _PlanHelpScreenState extends State<PlanHelpScreen>
    with WidgetsBindingObserver {
  late final int session = widget.auth.sessionVersion;
  late final AuthState role = widget.auth.state;
  late final service = PlanHelpService(widget.auth.api);
  HelpPage page = HelpPage.overview;
  Map<String, dynamic>? caps, help, detail, article, answer;
  List<Map<String, dynamic>> tickets = [];
  bool busy = false, consent = false, uncertain = false;
  bool ticketsAuthorized = false;
  bool sending = false;
  bool foreground = true;
  String? error, feedback, category;
  String mode = 'faq';
  int operation = 0, offset = 0, count = 0, severity = 3;
  Timer? timer;
  Timer? expiry;
  final subject = TextEditingController();
  final body = TextEditingController();
  final question = TextEditingController();
  final guideSearch = TextEditingController();
  final scroll = ScrollController();

  bool get active =>
      mounted &&
      widget.auth.sessionVersion == session &&
      widget.auth.state == role &&
      (role == AuthState.driver || role == AuthState.parent);
  bool current(int ticket) => active && operation == ticket;
  List<String> get modes => [
    if (role == AuthState.driver)
      for (final m in ['faq', 'contextual'])
        if ((help?['assistant_modes'] as List? ?? []).contains(m) &&
            capabilityEnabled(caps, 'assistant.$m'))
          m,
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.auth.addListener(_sessionChanged);
    _refresh();
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (active && widget.activePage && !busy) _refresh();
    });
  }

  @override
  void didUpdateWidget(PlanHelpScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.activePage && !oldWidget.activePage && active && !busy)
      _refresh();
  }

  void _sessionChanged() {
    if (active) return;
    operation++;
    timer?.cancel();
    expiry?.cancel();
    setState(() {
      caps = help = detail = article = answer = null;
      tickets = [];
      subject.clear();
      body.clear();
      question.clear();
      guideSearch.clear();
      category = null;
      consent = ticketsAuthorized = false;
      error = feedback = null;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!active || !widget.activePage) return;
    foreground = state == AppLifecycleState.resumed;
    if (!foreground) {
      // Hide stale permissions/context immediately when leaving the app.
      operation++;
      setState(() {
        if (sending) uncertain = true;
        sending = false;
        caps = help = answer = null;
        busy = false;
      });
    } else {
      _refresh();
    }
  }

  @override
  void dispose() {
    operation++;
    timer?.cancel();
    expiry?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    widget.auth.removeListener(_sessionChanged);
    subject.dispose();
    body.dispose();
    question.dispose();
    guideSearch.dispose();
    scroll.dispose();
    super.dispose();
  }

  void _go(HelpPage next) {
    if (busy || !active) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      page = next;
      error = feedback = null;
      answer = null;
      subject.clear();
      body.clear();
      question.clear();
      consent = uncertain = false;
      if (next == HelpPage.create) severity = 3;
    });
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  void _back() {
    if (busy) return;
    switch (page) {
      case HelpPage.overview:
        widget.close();
      case HelpPage.article:
        _go(HelpPage.guides);
      case HelpPage.detail:
      case HelpPage.create:
        _go(HelpPage.tickets);
        _loadTickets();
      default:
        _go(HelpPage.overview);
    }
  }

  Future<void> _refresh() async {
    if (!active || busy || !foreground) return;
    final ticket = ++operation;
    setState(() {
      busy = true;
      error = null;
      caps = help = answer = null;
    });
    try {
      // Sequential reads share the same authenticated session generation.
      final newCaps = role == AuthState.driver
          ? await service.capabilities()
          : null;
      if (!current(ticket)) return;
      final newHelp = widget.showPlan ? null : await service.help();
      if (!current(ticket)) return;
      setState(() {
        caps = newCaps;
        help = newHelp;
        if (!modes.contains(mode)) mode = modes.firstOrNull ?? 'faq';
        if (role == AuthState.driver &&
            !capabilityEnabled(caps, 'support.requests')) {
          ticketsAuthorized = false;
          tickets = [];
          detail = null;
          body.clear();
          subject.clear();
          consent = false;
        }
      });
      expiry?.cancel();
      final end = DateTime.tryParse(caps?['subscription']?['ends_at'] ?? '');
      final evaluated = DateTime.tryParse(caps?['evaluated_at'] ?? '');
      if (end != null && evaluated != null && end.isAfter(evaluated)) {
        expiry = Timer(end.difference(evaluated), () {
          if (active) {
            // Recheck with the server; the device clock never grants a benefit.
            if (busy) {
              setState(() => caps = answer = null);
            } else {
              _refresh();
            }
          }
        });
      }
    } catch (failure) {
      if (current(ticket)) {
        setState(() {
          caps = help = answer = detail = null;
          tickets = [];
          ticketsAuthorized = false;
        });
        _failure(failure);
      }
    } finally {
      if (current(ticket)) setState(() => busy = false);
    }
  }

  void _failure(Object failure, {bool writing = false}) {
    if (failure is AuthFailure && failure.code == 'not_authenticated') {
      widget.auth.expire();
      return;
    }
    if (failure is AuthFailure && failure.code == 'stale_request') return;
    setState(() {
      if (failure is AuthFailure) {
        error = switch (failure.status) {
          403 =>
            failure.code == 'csrf_failed'
                ? 'La verificación caducó. Revisa el estado antes de repetir el envío.'
                : 'Tu cuenta no tiene permiso para esta función. Actualiza los permisos.',
          404 =>
            'Esta consulta o recurso ya no está disponible para tu cuenta.',
          409 =>
            'La consulta cambió. Actualiza el historial antes de responder.',
          429 =>
            'Alcanzaste el límite de consultas o envíos. Espera un momento.',
          400 =>
            'Revisa el texto: sin enlaces, correos, datos personales ni archivos. Respeta los límites indicados. Si tienes diez consultas activas, continúa en una existente.',
          _ => 'No pudimos completar la acción. Actualiza el estado.',
        };
        if (failure.status == 403 && failure.code != 'csrf_failed') {
          caps = help = answer = detail = null;
          tickets = [];
          ticketsAuthorized = false;
          body.clear();
          subject.clear();
          question.clear();
          consent = false;
        }
        if (failure.status == 404) detail = null;
        if (failure.status == 409) uncertain = true;
        if (writing && failure.status >= 500) uncertain = true;
      } else {
        error = writing
            ? 'Se perdió la conexión y no pudimos confirmar el envío. Consulta tus consultas antes de volver a escribir.'
            : 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';
        if (writing) uncertain = true;
      }
    });
    FocusManager.instance.primaryFocus?.unfocus();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (active && error != null && scroll.hasClients) scroll.jumpTo(0);
    });
  }

  Future<void> _loadTickets({int start = 0}) async {
    if (!active || busy) return;
    final ticket = ++operation;
    setState(() {
      busy = true;
      error = feedback = null;
      ticketsAuthorized = false;
      tickets = [];
      detail = null;
    });
    try {
      final result = await service.tickets(start);
      if (!current(ticket)) return;
      setState(() {
        tickets = List<Map<String, dynamic>>.from(result['results']);
        offset = start;
        count = result['count'] as int;
        ticketsAuthorized = true;
      });
    } catch (failure) {
      if (current(ticket)) _failure(failure);
    } finally {
      if (current(ticket)) setState(() => busy = false);
    }
  }

  Future<void> _loadDetail(int id) async {
    if (!active || busy) return;
    final ticket = ++operation;
    setState(() {
      busy = true;
      error = feedback = null;
      detail = null;
      consent = false;
      body.clear();
    });
    try {
      final result = await service.ticket(id);
      if (!current(ticket)) return;
      setState(() {
        detail = result;
        uncertain = false;
      });
    } catch (failure) {
      if (current(ticket)) _failure(failure);
    } finally {
      if (current(ticket)) setState(() => busy = false);
    }
  }

  Future<void> _send({bool replying = false}) async {
    if (!active || busy || !consent || uncertain || body.text.trim().isEmpty) {
      return;
    }
    if (!replying && (!ticketsAuthorized || subject.text.trim().isEmpty))
      return;
    FocusManager.instance.primaryFocus?.unfocus();
    final ticket = ++operation;
    setState(() {
      busy = true;
      sending = true;
      error = feedback = null;
      consent = false;
    });
    try {
      final result = replying
          ? await service.reply(detail!['id'], detail!['version'], body.text)
          : await service.create(subject.text, body.text, severity);
      if (!current(ticket)) return;
      setState(() {
        detail = result;
        page = HelpPage.detail;
        body.clear();
        subject.clear();
        feedback = replying ? 'Respuesta enviada.' : 'Consulta enviada.';
        uncertain = false;
      });
      if (scroll.hasClients) scroll.jumpTo(0);
    } catch (failure) {
      if (current(ticket)) _failure(failure, writing: true);
    } finally {
      if (current(ticket))
        setState(() {
          busy = false;
          sending = false;
        });
    }
  }

  Future<void> _ask() async {
    if (!active ||
        busy ||
        !modes.contains(mode) ||
        question.text.trim().isEmpty) {
      return;
    }
    final ticket = ++operation;
    setState(() {
      busy = true;
      answer = null;
      error = null;
    });
    try {
      final result = await service.ask(question.text, mode);
      if (!current(ticket) || !modes.contains(mode)) return;
      setState(() {
        answer = result;
        question.clear();
      });
    } catch (failure) {
      if (current(ticket)) _failure(failure);
    } finally {
      if (current(ticket)) setState(() => busy = false);
    }
  }

  Widget _heading(String text) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Semantics(
            header: true,
            child: Text(
              text.startsWith('Ayuda para ') &&
                      MediaQuery.textScalerOf(context).scale(1) > 1.3
                  ? 'Ayuda'
                  : text,
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
        ),
        if (widget.embedded && page == HelpPage.overview)
          IconButton(
            tooltip: 'Actualizar información',
            onPressed: busy ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
      ],
    ),
  );

  Widget _notice(String text) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: FurgoMessage(text, error: text == error, success: text == feedback),
  );

  Widget _action(String label, VoidCallback? action, {bool primary = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: primary
            ? FilledButton(onPressed: busy ? null : action, child: Text(label))
            : OutlinedButton(
                onPressed: busy ? null : action,
                child: Text(label),
              ),
      );

  String _planDate(Object? raw) {
    final date = raw is String ? DateTime.tryParse(raw)?.toLocal() : null;
    if (date == null) return 'Sin fecha confirmada';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  List<Widget> _plan() {
    if (caps == null) return [];
    final plan = caps!['plan'] as Map?;
    final subscription = caps!['subscription'] as Map?;
    final blockers = caps!['blockers'] as List? ?? [];
    final effective = subscription?['effective'] == true;
    final available = effective && !blockers.contains('driver_unavailable');
    final status = plan == null
        ? 'Sin plan asignado'
        : blockers.contains('subscription_suspended')
        ? 'Suspendido'
        : blockers.contains('subscription_expired')
        ? 'Vencido'
        : blockers.contains('subscription_not_started')
        ? 'Aún no comienza'
        : blockers.contains('subscription_inactive')
        ? 'Inactivo'
        : blockers.contains('driver_unavailable')
        ? 'Perfil por revisar'
        : available
        ? 'Vigente'
        : 'Por revisar';
    bool enabled(String code) => capabilityEnabled(caps, code);
    final benefits = <String>[
      if (enabled('operations.core') || enabled('dashboard.basic'))
        'Gestión de tus servicios y recorridos',
      if (enabled('help.center') && enabled('support.requests'))
        'Guías y consultas de soporte'
      else ...[
        if (enabled('help.center')) 'Guías de ayuda',
        if (enabled('support.requests')) 'Solicitudes de soporte',
      ],
      if (enabled('assistant.contextual'))
        'Asistente con información de tu cuenta'
      else if (enabled('assistant.faq'))
        'Asistente para tus preguntas',
      if (enabled('reports.detail.read'))
        'Reportes detallados en la web'
      else if (enabled('reports.monthly.read'))
        'Reportes mensuales en la web',
      if (enabled('analytics.period_comparison') &&
          enabled('reports.xlsx.export'))
        'Comparación mensual y Excel en la web'
      else ...[
        if (enabled('analytics.period_comparison'))
          'Comparación mensual en la web',
        if (enabled('reports.xlsx.export')) 'Descargas Excel en la web',
      ],
    ];
    return [
      _heading('Mi plan'),
      const SizedBox(height: 8),
      FurgoSurface(
        emphasis: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Align(
              alignment: Alignment.centerLeft,
              child: ExcludeSemantics(
                child: Icon(
                  Icons.workspace_premium_outlined,
                  color: FurgoColors.blue,
                  size: 32,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Semantics(
              header: true,
              child: Text(
                plan != null
                    ? 'Plan ${plan['label']}'
                    : subscription == null
                    ? 'Sin plan asignado'
                    : 'Plan por confirmar',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ),
            const SizedBox(height: 12),
            if (plan != null) FurgoStatus(status, active: available),
            if (subscription != null) ...[
              const SizedBox(height: 16),
              FurgoFact('Vencimiento', _planDate(subscription['ends_at'])),
            ],
            if (!available && blockers.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(planRestriction(blockers.first)),
            ],
          ],
        ),
      ),
      const SizedBox(height: 24),
      Semantics(
        header: true,
        child: Text(
          'Disponible con tu cuenta',
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ),
      const SizedBox(height: 8),
      if (benefits.isEmpty)
        const Text('Consulta Ayuda para revisar el acceso de tu cuenta.'),
      for (final benefit in benefits.take(3))
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.check, size: 20, color: FurgoColors.blue),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(benefit)),
            ],
          ),
        ),
      if (benefits.length > 3)
        ExpansionTile(
          title: const Text('Más beneficios'),
          children: [
            for (final benefit in benefits.skip(3))
              FurgoFact('Incluido', benefit),
          ],
        ),
      const SizedBox(height: 16),
      const Divider(),
      ExpansionTile(
        title: const Text('Detalles del plan'),
        children: [
          Text(
            'Prioridad de atención: ${supportPriority(available ? (plan?['support_priority']) : 'standard')}. La gravedad del problema se considera primero.',
          ),
          const SizedBox(height: 12),
          const Text(
            'Los cambios de plan se gestionan en la web. La app no realiza cobros ni renovaciones.',
          ),
          const SizedBox(height: 12),
          Text('Inicio: ${helpDate(subscription?['starts_at'])}'),
          const SizedBox(height: 12),
          Text(
            'Última consulta: ${helpDate(caps!['evaluated_at'])}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Text('Las fechas se muestran en la hora del dispositivo.'),
          for (final reason in blockers.skip(1)) Text(planRestriction(reason)),
        ],
      ),
    ];
  }

  Widget _helpAccess(
    IconData icon,
    String title,
    String description,
    VoidCallback action,
  ) => LayoutBuilder(
    builder: (context, constraints) {
      final stacked =
          constraints.maxWidth / MediaQuery.textScalerOf(context).scale(1) <
          220;
      return ListTile(
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        leading: stacked ? null : ExcludeSemantics(child: Icon(icon, size: 28)),
        title: Text(title, style: Theme.of(context).textTheme.titleMedium),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(description),
        ),
        trailing: stacked ? null : const Icon(Icons.chevron_right),
        onTap: busy ? null : action,
      );
    },
  );

  List<Widget> _overview() => [
    if (widget.showPlan)
      ..._plan()
    else ...[
      _heading(
        'Ayuda para ${role == AuthState.driver ? 'conductores' : 'apoderados'}',
      ),
      Text(
        '¿En qué te ayudamos?',
        style: Theme.of(context).textTheme.bodyLarge,
      ),
      const SizedBox(height: 16),
      FurgoSurface(
        child: Column(
          children: [
            _helpAccess(
              Icons.menu_book_outlined,
              'Guías por tema',
              'Aprende a usar FurgoPlus.',
              () => _go(HelpPage.guides),
            ),
            const Divider(height: 1),
            _helpAccess(
              Icons.forum_outlined,
              'Consultas de soporte',
              'Pide ayuda o revisa una respuesta.',
              () {
                _go(HelpPage.tickets);
                _loadTickets();
              },
            ),
            if (modes.isNotEmpty) ...[
              const Divider(height: 1),
              _helpAccess(
                Icons.chat_bubble_outline,
                'Asistente automático',
                'Respuestas basadas en las guías.',
                () => _go(HelpPage.assistant),
              ),
            ],
          ],
        ),
      ),
      const SizedBox(height: 16),
      if (help != null)
        ExpansionTile(
          title: const Text('Disponibilidad y privacidad'),
          children: [
            Text(help!['service_notice']),
            const SizedBox(height: 12),
            Text(help!['privacy_notice']),
          ],
        ),
    ],
  ];

  List<Map<String, dynamic>> get articles => [
    for (final a in help?['articles'] as List? ?? [])
      if (a['role'] == 'all' ||
          a['role'] == (role == AuthState.driver ? 'driver' : 'parent'))
        {
          ...Map<String, dynamic>.from(a),
          'body': (a['body'] as String)
              .replaceAll('En esta web', 'En esta app')
              .replaceAll('tickets de soporte', 'consultas de soporte'),
        },
  ];

  String _guideText(String text) {
    var value = text.toLowerCase().trim();
    const accents = {
      'á': 'a',
      'é': 'e',
      'í': 'i',
      'ó': 'o',
      'ú': 'u',
      'ü': 'u',
    };
    accents.forEach((from, to) => value = value.replaceAll(from, to));
    return value;
  }

  List<Widget> _guides() {
    final topics = articles.map((a) => a['category'] as String).toSet();
    final matches = articles
        .where(
          (a) =>
              (category == null || a['category'] == category) &&
              _guideText(
                '${a['title']} ${a['category']} ${a['body']}',
              ).contains(_guideText(guideSearch.text)),
        )
        .toList();
    return [
      _heading('Guías por tema'),
      TextField(
        key: const Key('guide-search'),
        controller: guideSearch,
        decoration: InputDecoration(
          labelText: 'Buscar una guía',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: guideSearch.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Limpiar búsqueda de guías',
                  onPressed: () => setState(guideSearch.clear),
                  icon: const Icon(Icons.close),
                ),
        ),
        onChanged: (_) => setState(() {}),
      ),
      const SizedBox(height: 12),
      ExpansionTile(
        title: const Text('Filtrar por tema'),
        subtitle: Text(category ?? 'Todos los temas'),
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Todos los temas'),
                selected: category == null,
                onSelected: busy
                    ? null
                    : (_) => setState(() => category = null),
              ),
              for (final topic in topics)
                ChoiceChip(
                  label: Text(topic),
                  selected: category == topic,
                  onSelected: busy
                      ? null
                      : (_) => setState(() => category = topic),
                ),
            ],
          ),
        ],
      ),
      if (articles.isEmpty && !busy)
        _notice('No hay guías disponibles por ahora.')
      else if (matches.isEmpty && !busy) ...[
        _notice('No encontramos guías con esta búsqueda.'),
        _action(
          'Limpiar filtros de guías',
          () => setState(() {
            guideSearch.clear();
            category = null;
          }),
        ),
      ],
      for (final a in matches)
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(a['title']),
          subtitle: Text(a['category']),
          trailing: const Icon(Icons.chevron_right),
          onTap: busy
              ? null
              : () {
                  _go(HelpPage.article);
                  setState(() => article = a);
                },
        ),
    ];
  }

  List<Widget> _ticketList() => [
    _heading('Consultas de soporte'),
    if (ticketsAuthorized) ...[
      _action('Crear consulta', () => _go(HelpPage.create), primary: true),
      if (tickets.isEmpty) _notice('Aún no tienes consultas en esta página.'),
      for (final t in tickets)
        ListTile(
          title: Text(t['subject']),
          subtitle: Text(
            '${supportState(t['state'])} · ${helpDate(t['updated_at'])}',
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: busy
              ? null
              : () {
                  _go(HelpPage.detail);
                  _loadDetail(t['id']);
                },
        ),
      if (count > 0)
        Text(
          count > 10
              ? '$count consultas · Página ${offset ~/ 10 + 1}'
              : '$count ${count == 1 ? 'consulta' : 'consultas'}',
        ),
      Wrap(
        spacing: 12,
        children: [
          if (offset > 0)
            _action('Anterior', () => _loadTickets(start: offset - 10)),
          if (offset + tickets.length < count)
            _action('Siguiente', () => _loadTickets(start: offset + 10)),
        ],
      ),
    ],
    const Divider(),
    const ExpansionTile(
      title: Text('Tiempos de atención'),
      children: [
        Text(
          'La atención del equipo no es inmediata. No es un canal de emergencias.',
        ),
      ],
    ),
    _action('Actualizar consultas', () => _loadTickets(start: offset)),
  ];

  Widget _privacyDetails() => ExpansionTile(
    title: const Text('Cómo cuidar tu información'),
    children: [if (help != null) Text(help!['privacy_notice'])],
  );

  Widget _privacyCheck() => CheckboxListTile(
    contentPadding: EdgeInsets.zero,
    value: consent,
    onChanged: busy
        ? null
        : (value) => setState(() => consent = value ?? false),
    title: const Text('Revisé el texto y no contiene información privada.'),
    controlAffinity: ListTileControlAffinity.leading,
  );

  Widget _bodyField(String label) => TextField(
    controller: body,
    enabled: !busy && !uncertain,
    minLines: 3,
    maxLines: 6,
    maxLength: 2000,
    decoration: InputDecoration(labelText: label),
    onChanged: (_) => setState(() => consent = false),
  );

  List<Widget> _create() => [
    _heading('Nueva consulta de soporte'),
    const Text('Cuéntanos qué pasó, sin datos personales ni enlaces.'),
    _privacyDetails(),
    const SizedBox(height: 16),
    TextField(
      controller: subject,
      enabled: !busy && !uncertain,
      maxLength: 120,
      decoration: const InputDecoration(labelText: 'Asunto'),
      onChanged: (_) => setState(() => consent = false),
    ),
    _bodyField('Describe el problema'),
    DropdownButtonFormField<int>(
      initialValue: severity,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Gravedad'),
      items: const [
        DropdownMenuItem(value: 4, child: Text('Baja')),
        DropdownMenuItem(value: 3, child: Text('Normal')),
        DropdownMenuItem(value: 2, child: Text('Alta')),
        DropdownMenuItem(value: 1, child: Text('Crítica: seguridad')),
      ],
      onChanged: busy ? null : (value) => setState(() => severity = value ?? 3),
    ),
    _privacyCheck(),
    _action(
      'Enviar consulta',
      consent &&
              !uncertain &&
              ticketsAuthorized &&
              subject.text.trim().isNotEmpty &&
              body.text.trim().isNotEmpty
          ? () => _send()
          : null,
      primary: true,
    ),
    if (uncertain)
      _action('Consultar consultas antes de reenviar', () {
        _go(HelpPage.tickets);
        _loadTickets();
      }),
    _action('Cancelar', _back),
  ];

  List<Widget> _detail() {
    final d = detail;
    if (d == null) return [];
    final events = List<Map<String, dynamic>>.from(d['events']);
    return [
      _heading(d['subject']),
      Text(supportState(d['state'])),
      ExpansionTile(
        title: const Text('Datos de la consulta'),
        children: [
          FurgoFact('Gravedad', supportSeverity(d['severity'])),
          FurgoFact('Atención', supportPriority(d['priority'])),
          FurgoFact('Actualizada', helpDate(d['updated_at'])),
        ],
      ),
      if (feedback != null) _notice(feedback!),
      for (final e in [...events.reversed])
        ExpansionTile(
          key: ValueKey('event-${e['id']}-${d['version']}'),
          initiallyExpanded: e == events.last,
          title: Text(e['author_role'] == 'admin' ? 'Equipo de soporte' : 'Tú'),
          subtitle: Text(
            '${supportState(e['to_state'])} · ${helpDate(e['occurred_at'])}',
          ),
          childrenPadding: const EdgeInsets.all(16),
          children: [
            if ((e['body'] as String).isNotEmpty) SelectableText(e['body']),
            if ((e['reason'] as String).isNotEmpty) Text(e['reason']),
          ],
        ),
      _action('Actualizar historial', () => _loadDetail(d['id'])),
      if (d['state'] == 'closed')
        _notice('Esta consulta está cerrada. Puedes consultar su historial.')
      else if (events.length >= 200)
        _notice(
          'El historial alcanzó su límite. Crea otra consulta para continuar.',
        )
      else ...[
        _heading('Responder al equipo'),
        if (d['state'] == 'resolved')
          const Text('Tu respuesta volverá a poner la consulta en revisión.'),
        _privacyDetails(),
        _bodyField('Tu respuesta'),
        _privacyCheck(),
        _action(
          'Enviar respuesta',
          consent && !uncertain && body.text.trim().isNotEmpty
              ? () => _send(replying: true)
              : null,
          primary: true,
        ),
      ],
    ];
  }

  List<Widget> _assistant() => [
    _heading('Asistente automático'),
    const ExpansionTile(
      title: Text('Qué puede hacer el asistente'),
      childrenPadding: EdgeInsets.all(16),
      children: [
        Text(
          'Responde con guías revisadas. Es automático: no es una persona ni realiza cambios. No garantiza atención humana inmediata.',
        ),
      ],
    ),
    if (modes.isEmpty)
      _notice('El asistente no está habilitado para tu cuenta en este momento.')
    else ...[
      const Text('Escribe tu duda sin nombres, contactos ni contraseñas.'),
      _privacyDetails(),
      if (modes.contains('contextual'))
        SwitchListTile(
          title: const Text('Incluir estados de mi cuenta'),
          subtitle: const Text(
            'Solo perfil, validación, publicación, plan y suscripción.',
          ),
          value: mode == 'contextual',
          onChanged: busy
              ? null
              : (value) => setState(() {
                  mode = value ? 'contextual' : 'faq';
                  answer = null;
                }),
        ),
      TextField(
        controller: question,
        enabled: !busy,
        maxLength: 300,
        minLines: 2,
        maxLines: 4,
        decoration: const InputDecoration(labelText: 'Tu pregunta'),
        onChanged: (_) => setState(() => answer = null),
      ),
      _action(
        'Consultar asistente',
        question.text.trim().isEmpty ? null : _ask,
        primary: true,
      ),
      if (answer != null) ...[
        _heading('Respuesta automática'),
        SelectableText(answer!['answer']),
        if (mode == 'contextual' && modes.contains('contextual'))
          for (final c in answer!['context'] as List)
            Text('${c['label']}: ${c['value']}'),
        for (final a in articles)
          if (a['id'] == answer!['article_id'])
            _action('Leer guía de origen', () {
              _go(HelpPage.article);
              setState(() => article = a);
            }),
        Text('Versión del contenido: ${answer!['content_version']}'),
        _action('Preparar consulta de soporte', () async {
          // Never copy a question or automatic answer into a support request.
          _go(HelpPage.tickets);
          await _loadTickets();
          if (active && ticketsAuthorized) _go(HelpPage.create);
        }),
        const Text(
          'Se abrirá un formulario vacío. Revisa el texto y confirma para enviarlo.',
        ),
      ],
    ],
  ];

  @override
  Widget build(BuildContext context) {
    if (!active) return const SizedBox.shrink();
    final content = switch (page) {
      HelpPage.overview => _overview(),
      HelpPage.guides => _guides(),
      HelpPage.article => [
        if (article != null && help != null) ...[
          _heading(article!['title']),
          SelectableText(article!['body']),
        ],
      ],
      HelpPage.tickets => _ticketList(),
      HelpPage.detail => _detail(),
      HelpPage.create => _create(),
      HelpPage.assistant => _assistant(),
    };
    final contentBody = SafeArea(
      top: false,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: ListView(
            controller: scroll,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              if (widget.embedded && page != HelpPage.overview)
                Row(
                  children: [
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: busy ? null : _back,
                          icon: const Icon(Icons.arrow_back),
                          label: const Text('Volver'),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Actualizar información',
                      onPressed: busy ? null : _refresh,
                      icon: const Icon(Icons.refresh),
                    ),
                  ],
                ),
              if (busy)
                const LinearProgressIndicator(
                  semanticsLabel: 'Consultando al servidor',
                ),
              if (error != null) ...[
                _notice(error!),
                if (page != HelpPage.tickets) _action('Reintentar', _refresh),
              ],
              if (!widget.showPlan && help == null && !busy && error == null)
                _notice('Actualiza para consultar la ayuda de tu cuenta.'),
              ...content,
            ],
          ),
        ),
      ),
    );
    return PopScope(
      canPop: !widget.handleBack || LegalScope.documentOpenOf(context),
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && widget.handleBack && !LegalScope.documentOpenOf(context))
          _back();
      },
      child: widget.embedded
          ? contentBody
          : Scaffold(
              appBar: AppBar(
                leading: IconButton(
                  tooltip: 'Volver',
                  onPressed: busy ? null : _back,
                  icon: const Icon(Icons.arrow_back),
                ),
                title: Text(
                  widget.showPlan ? 'Mi plan' : 'Ayuda y soporte',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                actions: [
                  IconButton(
                    tooltip: 'Actualizar información',
                    onPressed: busy ? null : _refresh,
                    icon: const Icon(Icons.refresh),
                  ),
                  IconButton(
                    tooltip: 'Cerrar sesión',
                    onPressed: widget.auth.logout,
                    icon: const Icon(Icons.logout),
                  ),
                ],
              ),
              body: contentBody,
            ),
    );
  }
}
