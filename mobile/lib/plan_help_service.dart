import 'session_api.dart';

/// No private data is persisted. All authorization remains in Django.
class PlanHelpService {
  PlanHelpService(this.api);
  final NativeSessionApi api;
  static const _timeout = Duration(seconds: 20);

  Future<Map<String, dynamic>> _get(String path) =>
      api.get(path, timeout: _timeout);
  Future<Map<String, dynamic>> _write(String path, Map<String, Object?> data) =>
      api.write(path, data, timeout: _timeout);

  Future<Map<String, dynamic>> capabilities() => _get('driver/capabilities/');
  Future<Map<String, dynamic>> help() => _get('help/');
  Future<Map<String, dynamic>> tickets(int offset) =>
      _get('support/tickets/?limit=10&offset=$offset');
  Future<Map<String, dynamic>> ticket(int id) => _get('support/tickets/$id/');
  Future<Map<String, dynamic>> create(
    String subject,
    String body,
    int severity,
  ) => _write('support/tickets/', {
    'subject': subject.trim(),
    'body': body.trim(),
    'severity': severity,
    'privacy_confirmed': true,
  });
  Future<Map<String, dynamic>> reply(int id, int version, String body) =>
      _write('support/tickets/$id/', {
        'body': body.trim(),
        'expected_version': version,
      });
  Future<Map<String, dynamic>> ask(String question, String mode) =>
      _write('assistant/', {'question': question.trim(), 'mode': mode});
}

bool capabilityEnabled(Map<String, dynamic>? data, String code) {
  final capability = data?['capabilities']?[code];
  return capability is Map &&
      capability['implemented'] == true &&
      capability['enabled'] == true;
}

String supportState(Object? state) => switch (state) {
  'open' => 'Abierta',
  'in_progress' => 'En revisión',
  'waiting_user' => 'Esperando tu respuesta',
  'resolved' => 'Resuelta',
  'closed' => 'Cerrada',
  _ => 'Estado por confirmar',
};

String supportPriority(Object? priority) => switch (priority) {
  'standard' => 'Estándar',
  'preferred' => 'Preferente',
  'priority' => 'Prioritaria',
  _ => 'Por confirmar',
};

String planRestriction(Object? reason) => switch (reason) {
  'subscription_missing' => 'No tienes una suscripción asignada.',
  'plan_unknown' => 'Tu plan necesita revisión del equipo.',
  'subscription_inactive' => 'Tu suscripción está inactiva.',
  'subscription_suspended' => 'Tu suscripción está suspendida.',
  'subscription_invalid_window' => 'La vigencia necesita revisión del equipo.',
  'subscription_not_started' => 'Tu suscripción aún no comienza.',
  'subscription_expired' => 'Tu suscripción venció.',
  'driver_unavailable' =>
    'Tu perfil necesita revisión para activar todos los beneficios.',
  'plan_not_included' => 'No incluido en tu plan actual.',
  'not_implemented' => 'Esta función aún no está disponible.',
  _ => 'Este beneficio no está habilitado. Consulta al equipo.',
};

// The operating system resolves the device timezone, including daylight saving.
// Label it explicitly rather than assuming a fixed Chilean UTC offset.
String helpDate(Object? raw) {
  final date = raw is String ? DateTime.tryParse(raw)?.toLocal() : null;
  if (date == null) return 'Sin fecha confirmada';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(date.day)}/${two(date.month)}/${date.year} '
      '${two(date.hour)}:${two(date.minute)} (hora del dispositivo)';
}

String supportSeverity(Object? severity) => switch (severity) {
  1 => 'Crítica: seguridad',
  2 => 'Alta',
  3 => 'Normal',
  4 => 'Baja',
  _ => 'Por confirmar',
};
