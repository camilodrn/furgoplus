import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api_config.dart';
import 'auth_controller.dart';
import 'driver_home.dart';
import 'furgo_theme.dart';
import 'legal_access.dart';
import 'parent_home.dart';

class AuthApp extends StatefulWidget {
  const AuthApp({super.key, required this.controller});
  final AuthController controller;

  @override
  State<AuthApp> createState() => _AuthAppState();
}

class _AuthAppState extends State<AuthApp> {
  bool register = false;
  bool pending = false;
  bool showPassword = false;
  bool showSessionFeedback = true;
  bool illustrativeFeedback = false;
  int sessionVersion = 0;
  final email = TextEditingController();
  final password = TextEditingController();
  final name = TextEditingController();
  final fieldErrors = <String, String>{};

  @override
  void initState() {
    super.initState();
    sessionVersion = widget.controller.sessionVersion;
    widget.controller.addListener(_sessionChanged);
    widget.controller.restore();
  }

  void _sessionChanged() {
    if (sessionVersion == widget.controller.sessionVersion) return;
    sessionVersion = widget.controller.sessionVersion;
    email.clear();
    password.clear();
    name.clear();
    register = false;
    showPassword = false;
    fieldErrors.clear();
    showSessionFeedback = true;
    illustrativeFeedback = false;
  }

  @override
  void dispose() {
    widget.controller.removeListener(_sessionChanged);
    email.dispose();
    password.dispose();
    name.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (pending) return;
    if (register && widget.controller.api.config.demoMode) {
      TextInput.finishAutofillContext(shouldSave: false);
      FocusManager.instance.primaryFocus?.unfocus();
      setState(() {
        email.clear();
        password.clear();
        name.clear();
        fieldErrors.clear();
        showPassword = false;
        showSessionFeedback = false;
        illustrativeFeedback = true;
      });
      return;
    }
    setState(() {
      fieldErrors.clear();
      if (email.text.trim().isEmpty || !email.text.contains('@')) {
        fieldErrors['email'] = 'Escribe tu correo electrónico.';
      }
      if (password.text.isEmpty) {
        fieldErrors['password'] = 'Escribe tu contraseña.';
      } else if (register && password.text.length < 8) {
        fieldErrors['password'] = 'Usa al menos 8 caracteres.';
      }
      if (register && name.text.trim().isEmpty) {
        fieldErrors['name'] = 'Escribe cómo te llamas.';
      }
    });
    if (fieldErrors.isNotEmpty) return;
    setState(() {
      pending = true;
      showSessionFeedback = true;
    });
    final secret = password.text;
    password.clear();
    FocusManager.instance.primaryFocus?.unfocus();
    try {
      if (register) {
        await widget.controller.registerParent(email.text, secret, name.text);
        if (mounted && widget.controller.state == AuthState.registered) {
          setState(() {
            register = false;
            showPassword = false;
            name.clear();
          });
        }
      } else {
        await widget.controller.login(email.text, secret);
      }
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Widget notice(String text, {bool success = false, bool error = false}) =>
      Semantics(
        liveRegion: true,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          margin: const EdgeInsets.only(bottom: 24),
          decoration: BoxDecoration(
            color: success
                ? const Color(0xFFE9F6ED)
                : error
                ? const Color(0xFFFFF0F1)
                : const Color(0xFFFFF5DF),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            text,
            style: TextStyle(
              fontSize: 16,
              height: 1.5,
              color: success
                  ? const Color(0xFF16643F)
                  : error
                  ? const Color(0xFFA32735)
                  : const Color(0xFF835313),
            ),
          ),
        ),
      );

  Widget authContent(BuildContext context) {
    final controller = widget.controller;
    final illustrative = register && controller.api.config.demoMode;
    final headingStyle = Theme.of(context).textTheme.headlineMedium;
    final supportStyle = Theme.of(context).textTheme.bodySmall;
    if (controller.state == AuthState.restoring) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text('Abriendo FurgoPlus', style: headingStyle),
          ),
          const SizedBox(height: 24),
          const LinearProgressIndicator(),
          const SizedBox(height: 24),
          Semantics(
            liveRegion: true,
            child: Text('Estamos comprobando tu sesión…'),
          ),
        ],
      );
    }
    if (controller.state == AuthState.error) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text('No pudimos abrir tu cuenta', style: headingStyle),
          ),
          const SizedBox(height: 24),
          notice(
            'No se pudo restaurar la sesión. Comprueba tu conexión y vuelve a intentarlo.',
            error: true,
          ),
          FilledButton(
            onPressed: controller.restore,
            child: const Text('Reintentar'),
          ),
        ],
      );
    }
    if (controller.state == AuthState.unsupported) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              'Esta cuenta no está disponible en móvil',
              style: headingStyle,
            ),
          ),
          const SizedBox(height: 16),
          const Text('Para administrar FurgoPlus, inicia sesión en la web.'),
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: controller.logout,
            child: const Text('Cerrar sesión'),
          ),
        ],
      );
    }
    return AutofillGroup(
      onDisposeAction: illustrative
          ? AutofillContextAction.cancel
          : AutofillContextAction.commit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (controller.state == AuthState.logoutUnconfirmed)
            notice(
              'Sesión local cerrada. El cierre en el servidor no está confirmado.',
            ),
          if (controller.state == AuthState.registered && !register)
            notice('Cuenta creada. Inicia sesión.', success: true),
          Semantics(
            header: true,
            child: Text(
              register
                  ? (illustrative
                        ? 'Registro ilustrativo de familia'
                        : 'Crea tu cuenta de familia')
                  : 'Inicia sesión',
              style: headingStyle,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            register
                ? (illustrative
                      ? 'Puedes explorar el formulario. El registro público está cerrado en esta demostración.'
                      : 'Esta cuenta es para apoderados y familias. Después podrás buscar transporte escolar.')
                : 'Coordina tu transporte escolar con FurgoPlus.',
          ),
          const SizedBox(height: 16),
          Text(
            register
                ? (illustrative
                      ? 'No ingreses datos reales. Las cuentas ficticias las prepara el equipo.'
                      : 'Entorno de demostración: usa únicamente información sintética de prueba.')
                : 'Apoderados y conductores pueden iniciar sesión aquí. Los conductores crean su cuenta en la web.',
            style: supportStyle,
          ),
          SizedBox(height: register ? 32 : 24),
          if (register) ...[
            TextField(
              controller: name,
              enabled: !pending,
              maxLength: 100,
              textCapitalization: TextCapitalization.words,
              autofillHints: illustrative ? null : const [AutofillHints.name],
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: 'Cómo te llamas',
                errorText: fieldErrors['name'],
              ),
            ),
            const SizedBox(height: 24),
          ],
          TextField(
            controller: email,
            enabled: !pending,
            keyboardType: TextInputType.emailAddress,
            autofillHints: illustrative ? null : const [AutofillHints.email],
            autocorrect: false,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: 'Correo electrónico',
              errorText: fieldErrors['email'],
            ),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: password,
            enabled: !pending,
            obscureText: !showPassword,
            autocorrect: false,
            enableSuggestions: false,
            autofillHints: illustrative
                ? null
                : [
                    register
                        ? AutofillHints.newPassword
                        : AutofillHints.password,
                  ],
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => submit(),
            decoration: InputDecoration(
              labelText: 'Contraseña',
              errorText: fieldErrors['password'],
              suffixIcon: IconButton(
                tooltip: showPassword
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña',
                constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                onPressed: pending
                    ? null
                    : () => setState(() => showPassword = !showPassword),
                icon: Icon(
                  showPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          if (register) ...[
            Text(
              'Usa al menos 8 caracteres. Evita contraseñas comunes, solo números o muy parecidas a tu correo.',
              style: supportStyle,
            ),
            const SizedBox(height: 24),
          ],
          if (controller.error != null && showSessionFeedback)
            notice(controller.error!, error: true),
          if (illustrativeFeedback && illustrative)
            notice(demoRegistrationNotice),
          FilledButton(
            onPressed: pending ? null : submit,
            child: Text(
              pending
                  ? (register ? 'Creando cuenta…' : 'Iniciando sesión…')
                  : (register ? 'Crear cuenta' : 'Iniciar sesión'),
            ),
          ),
          if (pending)
            Padding(
              padding: EdgeInsets.only(top: 16),
              child: Semantics(
                liveRegion: true,
                child: Text('Espera mientras completamos tu solicitud.'),
              ),
            ),
          SizedBox(height: register ? 32 : 24),
          const Divider(),
          const SizedBox(height: 16),
          if (!register) ...[
            const Text('¿Aún no tienes cuenta?'),
            const SizedBox(height: 16),
          ],
          OutlinedButton(
            onPressed: pending
                ? null
                : () => setState(() {
                    if (controller.api.config.demoMode) {
                      TextInput.finishAutofillContext(shouldSave: false);
                      name.clear();
                      email.clear();
                    }
                    register = !register;
                    illustrativeFeedback = false;
                    showSessionFeedback = false;
                    showPassword = false;
                    password.clear();
                    fieldErrors.clear();
                  }),
            child: Text(
              register ? 'Volver a iniciar sesión' : 'Crear cuenta de familia',
            ),
          ),
          const LegalLinks(),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, child) => MaterialApp(
      title: 'FurgoPlus',
      theme: furgoTheme(),
      home: LegalScope(
        key: ValueKey(
          '${widget.controller.state}:${widget.controller.sessionVersion}',
        ),
        child: widget.controller.state == AuthState.parent
            ? ParentHome(
                key: ValueKey(widget.controller.sessionVersion),
                auth: widget.controller,
              )
            : widget.controller.state == AuthState.driver
            ? DriverHome(
                key: ValueKey(widget.controller.sessionVersion),
                auth: widget.controller,
              )
            : Scaffold(
                body: SafeArea(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 480),
                        child: Builder(
                          builder: (context) => Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Image.asset(
                                  'assets/furgoplus-logo.png',
                                  width: 204,
                                  semanticLabel: 'FurgoPlus Transporte Escolar',
                                ),
                              ),
                              const SizedBox(height: 24),
                              authContent(context),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
      ),
    ),
  );
}
