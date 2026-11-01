import 'dart:async';

import 'package:flutter/foundation.dart';

import 'api_config.dart';
import 'session_api.dart';

enum AuthState {
  restoring,
  signedOut,
  registered,
  parent,
  driver,
  unsupported,
  error,
  logoutUnconfirmed,
}

class AuthController extends ChangeNotifier {
  AuthController(this.api);
  final NativeSessionApi api;
  AuthState state = AuthState.restoring;
  String? displayName;
  String? email;
  String? error;
  int sessionVersion = 0;

  // .test is reserved for testing; do not infer synthetic data from route labels.
  bool get usesSyntheticData =>
      api.config.demoMode ||
      const bool.fromEnvironment('FURGOPLUS_SYNTHETIC_DATA') ||
      (email?.trim().toLowerCase().endsWith('.test') ?? false);

  void expire() {
    sessionVersion++;
    displayName = null;
    email = null;
    unawaited(api.clear().catchError((Object _) {}));
    error = 'Tu sesión caducó. Inicia sesión de nuevo para continuar.';
    state = AuthState.signedOut;
    notifyListeners();
  }

  void _home(Map<String, dynamic> identity) {
    // Validate before advancing the identity boundary. If parsing throws after
    // sessionVersion++, restore/login would discard their own error as stale
    // and strand the screen in AuthState.restoring.
    final nextEmail = identity['email'];
    final role = identity['role'];
    if (nextEmail is! String || nextEmail.isEmpty || role is! String) {
      throw const FormatException('Invalid session identity');
    }
    final nextName = identity['display_name'] is String
        ? identity['display_name'] as String
        : nextEmail;
    final nextState = switch (role) {
      'parent' => AuthState.parent,
      'driver' => AuthState.driver,
      _ => AuthState.unsupported,
    };
    api.invalidateRequests();
    sessionVersion++;
    email = nextEmail;
    displayName = nextName;
    error = null;
    state = nextState;
    notifyListeners();
  }

  Future<void> restore() async {
    final version = ++sessionVersion;
    api.invalidateRequests();
    displayName = email = null;
    state = AuthState.restoring;
    error = null;
    notifyListeners();
    try {
      await api.restoreCookies();
      if (version != sessionVersion) return;
      await api.csrf();
      if (version != sessionVersion) return;
      final identity = await api.me();
      if (version != sessionVersion) return;
      _home(identity);
    } on AuthFailure catch (failure) {
      if (version != sessionVersion) return;
      if (failure.code == 'not_authenticated') {
        state = AuthState.signedOut;
      } else {
        error = loadFailureMessage(failure, 'tu sesión');
        state = AuthState.error;
      }
      notifyListeners();
    } catch (cause) {
      if (version != sessionVersion) return;
      api.invalidateRequests();
      error = loadFailureMessage(cause, 'tu sesión');
      state = AuthState.error;
      notifyListeners();
    }
  }

  Future<void> registerParent(
    String email,
    String password,
    String name,
  ) async {
    final version = sessionVersion;
    error = null;
    try {
      await api.registerParent(email, password, name);
      if (version != sessionVersion) return;
      state = AuthState.registered;
    } on AuthFailure catch (failure) {
      if (version != sessionVersion) return;
      error = _authError(failure, registering: true);
    } catch (_) {
      if (version != sessionVersion) return;
      error =
          'No se pudo confirmar el registro. Intenta iniciar sesión antes de repetirlo.';
    }
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final version = ++sessionVersion;
    api.invalidateRequests();
    displayName = this.email = null;
    state = AuthState.restoring;
    error = null;
    notifyListeners();
    try {
      await api.login(email, password);
      if (version != sessionVersion) return;
      final identity = await api.me();
      if (version != sessionVersion) return;
      _home(identity);
      return;
    } on AuthFailure catch (failure) {
      if (version != sessionVersion) return;
      try {
        await api.clear();
      } catch (_) {
        /* Bounded cleanup must not strand login. */
      }
      if (version != sessionVersion) return;
      error = _authError(failure);
    } catch (cause) {
      if (version != sessionVersion) return;
      api.invalidateRequests();
      error = loadFailureMessage(cause, 'tu sesión');
      state = AuthState.error;
      notifyListeners();
      return;
    }
    state = AuthState.signedOut;
    notifyListeners();
  }

  Future<void> logout() async {
    final version = ++sessionVersion;
    displayName = null;
    email = null;
    error = null;
    state = AuthState.restoring;
    notifyListeners();
    var confirmed = false;
    try {
      confirmed = await api.logout();
    } catch (_) {
      /* Local cleanup may fail. */
    }
    if (version != sessionVersion) return;
    state = confirmed ? AuthState.signedOut : AuthState.logoutUnconfirmed;
    notifyListeners();
  }
}

String _authError(AuthFailure failure, {bool registering = false}) {
  if (failure.code == 'registration_disabled') return demoRegistrationNotice;
  if (failure.code == 'csrf_failed') {
    return 'La verificación caducó. Repite la acción.';
  }
  if (failure.code == 'throttled') {
    return 'Hay demasiados intentos. Espera un momento y vuelve a intentarlo.';
  }
  if (failure.code == 'validation_error') {
    return registering
        ? 'No pudimos crear la cuenta. Revisa tu correo, nombre y los requisitos de la contraseña e inténtalo de nuevo.'
        : 'Correo o contraseña incorrectos.';
  }
  return registering
      ? 'No se pudo crear la cuenta. Inténtalo de nuevo.'
      : 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}
