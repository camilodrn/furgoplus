"""Early whole-input guards; public retrieval remains a complete-match allowlist.

These rules reject mixed requests before FAQ suffix handling or account reads.
They are defense in depth: output and data permissions never depend on them.
Technical nouns alone are deliberately not a reason to reject product support.
"""

import re


def scope_guard(text: str) -> str | None:
    if re.search(
        r"\b(?:otr[oa]s? (?:usuari[oa]s?|cuentas?|conductores?|apoderad[oa]s?)|"
        r"(?:datos|plan|pago|vencimiento|cuenta) (?:de|del) (?:usuario|conductor|apoderado)\b|"
        r"(?:datos|planes|pagos|correos|cuentas) (?:ajenos|ajenas|de todos))\b", text
    ):
        return "private"
    if re.search(
        r"\b(?:(?:ignora\w*|olvida\w*|omite\w*|desobedece\w*|ignore|disregard)\b.{0,80}"
        r"\b(?:instrucciones|reglas|restricciones|instructions|rules)|"
        r"(?:actua|comportate|responde) como (?:chatgpt|un chatbot|un asistente general)|"
        r"(?:revela\w*|muestra\w*|imprime\w*|repite\w*|dame|copia\w*)\b.{0,40}"
        r"\b(?:prompt|tus instrucciones)|"
        r"(?:prompt|instrucciones|mensaje) (?:intern[oa]s?|del sistema)|system prompt|"
        r"(?:inventa\w*|finge\w*|alucina\w*)\b|simula (?:un |el )?(?:pago|plan)\b)", text, re.DOTALL
    ):
        return "out_of_scope"
    code_request = re.search(
        r"\b(?:escrib\w*|genera\w*|crea\w*|dame|haz\w*|programa\w*|implementa\w*|"
        r"ejecuta\w*|desarrolla\w*|ensena\w*|write|generate|build)\s+"
        r"(?:(?:un|una|el|la|los|las|ejemplo|consulta|de|en|con|para|bloque|funcion|pagina|plantilla|sitio)\s+){0,5}"
        r"(?:python|html|sql|javascript|bash|scripts?|codigo|programa|programacion)\b", text
    )
    if code_request or re.search(r"\bmercado\s*libre\b", text):
        return "out_of_scope"
    if re.search(
        r"\b(?:cambia(?:me|lo)?|modifica(?:me|lo)?|elimina(?:me|lo)?|borra(?:me|lo)?|"
        r"ejecuta|actualiza(?:me|lo)?|publicame|reservame|pagame|"
        r"cancela(?:me|lo)?|activa(?:me|lo)?|desactiva(?:me|lo)?)\b", text
    ):
        return "read_only"
    return None
