import 'package:flutter/material.dart';

import 'auth_controller.dart';

class AuthApp extends StatefulWidget {
  const AuthApp({super.key, required this.controller});
  final AuthController controller;

  @override
  State<AuthApp> createState() => _AuthAppState();
}

class _AuthAppState extends State<AuthApp> {
  bool register = false;
  final email = TextEditingController();
  final password = TextEditingController();
  final name = TextEditingController();

  @override
  void initState() {
    super.initState();
    widget.controller.restore();
  }

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'FurgoPlus',
    home: Scaffold(
      appBar: AppBar(title: const Text('FurgoPlus')),
      body: Center(
        child: ListenableBuilder(
          listenable: widget.controller,
          builder: (context, child) {
            final controller = widget.controller;
            if (controller.state == AuthState.restoring)
              return const CircularProgressIndicator();
            if (controller.state == AuthState.error) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(controller.error ?? 'Error de conexión'),
                  TextButton(
                    onPressed: controller.restore,
                    child: const Text('Reintentar'),
                  ),
                ],
              );
            }
            if (controller.state == AuthState.parent ||
                controller.state == AuthState.driver ||
                controller.state == AuthState.unsupported) {
              final heading = switch (controller.state) {
                AuthState.parent => 'Inicio para familias',
                AuthState.driver => 'Inicio para conductores',
                _ => 'Esta cuenta no está disponible en móvil',
              };
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(heading),
                  if (controller.displayName != null)
                    Text(controller.displayName!),
                  TextButton(
                    onPressed: controller.logout,
                    child: const Text('Cerrar sesión'),
                  ),
                ],
              );
            }
            return SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (controller.state == AuthState.logoutUnconfirmed)
                      const Text(
                        'Acceso local cerrado. El cierre en el servidor no está confirmado.',
                      ),
                    if (controller.state == AuthState.registered)
                      const Text('Cuenta creada. Inicia sesión.'),
                    Text(
                      register ? 'Registro para familias' : 'Iniciar sesión',
                    ),
                    if (register)
                      TextField(
                        controller: name,
                        decoration: const InputDecoration(
                          labelText: 'Nombre visible',
                        ),
                      ),
                    TextField(
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Correo'),
                    ),
                    TextField(
                      controller: password,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Contraseña',
                      ),
                    ),
                    if (controller.error != null) Text(controller.error!),
                    FilledButton(
                      onPressed: () async {
                        final secret = password.text;
                        password.clear();
                        if (register) {
                          await controller.registerParent(
                            email.text,
                            secret,
                            name.text,
                          );
                          if (controller.state == AuthState.registered)
                            setState(() => register = false);
                        } else {
                          await controller.login(email.text, secret);
                        }
                      },
                      child: Text(register ? 'Crear cuenta' : 'Entrar'),
                    ),
                    TextButton(
                      onPressed: () => setState(() => register = !register),
                      child: Text(
                        register ? 'Volver al inicio' : 'Registrar familia',
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    ),
  );
}
