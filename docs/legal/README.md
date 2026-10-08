# Borradores legales FurgoPlus — v0.1, 07-10-2026

**BORRADORES: requieren revisión jurídica chilena antes de producción, personas
reales, datos reales de menores, apoderados o domicilios y operación comercial.
No son aprobación legal ni certificación.**

Textos originales y canónicos, empaquetados sin consultas privadas:

- [Aviso de Privacidad v0.1](../../web/src/legal/privacy.md).
- [Términos de Uso v0.1](../../web/src/legal/terms.md).
- [Inventario y privacidad por diseño](../PRIVACY_BY_DESIGN.md).

Web importa esos Markdown como texto estático. Flutter empaqueta los mismos
archivos mediante enlaces simbólicos en `mobile/assets/legal/`, como el logo
compartido existente. Los visores admiten títulos y párrafos, sin HTML remoto,
formularios de aceptación, enlaces de rastreo ni llamadas al API. Editar estos
originales actualiza ambas superficies al reconstruir; no mantener copias legales
independientes. Toda modificación sustantiva debe avanzar la versión y conservar
el documento anterior antes de una eventual aceptación de producción.

## Marco temporal y fuentes jurídicas

Revisión del proyecto: **07 octubre 2026, Chile**. La Ley **19.628** es el marco
actualmente aplicable; la Ley **21.719** tiene vigencia diferida al **01 diciembre
2026**. Se anticipan objetivos de transparencia, minimización, derechos y especial
protección de menores; no se afirma cumplimiento. Las reglas explícitas de menores
del nuevo marco no se presentan como vigentes hoy. Fuentes primarias consultadas:
[Ley 19.628, texto anterior a la reforma](https://www.bcn.cl/leychile/navegar?idNorma=141599&idVersion=2023-05-09)
y [Ley 21.719, vigencia diferida y artículo primero transitorio](https://www.bcn.cl/leychile/navegar?idNorma=1209272).
La elección de bases legales, representación del apoderado, derechos, plazos y
obligaciones de notificación corresponde a la revisión jurídica chilena.

## Evidencia que falta para producción

La solicitud de contacto sí guarda `consented_at`, participantes y snapshot del
correo del apoderado. Es evidencia del permiso específico de compartir ese correo
al enviar, no de aceptación legal ni de autorización sobre menores. No contiene
una versión del texto del permiso. No existe entidad o API de aceptación de
Términos/Privacidad ni evidencia de autoridad del apoderado sobre un pasajero.

Antes de un uso real, decidir si y cómo procede aceptación y autorización por fin.
Conservar contenido exacto inmutable (identificador/versión y huella), cuenta y
actor, fecha/hora del servidor, alcance y autoridad representada; definir cambios,
revocación cuando corresponda, conservación y acceso a esa evidencia. Un checkbox
sin respaldo no prueba consentimiento. No introducir gating de aceptación en esta
slice. Operador/controlador legal y canal oficial de privacidad siguen pendientes.
