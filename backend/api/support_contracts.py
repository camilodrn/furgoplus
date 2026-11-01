"""Task 12 help/support/assistant schemas kept separate from report contracts."""


def build_endpoints():
    from api.contracts import (
        DATETIME,
        INTEGER,
        STRING,
        Endpoint,
        control_object,
        control_page,
    )

    STATE = {
        "type": "string",
        "enum": ["open", "in_progress", "waiting_user", "resolved", "closed"],
    }
    PRIORITY = {"type": "string", "enum": ["standard", "preferred", "priority"]}
    SEVERITY = {"type": "integer", "enum": [1, 2, 3, 4]}
    TEXT = {"type": "string", "minLength": 1, "maxLength": 2000}
    EVENT = control_object(
        {
            "id": INTEGER,
            "author_id": INTEGER,
            "author_role": {"type": "string", "enum": ["driver", "parent", "admin"]},
            "body": STRING,
            "from_state": STRING,
            "to_state": STATE,
            "reason": STRING,
            "occurred_at": DATETIME,
        }
    )
    TICKET = control_object(
        {
            "id": INTEGER,
            "subject": STRING,
            "severity": SEVERITY,
            "state": STATE,
            "priority": PRIORITY,
            "priority_at_creation": PRIORITY,
            "version": INTEGER,
            "created_at": DATETIME,
            "updated_at": DATETIME,
        }
    )
    TICKET_DETAIL = control_object(
        {
            **TICKET["properties"],
            "allowed_transitions": {"type": "array", "items": STATE},
            "events": {"type": "array", "items": EVENT},
        }
    )
    TICKET_INPUT = control_object(
        {
            "subject": {**TEXT, "maxLength": 120},
            "body": TEXT,
            "severity": SEVERITY,
            "privacy_confirmed": {"type": "boolean", "const": True},
        }
    )
    REPLY_INPUT = control_object(
        {"body": TEXT, "expected_version": {**INTEGER, "minimum": 1}}
    )
    ADMIN_REPLY_INPUT = control_object(
        {
            **REPLY_INPUT["properties"],
            "body": {"type": "string", "maxLength": 2000},
            "state": STATE,
            "reason": {"type": "string", "maxLength": 300},
        }
    )
    HELP = control_object(
        {
            "version": STRING,
            "service_notice": STRING,
            "privacy_notice": STRING,
            "articles": {
                "type": "array",
                "items": control_object(
                    {
                        "id": STRING,
                        "role": {"type": "string", "enum": ["driver", "parent", "all"]},
                        "category": STRING,
                        "title": STRING,
                        "body": STRING,
                    }
                ),
            },
            "assistant_modes": {
                "type": "array",
                "items": {"type": "string", "enum": ["faq", "contextual"]},
            },
        }
    )
    ASSISTANT_INPUT = control_object(
        {
            "question": {**TEXT, "maxLength": 300},
            "mode": {"type": "string", "enum": ["faq", "contextual"]},
        }
    )
    ASSISTANT = control_object(
        {
            "answer": STRING,
            "article_id": {"type": ["string", "null"]},
            "context": {
                "type": "array",
                "items": control_object({"label": STRING, "value": STRING}),
            },
            "can_offer_ticket": {"type": "boolean", "const": True},
            "kind": {"type": "string", "const": "rules_and_content"},
            "content_version": STRING,
        }
    )
    ENDPOINTS = (
        Endpoint(
            "help/",
            "help-center",
            "get",
            "getHelpCenter",
            "Versioned role help and effective assistant modes",
            HELP,
        ),
        Endpoint(
            "support/tickets/",
            "support-list",
            "get",
            "getSupportTickets",
            "Own tickets only",
            control_page(TICKET),
        ),
        Endpoint(
            "support/tickets/",
            "support-create",
            "post",
            "createSupportTicket",
            "Confirm a private support request",
            TICKET_DETAIL,
            201,
            TICKET_INPUT,
        ),
        Endpoint(
            "support/tickets/{id}/",
            "support-detail",
            "get",
            "getSupportTicket",
            "Own support history",
            TICKET_DETAIL,
        ),
        Endpoint(
            "support/tickets/{id}/",
            "support-reply",
            "post",
            "replySupportTicket",
            "Reply to own ticket; reopen resolved",
            TICKET_DETAIL,
            200,
            REPLY_INPUT,
        ),
        Endpoint(
            "admin/support/tickets/",
            "admin-support-list",
            "get",
            "getAdminSupportTickets",
            "Severity then effective commercial priority; manage_support permission",
            control_page(TICKET),
        ),
        Endpoint(
            "admin/support/tickets/{id}/",
            "admin-support-detail",
            "get",
            "getAdminSupportTicket",
            "Support history only; manage_support permission",
            TICKET_DETAIL,
        ),
        Endpoint(
            "admin/support/tickets/{id}/",
            "admin-support-update",
            "post",
            "updateAdminSupportTicket",
            "Versioned support response/transition with audit reason",
            TICKET_DETAIL,
            200,
            ADMIN_REPLY_INPUT,
        ),
        Endpoint(
            "assistant/",
            "assistant",
            "post",
            "askAssistant",
            "Rule/content assistant; own scalar states for Elite; no mutation",
            ASSISTANT,
            200,
            ASSISTANT_INPUT,
        ),
    )
    return ENDPOINTS
