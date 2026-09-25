import 'package:flutter/foundation.dart';

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
  String? error;
  int sessionVersion = 0;

  void expire() {
    sessionVersion++;
    displayName = null;
    error = null;
    state = AuthState.signedOut;
    notifyListeners();
  }

  void _home(Map<String, dynamic> identity) {
    sessionVersion++;
    displayName = identity['display_name'] is String
        ? identity['display_name'] as String
        : identity['email'] as String?;
    state = switch (identity['role']) {
      'parent' => AuthState.parent,
      'driver' => AuthState.driver,
      _ => AuthState.unsupported,
    };
    notifyListeners();
  }

  Future<void> restore() async {
    state = AuthState.restoring;
    notifyListeners();
    try {
      await api.restoreCookies();
      await api.csrf();
      _home(await api.me());
    } on AuthFailure catch (failure) {
      if (failure.code == 'not_authenticated') {
        await api.clear();
        state = AuthState.signedOut;
      } else {
        error = failure.message;
        state = AuthState.error;
      }
      notifyListeners();
    } catch (_) {
      error = 'No se pudo restaurar la sesión.';
      state = AuthState.error;
      notifyListeners();
    }
  }

  Future<void> registerParent(
    String email,
    String password,
    String name,
  ) async {
    error = null;
    try {
      await api.registerParent(email, password, name);
      state = AuthState.registered;
    } on AuthFailure catch (failure) {
      error = failure.message;
    } catch (_) {
      error = 'No se pudo crear la cuenta.';
    }
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    error = null;
    try {
      await api.login(email, password);
      _home(await api.me());
      return;
    } on AuthFailure catch (failure) {
      await api.clear();
      error = failure.message;
    } catch (_) {
      await api.clear();
      error = 'No se pudo iniciar sesión.';
    }
    state = AuthState.signedOut;
    notifyListeners();
  }

  Future<void> logout() async {
    sessionVersion++;
    displayName = null;
    error = null;
    state = AuthState.restoring;
    notifyListeners();
    final confirmed = await api.logout();
    state = confirmed ? AuthState.signedOut : AuthState.logoutUnconfirmed;
    notifyListeners();
  }
}
