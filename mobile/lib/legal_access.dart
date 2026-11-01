import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Local legal navigation never pushes a route above the session-keyed home.
/// Account replacement/expiry removes both the document and its private sibling.
class LegalScope extends StatefulWidget {
  const LegalScope({super.key, required this.child});
  final Widget child;
  static bool documentOpenOf(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<_LegalActions>()
          ?.documentOpen ??
      false;

  @override
  State<LegalScope> createState() => _LegalScopeState();
}

class _LegalScopeState extends State<LegalScope> {
  String? selected;
  final focus = FocusScopeNode();
  FocusNode? returnFocus;

  @override
  void dispose() {
    focus.dispose();
    super.dispose();
  }

  void close() {
    final target = returnFocus;
    setState(() => selected = null);
    // Wait until the account subtree can receive focus again.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || selected != null) return;
      if (target?.context != null && target!.canRequestFocus) {
        target.requestFocus();
      } else {
        focus.requestFocus();
      }
    });
  }

  @override
  Widget build(BuildContext context) => _LegalActions(
    documentOpen: selected != null,
    open: (name) {
      returnFocus = FocusManager.instance.primaryFocus;
      FocusManager.instance.primaryFocus?.unfocus();
      setState(() => selected = name);
    },
    child: PopScope(
      canPop: selected == null,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && selected != null) close();
      },
      child: Stack(
        children: [
          Offstage(
            offstage: selected != null,
            child: FocusScope(
              node: focus,
              canRequestFocus: selected == null,
              descendantsAreFocusable: selected == null,
              child: widget.child,
            ),
          ),
          if (selected != null)
            _LegalDocument(
              key: ValueKey(selected),
              name: selected!,
              close: close,
            ),
        ],
      ),
    ),
  );
}

class _LegalActions extends InheritedWidget {
  const _LegalActions({
    required this.open,
    required this.documentOpen,
    required super.child,
  });
  final bool documentOpen;
  final void Function(String) open;

  @override
  bool updateShouldNotify(_LegalActions oldWidget) =>
      documentOpen != oldWidget.documentOpen;
}

class LegalLinks extends StatelessWidget {
  const LegalLinks({super.key});

  @override
  Widget build(BuildContext context) {
    Widget link(String name) => TextButton(
      style: TextButton.styleFrom(
        foregroundColor: const Color(0xFF0752AC),
        backgroundColor: Colors.transparent,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        side: BorderSide.none,
        textStyle: const TextStyle(
          fontSize: 14,
          height: 1.4,
          fontWeight: FontWeight.w500,
          decoration: TextDecoration.underline,
        ),
      ),
      onPressed: () =>
          context.getInheritedWidgetOfExactType<_LegalActions>()!.open(name),
      child: Text(name, textAlign: TextAlign.center),
    );

    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        link('Privacidad'),
        // Keep the decorative separator with the second link when wrapping.
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ExcludeSemantics(child: Text('·')),
            Flexible(child: link('Términos')),
          ],
        ),
      ],
    );
  }
}

class _LegalDocument extends StatefulWidget {
  const _LegalDocument({super.key, required this.name, required this.close});
  final String name;
  final VoidCallback close;

  @override
  State<_LegalDocument> createState() => _LegalDocumentState();
}

class _LegalDocumentState extends State<_LegalDocument> {
  late final Future<String> text = rootBundle.loadString(
    'assets/legal/${widget.name == 'Privacidad' ? 'privacy' : 'terms'}.md',
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: IconButton(
        tooltip: 'Cerrar documento',
        onPressed: widget.close,
        icon: const Icon(Icons.arrow_back),
      ),
      title: Text(widget.name),
    ),
    body: SafeArea(
      child: FutureBuilder<String>(
        future: text,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'No pudimos abrir el borrador. Cierra y vuelve a abrir.',
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final blocks = snapshot.data!
              .trim()
              .split(RegExp(r'\n\s*\n'))
              .skip(1)
              .toList();
          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < blocks.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: blocks[i].startsWith('## ')
                            ? Semantics(
                                header: true,
                                child: Text(
                                  blocks[i].substring(3),
                                  style: Theme.of(context).textTheme.titleLarge
                                      ?.copyWith(
                                        fontSize: 22,
                                        height: 1.3,
                                        fontWeight: FontWeight.w600,
                                      ),
                                ),
                              )
                            : i == 0
                            ? Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF5DF),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: SelectableText(
                                  blocks[i].replaceAll('\n', ' '),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    height: 1.4,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF835313),
                                  ),
                                ),
                              )
                            : SelectableText(
                                blocks[i].replaceAll('\n', ' '),
                                style: const TextStyle(
                                  fontSize: 18,
                                  height: 1.5,
                                ),
                              ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
}
