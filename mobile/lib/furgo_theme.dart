import 'package:flutter/material.dart';

/// Shared Material foundation; system fonts and system text scaling are retained.
ThemeData furgoTheme() {
  const primary = Color(0xFF0752AC);
  const ink = Color(0xFF202B3A);
  const muted = Color(0xFF526176);
  const border = Color(0xFF68788D);
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: primary).copyWith(
      primary: primary,
      onPrimary: Colors.white,
      surface: Colors.white,
      onSurface: ink,
      onSurfaceVariant: muted,
      outline: border,
      error: const Color(0xFFA32735),
    ),
    scaffoldBackgroundColor: const Color(0xFFF5F7FB),
  );
  final actionStyle = ButtonStyle(
    minimumSize: const WidgetStatePropertyAll(Size(48, 56)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: 24, vertical: 16),
    ),
    textStyle: const WidgetStatePropertyAll(
      TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
    ),
    shape: WidgetStatePropertyAll(
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
  );
  return base.copyWith(
    textTheme: base.textTheme.copyWith(
      headlineMedium: const TextStyle(
        fontSize: 28,
        height: 1.25,
        fontWeight: FontWeight.w700,
        color: ink,
      ),
      titleLarge: const TextStyle(fontSize: 24, height: 1.3, color: ink),
      titleMedium: const TextStyle(fontSize: 20, height: 1.3, color: ink),
      bodyLarge: const TextStyle(fontSize: 18, height: 1.55, color: ink),
      bodyMedium: const TextStyle(fontSize: 18, height: 1.55, color: ink),
      bodySmall: const TextStyle(fontSize: 16, height: 1.5, color: muted),
      labelLarge: const TextStyle(fontSize: 18, color: ink),
      labelMedium: const TextStyle(fontSize: 16, color: muted),
      labelSmall: const TextStyle(fontSize: 14, color: muted),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: const TextStyle(fontSize: 18, color: ink),
      errorStyle: const TextStyle(fontSize: 16, color: Color(0xFFA32735)),
      errorMaxLines: 4,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: primary, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(style: actionStyle),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: actionStyle.copyWith(
        side: const WidgetStatePropertyAll(BorderSide(color: border)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: actionStyle),
  );
}
