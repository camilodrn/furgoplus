import dataclasses
import re
import subprocess
import unittest
from datetime import date, datetime, timezone
from unittest.mock import Mock, patch

from local_assistant.assistant import Assistant
from local_assistant.data import (
    DEMO_DAY, Capacity, DataUnavailable, Plan, Principal, Publication, SyntheticQueries,
)
from local_assistant.evaluate import CASES, OfflineModel
from local_assistant.guides import GUIDES
from local_assistant.ollama import ModelBudget, ModelBusy, OllamaClient
from local_assistant.understanding import understand


class ConversationTests(unittest.TestCase):
    def make(self, **kwargs):
        defaults = dict(queries=SyntheticQueries(), actor=Principal("demo-a"),
                        route_id="demo-a-route", today=DEMO_DAY)
        defaults.update(kwargs)
        return Assistant(**defaults)

    def test_required_evaluation_cases_exact(self):
        for name, question, expected, source in CASES:
            with self.subTest(name=name):
                reply = self.make(model=OfflineModel() if name == "offline" else None).ask(question)
                self.assertEqual((reply.text, reply.source), (expected, source))

    def test_account_data_never_calls_model(self):
        model = Mock()
        for text in ("plan", "vencimiento", "cupos", "publicación", "validación", "recorrido"):
            self.assertEqual(self.make(model=model).ask(text).source, "authorized_data")
        self.assertEqual(model.mock_calls, [])

    def test_sensitive_input_reduced_to_topic_not_redacted_text(self):
        model = Mock()
        reply = self.make(model=model).ask(
            "¿Aceptar una solicitud reserva cupo? Mi hijo Juan vive en Calle Ficticia 123; +56912345678; secreto=abc"
        )
        self.assertEqual(reply.source, "faq")
        self.assertEqual(reply.text, GUIDES["booking"].sentences[0])
        self.assertEqual(model.mock_calls, [])

    def test_real_adapter_failures_reach_fallback_and_leave_known_facts_exact(self):
        for outcome in (OSError("private error"), subprocess.TimeoutExpired("worker", 0.2),
                        subprocess.CompletedProcess([], 1, stdout=b"private server error"),
                        subprocess.CompletedProcess([], 0, stdout=b'{"message":"tu plan esta activo"}')):
            client = OllamaClient(budget=ModelBudget())
            assistant = self.make(model=client)
            kwargs = {"side_effect": outcome} if isinstance(outcome, Exception) else {"return_value": outcome}
            with self.subTest(outcome=type(outcome).__name__), patch(
                "local_assistant.ollama.subprocess.run", **kwargs
            ) as run:
                reply = assistant.ask("Soy mamá, busco furgón y necesito orientación para empezar")
                self.assertEqual(reply.source, "faq_fallback")
                self.assertIn("No tengo información verificada", reply.text)
                self.assertNotIn("private", reply.text)
                self.assertEqual(assistant.ask("¿Qué plan tengo?").text, "Tu plan es Pro y está activo.")
                self.assertEqual(assistant.ask("¿Aceptar una solicitud reserva un cupo?").source, "faq")
                run.assert_called_once()

    def test_short_responses(self):
        questions = [row[1] for row in CASES] + [
            "Plan y vencimiento y cupos", "¿Validación y publicación?",
            "Explica cómo publicar en detalle", "Cambia mi plan", "¿Cuál es mi deuda?",
        ]
        for question in questions:
            reply = self.make().ask(question)
            with self.subTest(question=question):
                self.assertLessEqual(len(re.split(r"(?<=[.!?])\s+", reply.text)), 3)
                self.assertLess(len(reply.text), 550)

    def test_answers_requested_fact_first(self):
        self.assertTrue(self.make().ask("¿Cuándo vence mi plan?").text.startswith("El vencimiento"))
        self.assertTrue(self.make().ask("¿Qué plan tengo y cuándo vence?").text.startswith("Tu plan es"))

    def test_missing_plan_never_invents_expiry(self):
        reply = self.make(actor=Principal("demo-b")).ask("¿Cuándo vence?")
        self.assertNotIn("2026", reply.text)
        self.assertIn("No tienes un plan", reply.text)

    def test_time_zone_and_missing_timestamp(self):
        provider = Mock()
        provider.plan.return_value = Plan("Pro", "active", datetime(2026, 10, 27, 1, tzinfo=timezone.utc))
        self.assertIn("26/10/2026 a las 22:00", self.make(queries=provider).ask("vencimiento").text)
        provider.plan.return_value = Plan("Pro", "active", None)
        self.assertIn("no tiene una fecha", self.make(queries=provider).ask("vencimiento").text)
        provider.plan.return_value = Plan("Pro", "active", datetime(2026, 1, 1))
        self.assertEqual(self.make(queries=provider).ask("vencimiento").source, "data_unavailable")

    def test_capacity_date_is_not_guessed(self):
        assistant = self.make()
        self.assertEqual(assistant.ask("cupos mañana").source, "data_unavailable")
        for question in ("cupos el viernes", "cupos el 27/10", "cupos el 31 de octubre", "cupos 2026-02-30"):
            self.assertEqual(understand(question, DEMO_DAY).intents, ("date_needed",))
        provider = Mock()
        provider.capacity.return_value = Capacity(date(2026, 10, 25), 8)
        self.assertEqual(self.make(queries=provider).ask("cupos").source, "data_unavailable")
        for count in (-1, True, "3"):
            provider.capacity.return_value = Capacity(DEMO_DAY, count)
            self.assertEqual(self.make(queries=provider).ask("cupos").source, "data_unavailable")

    def test_no_route_does_not_choose_one(self):
        self.assertIn("Selecciona un recorrido", self.make(route_id=None).ask("cupos").text)

    def test_unavailable_data_does_not_use_model_or_previous_answer(self):
        provider = Mock(wraps=SyntheticQueries())
        model = Mock()
        assistant = self.make(queries=provider, model=model)
        self.assertIn("3 cupos", assistant.ask("cupos").text)
        provider.capacity.side_effect = DataUnavailable
        self.assertEqual(assistant.ask("cupos").source, "data_unavailable")
        self.assertEqual(model.mock_calls, [])

    def test_unknown_and_actions_do_not_read_or_call_model(self):
        provider, model = Mock(), Mock()
        for question in ("¿Va a llover?", "Cambia mi plan", "Ejecuta SELECT * FROM cuentas",
                         "Borra mi recorrido", "Publica mi servicio", "¿Cuándo vence mi pago?"):
            self.make(queries=provider, model=model).ask(question)
        self.assertEqual(provider.mock_calls, [])
        self.assertEqual(model.mock_calls, [])

    def test_future_states_fail_closed(self):
        provider = Mock()
        provider.plan.return_value = Plan("inventado", "active", None)
        self.assertEqual(self.make(queries=provider).ask("plan").source, "data_unavailable")
        provider.publication.return_value = Publication("future", "false")
        for question in ("validación", "publicación"):
            self.assertEqual(self.make(queries=provider).ask(question).source, "data_unavailable")

    def test_inputs_and_many_topics(self):
        for text in ("", " ", None, "x" * 1001):
            self.assertEqual(self.make().ask(text).source, "input")
        self.assertEqual(self.make().ask("plan y vencimiento y cupos y validación").source, "input")

    def test_plan_quota_not_confused_with_route_seats(self):
        provider = Mock()
        reply = self.make(queries=provider).ask("¿Cuántos cupos del plan me quedan?")
        self.assertIn("límites de tu plan", reply.text)
        self.assertEqual(provider.mock_calls, [])


class IsolationTests(unittest.TestCase):
    def test_all_methods_check_roles_and_account(self):
        provider = SyntheticQueries()
        for actor in (Principal("unknown"), Principal("demo-a", "parent"),
                      Principal("demo-a", "admin"), Principal("demo-a", active=False)):
            for fn, args in ((provider.plan, ()), (provider.publication, ()),
                             (provider.route, ("demo-a-route",)),
                             (provider.capacity, ("demo-a-route", DEMO_DAY))):
                with self.subTest(actor=actor, method=fn.__name__), self.assertRaises(DataUnavailable):
                    fn(actor, *args)

    def test_cross_tenant_route_reads_denied_both_directions(self):
        provider = SyntheticQueries()
        for subject, other in (("demo-a", "demo-b"), ("demo-b", "demo-a")):
            actor = Principal(subject)
            with self.assertRaises(DataUnavailable):
                provider.route(actor, other + "-route")
            with self.assertRaises(DataUnavailable):
                provider.capacity(actor, other + "-route", DEMO_DAY)
        self.assertEqual(provider.capacity(Principal("demo-b"), "demo-b-route", DEMO_DAY).available, 0)

    def test_dtos_exclude_private_fields_and_mutators(self):
        from local_assistant.data import Capacity, Plan, Publication, Route
        fields = {f.name for cls in (Capacity, Plan, Publication, Route) for f in dataclasses.fields(cls)}
        self.assertTrue(fields.isdisjoint({"phone", "address", "email", "student", "password", "document"}))
        self.assertEqual({n for n in dir(SyntheticQueries) if not n.startswith("_")},
                         {"plan", "capacity", "publication", "route"})


if __name__ == "__main__":
    unittest.main()
