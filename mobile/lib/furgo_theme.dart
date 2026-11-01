import 'package:flutter/material.dart';

/// Shared geometry for task surfaces; Material controls retain native feedback.
abstract final class FurgoLayout {
  static const space2 = 8.0;
  static const space3 = 12.0;
  static const space4 = 16.0;
  static const space6 = 24.0;
  static const panelPadding = 20.0;
  static const panelRadius = 12.0;
  static const contentWidth = 720.0;
  static const touchTarget = 48.0;
}

/// FurgoPlus tokens. Keep system fonts, text scaling and 48 dp touch targets.
abstract final class FurgoColors {
  static const blue = Color(0xFF0752AC);
  static const blueSoft = Color(0xFFEAF3FF);
  static const ink = Color(0xFF202B3A);
  static const muted = Color(0xFF526176);
  static const border = Color(0xFF68788D);
  static const divider = Color(0xFFD8E0EB);
  static const neutral = muted;
  static const neutralSoft = Color(0xFFEEF1F5);
  static const canvas = Color(0xFFF5F7FB);
  static const success = Color(0xFF16643F);
  static const successSoft = Color(0xFFE9F6ED);
  static const warning = Color(0xFF835313);
  static const warningSoft = Color(0xFFFFF5DF);
  static const error = Color(0xFFA32735);
  static const errorSoft = Color(0xFFFFF0F1);
}

ThemeData furgoTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: FurgoColors.blue).copyWith(
      primary: FurgoColors.blue,
      onPrimary: Colors.white,
      primaryContainer: FurgoColors.blueSoft,
      onPrimaryContainer: FurgoColors.blue,
      surface: Colors.white,
      onSurface: FurgoColors.ink,
      onSurfaceVariant: FurgoColors.muted,
      outline: FurgoColors.border,
      outlineVariant: FurgoColors.divider,
      error: FurgoColors.error,
      onError: Colors.white,
    ),
    scaffoldBackgroundColor: FurgoColors.canvas,
    materialTapTargetSize: MaterialTapTargetSize.padded,
  );
  TextStyle type(
    double size,
    FontWeight weight, {
    Color? color,
    double height = 1.4,
  }) => TextStyle(
    fontSize: size,
    height: height,
    fontWeight: weight,
    color: color ?? FurgoColors.ink,
  );
  final actionStyle = ButtonStyle(
    minimumSize: const WidgetStatePropertyAll(Size(48, 52)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: 20, vertical: 14),
    ),
    textStyle: WidgetStatePropertyAll(type(16, FontWeight.w600)),
    shape: WidgetStatePropertyAll(
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
  return base.copyWith(
    textTheme: base.textTheme.copyWith(
      headlineMedium: type(28, FontWeight.w700, height: 1.2),
      headlineSmall: type(24, FontWeight.w700, height: 1.25),
      titleLarge: type(22, FontWeight.w700, height: 1.3),
      titleMedium: type(18, FontWeight.w600, height: 1.3),
      titleSmall: type(16, FontWeight.w600),
      bodyLarge: type(18, FontWeight.w400),
      bodyMedium: type(16, FontWeight.w400, height: 1.45),
      bodySmall: type(14, FontWeight.w400, color: FurgoColors.muted),
      labelLarge: type(16, FontWeight.w600),
      labelMedium: type(14, FontWeight.w600, color: FurgoColors.muted),
      labelSmall: type(12, FontWeight.w500, color: FurgoColors.muted),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: FurgoColors.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FurgoLayout.panelRadius),
        side: const BorderSide(color: FurgoColors.divider),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: FurgoColors.divider,
      thickness: 1,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      indicatorColor: FurgoColors.blueSoft,
      elevation: 0,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => type(
          12,
          states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? FurgoColors.blue
              : FurgoColors.muted,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? FurgoColors.blue
              : FurgoColors.muted,
        ),
      ),
    ),
    listTileTheme: const ListTileThemeData(
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      minVerticalPadding: 12,
      iconColor: FurgoColors.blue,
    ),
    expansionTileTheme: const ExpansionTileThemeData(
      tilePadding: EdgeInsets.symmetric(horizontal: 0, vertical: 4),
      childrenPadding: EdgeInsets.only(bottom: 16),
      expandedAlignment: Alignment.centerLeft,
      shape: Border(),
      collapsedShape: Border(),
      iconColor: FurgoColors.blue,
      collapsedIconColor: FurgoColors.muted,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      contentPadding: const EdgeInsets.all(16),
      labelStyle: const TextStyle(fontSize: 16, color: FurgoColors.ink),
      errorStyle: const TextStyle(fontSize: 14, color: FurgoColors.error),
      errorMaxLines: 4,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: FurgoColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: FurgoColors.blue, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(style: actionStyle),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: actionStyle.copyWith(
        side: const WidgetStatePropertyAll(
          BorderSide(color: FurgoColors.border),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: actionStyle.copyWith(
        minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        ),
      ),
    ),
  );
}
