// Generated from backend/openapi.json. Do not edit by hand.
export type HelpCenter = {
  version: string;
  service_notice: string;
  privacy_notice: string;
  articles: {
    id: string;
    role: "driver" | "parent" | "all";
    category: string;
    title: string;
    body: string;
  }[];
  assistant_modes: ("faq" | "contextual")[];
};
export type SupportTickets = {
  results: {
    id: number;
    subject: string;
    severity: 1 | 2 | 3 | 4;
    state: "open" | "in_progress" | "waiting_user" | "resolved" | "closed";
    priority: "standard" | "preferred" | "priority";
    priority_at_creation: "standard" | "preferred" | "priority";
    version: number;
    created_at: string;
    updated_at: string;
  }[];
  count: number;
};
export type SupportTicket = {
  id: number;
  subject: string;
  severity: 1 | 2 | 3 | 4;
  state: "open" | "in_progress" | "waiting_user" | "resolved" | "closed";
  priority: "standard" | "preferred" | "priority";
  priority_at_creation: "standard" | "preferred" | "priority";
  version: number;
  created_at: string;
  updated_at: string;
  allowed_transitions: (
    | "open"
    | "in_progress"
    | "waiting_user"
    | "resolved"
    | "closed"
  )[];
  events: {
    id: number;
    author_id: number;
    author_role: "driver" | "parent" | "admin";
    body: string;
    from_state: string;
    to_state: "open" | "in_progress" | "waiting_user" | "resolved" | "closed";
    reason: string;
    occurred_at: string;
  }[];
};
export type SupportTicketInput = {
  subject: string;
  body: string;
  severity: 1 | 2 | 3 | 4;
  privacy_confirmed: true;
};
export type SupportReplyInput = { body: string; expected_version: number };
export type AdminSupportInput = {
  body: string;
  expected_version: number;
  state: "open" | "in_progress" | "waiting_user" | "resolved" | "closed";
  reason: string;
};
export type AssistantInput = { question: string; mode: "faq" | "contextual" };
export type AssistantAnswer = {
  answer: string;
  article_id: string | null;
  context: { label: string; value: string }[];
  can_offer_ticket: true;
  kind: "rules_and_content";
  content_version: string;
};
export type MonthlyReport = {
  period: {
    month: string;
    start: string;
    end_exclusive: string;
    timezone: "America/Santiago";
  };
  generated_at: string;
  summary: {
    payments: {
      pending: { count: number; amount_clp: number };
      paid: { count: number; amount_clp: number };
      void: { count: number; amount_clp: number };
    };
    payment_count: number;
    non_void_amount_clp: number;
    runs: { planned: number; in_progress: number; completed: number };
    run_count: number;
    recorded_capacity_total: number;
    contacts: {
      pending: number;
      accepted: number;
      declined: number;
      cancelled: number;
    };
    contact_count: number;
  };
  current_capacity: {
    as_of: string;
    routes: {
      route_id: number;
      status: string;
      seat_capacity: number;
      next_service_date: string;
      used_seats: number;
      available_seats: number;
    }[];
  };
  notes: string[];
};
export type AdvancedReport = {
  period: {
    month: string;
    start: string;
    end_exclusive: string;
    timezone: "America/Santiago";
  };
  generated_at: string;
  summary: {
    payments: {
      pending: { count: number; amount_clp: number };
      paid: { count: number; amount_clp: number };
      void: { count: number; amount_clp: number };
    };
    payment_count: number;
    non_void_amount_clp: number;
    runs: { planned: number; in_progress: number; completed: number };
    run_count: number;
    recorded_capacity_total: number;
    contacts: {
      pending: number;
      accepted: number;
      declined: number;
      cancelled: number;
    };
    contact_count: number;
  };
  current_capacity: {
    as_of: string;
    routes: {
      route_id: number;
      status: string;
      seat_capacity: number;
      next_service_date: string;
      used_seats: number;
      available_seats: number;
    }[];
  };
  notes: string[];
  previous: {
    period: {
      month: string;
      start: string;
      end_exclusive: string;
      timezone: "America/Santiago";
    };
    summary: {
      payments: {
        pending: { count: number; amount_clp: number };
        paid: { count: number; amount_clp: number };
        void: { count: number; amount_clp: number };
      };
      payment_count: number;
      non_void_amount_clp: number;
      runs: { planned: number; in_progress: number; completed: number };
      run_count: number;
      recorded_capacity_total: number;
      contacts: {
        pending: number;
        accepted: number;
        declined: number;
        cancelled: number;
      };
      contact_count: number;
    };
  };
  details: {
    payments: {
      id: number;
      service_period_start: string;
      service_period_end: string;
      due_on: string;
      status: string;
      amount_clp: number;
    }[];
    runs: {
      id: number;
      route_id: number;
      service_date: string;
      state: string;
      seat_capacity_snapshot: number;
      start_time_snapshot: string;
      end_time_snapshot: string;
    }[];
    contacts: {
      id: number;
      created_at: string;
      status: string;
      resolved_at: string | null;
    }[];
  };
};
export type DriverCapabilities = {
  catalog_version: string;
  evaluated_at: string;
  plan: {
    code: "basic" | "pro" | "elite";
    label: string;
    monthly_price_clp: number;
    currency: "CLP";
    billing_period: "month";
    commercial_proposal: true;
    automatic_billing: false;
    support_priority: "standard" | "preferred" | "priority";
  } | null;
  subscription: {
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    effective: boolean;
  } | null;
  blockers: string[];
  capabilities: {
    "operations.core": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "dashboard.basic": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "reports.monthly.read": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "reports.detail.read": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "reports.xlsx.export": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "analytics.period_comparison": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "help.center": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "support.requests": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "assistant.faq": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
    "assistant.contextual": {
      included_in_plan: boolean;
      implemented: boolean;
      enabled: boolean;
      blockers: string[];
    };
  };
};
export type Health = { status: "ok" };
export type Csrf = { csrf_token: string };
export type Identity = {
  id: number;
  email: string;
  role: "parent" | "driver" | "admin";
  display_name: string | null;
};
export type LoginResponse = {
  id: number;
  email: string;
  role: "parent" | "driver" | "admin";
  display_name: string | null;
  csrf_token: string;
};
export type RegisterRequest = {
  email: string;
  password: string;
  role: "parent" | "driver";
  display_name: string;
};
export type LoginRequest = { email: string; password: string };
export type LogoutResponse = { ok: true };
export type DriverProfile = {
  display_name: string;
  service_summary: string;
  service_contact_email: string;
  validation_state: string;
  current_validation_revision: number;
  approved_revision: number | null;
};
export type DriverProfileUpdate = {
  display_name?: string;
  service_summary?: string;
  service_contact_email?: string;
};
export type DriverChecklist = {
  demo_only: true;
  allowed_content_types: string[];
  max_bytes: number;
  items: { kind: string; label: string; requires_expiry: boolean }[];
};
export type DriverDocuments = {
  documents: {
    id: number;
    version: number;
    kind: string;
    content_type: string;
    byte_size: number;
    uploaded_at: string;
    expires_on: string | null;
    is_current: boolean;
  }[];
};
export type DriverDocument = {
  id: number;
  version: number;
  kind: string;
  content_type: string;
  byte_size: number;
  uploaded_at: string;
  expires_on: string | null;
  is_current: boolean;
};
export type DriverValidations = {
  validation_state: string;
  current_validation_revision: number;
  approved_revision: number | null;
  validations: {
    id: number;
    revision: number;
    state: "pending" | "approved" | "rejected" | "superseded";
    submitted_at: string;
    reviewed_at: string | null;
    observations: string | null;
    display_name_snapshot: string;
    documents: {
      id: number;
      version: number;
      kind: string;
      content_type: string;
      byte_size: number;
      uploaded_at: string;
      expires_on: string | null;
    }[];
  }[];
};
export type DriverValidation = {
  id: number;
  revision: number;
  state: "pending" | "approved" | "rejected" | "superseded";
  submitted_at: string;
  reviewed_at: string | null;
  observations: string | null;
  display_name_snapshot: string;
  documents: {
    id: number;
    version: number;
    kind: string;
    content_type: string;
    byte_size: number;
    uploaded_at: string;
    expires_on: string | null;
  }[];
};
export type AdminDrivers = {
  results: {
    id: number;
    display_name: string;
    email: string;
    profile_version: number | null;
    publication: {
      profile_status: "active" | "suspended" | "deactivated";
      publication_requested: boolean;
      eligible: boolean;
      blockers: {
        code:
          | "account_inactive"
          | "driver_suspended"
          | "driver_deactivated"
          | "publication_not_requested"
          | "validation_not_approved"
          | "approved_revision_stale"
          | "required_document_missing"
          | "required_document_expired"
          | "subscription_missing"
          | "subscription_inactive"
          | "subscription_suspended"
          | "subscription_not_started"
          | "subscription_expired"
          | "profile_display_name_missing"
          | "profile_summary_missing"
          | "service_contact_email_missing"
          | "active_route_missing";
        message: string;
      }[];
      validation_state: "draft" | "pending" | "approved" | "rejected";
      current_validation_revision: number;
      approved_revision: number | null;
      subscription: {
        plan_code: "basic" | "pro" | "elite";
        plan_label: string;
        status: "inactive" | "active" | "suspended";
        starts_at: string | null;
        ends_at: string | null;
      } | null;
      active_route_count: number;
      coverage: { code: string; display_name: string }[];
    };
  }[];
  count: number;
};
export type AdminDriver = {
  id: number;
  display_name: string;
  email: string;
  profile_version: number | null;
  publication: {
    profile_status: "active" | "suspended" | "deactivated";
    publication_requested: boolean;
    eligible: boolean;
    blockers: {
      code:
        | "account_inactive"
        | "driver_suspended"
        | "driver_deactivated"
        | "publication_not_requested"
        | "validation_not_approved"
        | "approved_revision_stale"
        | "required_document_missing"
        | "required_document_expired"
        | "subscription_missing"
        | "subscription_inactive"
        | "subscription_suspended"
        | "subscription_not_started"
        | "subscription_expired"
        | "profile_display_name_missing"
        | "profile_summary_missing"
        | "service_contact_email_missing"
        | "active_route_missing";
      message: string;
    }[];
    validation_state: "draft" | "pending" | "approved" | "rejected";
    current_validation_revision: number;
    approved_revision: number | null;
    subscription: {
      plan_code: "basic" | "pro" | "elite";
      plan_label: string;
      status: "inactive" | "active" | "suspended";
      starts_at: string | null;
      ends_at: string | null;
    } | null;
    active_route_count: number;
    coverage: { code: string; display_name: string }[];
  };
};
export type ProfileStatusInput = {
  status: "active" | "suspended" | "deactivated";
  expected_status: "active" | "suspended" | "deactivated";
  expected_version: number | null;
  reason: string;
};
export type AdminDriverHistory = {
  results: {
    id: number;
    actor: { id: number; display_name: string };
    action:
      | "profile_status_changed"
      | "subscription_changed"
      | "validation_approved"
      | "validation_rejected"
      | "document_read";
    target_type: "driver_profile" | "subscription" | "validation" | "document";
    target_id: number;
    occurred_at: string;
    correlation_id: string;
    reason: string;
    before: {
      status?: string;
      plan_code?: "basic" | "pro" | "elite";
      starts_at?: string | null;
      ends_at?: string | null;
    };
    after: {
      status?: string;
      plan_code?: "basic" | "pro" | "elite";
      starts_at?: string | null;
      ends_at?: string | null;
    };
  }[];
  count: number;
};
export type AdminDriverValidations = {
  results: {
    id: number;
    revision: number;
    state: "pending" | "approved" | "rejected" | "superseded";
    submitted_at: string;
    reviewed_at: string | null;
    observations: string | null;
    display_name_snapshot: string;
  }[];
  count: number;
};
export type AdminValidations = {
  results: {
    id: number;
    revision: number;
    state: "pending" | "approved" | "rejected" | "superseded";
    submitted_at: string;
    reviewed_at: string | null;
    observations: string | null;
    display_name_snapshot: string;
    comparison: {
      previous_revision: number | null;
      changed_document_count: number;
      unchanged_document_count: number;
      changed_identity_field_count: number;
      has_material_changes: boolean;
      document_changes: {
        kind: string;
        status: "unchanged" | "replaced" | "added" | "removed";
        previous_version: number | null;
        current_version: number | null;
        previous_content_type: string | null;
        current_content_type: string | null;
        previous_expires_on: string | null;
        current_expires_on: string | null;
      }[];
      identity_changes: {
        field: "display_name";
        previous_value: string;
        current_value: string;
      }[];
    };
    driver: { id: number; display_name: string; email: string };
  }[];
};
export type AdminValidation = {
  id: number;
  revision: number;
  state: "pending" | "approved" | "rejected" | "superseded";
  submitted_at: string;
  reviewed_at: string | null;
  observations: string | null;
  display_name_snapshot: string;
  comparison: {
    previous_revision: number | null;
    changed_document_count: number;
    unchanged_document_count: number;
    changed_identity_field_count: number;
    has_material_changes: boolean;
    document_changes: {
      kind: string;
      status: "unchanged" | "replaced" | "added" | "removed";
      previous_version: number | null;
      current_version: number | null;
      previous_content_type: string | null;
      current_content_type: string | null;
      previous_expires_on: string | null;
      current_expires_on: string | null;
    }[];
    identity_changes: {
      field: "display_name";
      previous_value: string;
      current_value: string;
    }[];
  };
  driver: { id: number; display_name: string; email: string };
  documents: {
    id: number;
    version: number;
    kind: string;
    content_type: string;
    byte_size: number;
    uploaded_at: string;
    expires_on: string | null;
  }[];
};
export type ObservationInput = { observations: string };
export type Publication = {
  profile_status: "active" | "suspended" | "deactivated";
  publication_requested: boolean;
  eligible: boolean;
  blockers: {
    code:
      | "account_inactive"
      | "driver_suspended"
      | "driver_deactivated"
      | "publication_not_requested"
      | "validation_not_approved"
      | "approved_revision_stale"
      | "required_document_missing"
      | "required_document_expired"
      | "subscription_missing"
      | "subscription_inactive"
      | "subscription_suspended"
      | "subscription_not_started"
      | "subscription_expired"
      | "profile_display_name_missing"
      | "profile_summary_missing"
      | "service_contact_email_missing"
      | "active_route_missing";
    message: string;
  }[];
  validation_state: "draft" | "pending" | "approved" | "rejected";
  current_validation_revision: number;
  approved_revision: number | null;
  subscription: {
    plan_code: "basic" | "pro" | "elite";
    plan_label: string;
    status: "inactive" | "active" | "suspended";
    starts_at: string | null;
    ends_at: string | null;
  } | null;
  active_route_count: number;
  coverage: { code: string; display_name: string }[];
};
export type PublicationInput = { publication_requested: boolean };
export type Communes = { communes: { code: string; display_name: string }[] };
export type Routes = {
  routes: {
    id: number;
    revision: number;
    next_service_date: string;
    used_seats: number;
    available_seats: number;
    label: string;
    status: "active" | "inactive";
    weekdays: (
      | "monday"
      | "tuesday"
      | "wednesday"
      | "thursday"
      | "friday"
      | "saturday"
      | "sunday"
    )[];
    start_time: string;
    end_time: string;
    seat_capacity: number;
    destination_label: string;
    destination_address: string;
    coverage_codes: string[];
  }[];
};
export type Route = {
  id: number;
  revision: number;
  next_service_date: string;
  used_seats: number;
  available_seats: number;
  label: string;
  status: "active" | "inactive";
  weekdays: (
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday"
  )[];
  start_time: string;
  end_time: string;
  seat_capacity: number;
  destination_label: string;
  destination_address: string;
  coverage_codes: string[];
};
export type RouteInput = {
  label: string;
  status: "active" | "inactive";
  weekdays: (
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday"
  )[];
  start_time: string;
  end_time: string;
  seat_capacity: number;
  destination_label: string;
  destination_address: string;
  coverage_codes: string[];
};
export type RouteUpdate = {
  label: string;
  status: "active" | "inactive";
  weekdays: (
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday"
  )[];
  start_time: string;
  end_time: string;
  seat_capacity: number;
  destination_label: string;
  destination_address: string;
  coverage_codes: string[];
  expected_revision: number;
};
export type DriverSummary = {
  publication: {
    profile_status: "active" | "suspended" | "deactivated";
    publication_requested: boolean;
    eligible: boolean;
    blockers: {
      code:
        | "account_inactive"
        | "driver_suspended"
        | "driver_deactivated"
        | "publication_not_requested"
        | "validation_not_approved"
        | "approved_revision_stale"
        | "required_document_missing"
        | "required_document_expired"
        | "subscription_missing"
        | "subscription_inactive"
        | "subscription_suspended"
        | "subscription_not_started"
        | "subscription_expired"
        | "profile_display_name_missing"
        | "profile_summary_missing"
        | "service_contact_email_missing"
        | "active_route_missing";
      message: string;
    }[];
    validation_state: "draft" | "pending" | "approved" | "rejected";
    current_validation_revision: number;
    approved_revision: number | null;
    subscription: {
      plan_code: "basic" | "pro" | "elite";
      plan_label: string;
      status: "inactive" | "active" | "suspended";
      starts_at: string | null;
      ends_at: string | null;
    } | null;
    active_route_count: number;
    coverage: { code: string; display_name: string }[];
  };
  routes: {
    id: number;
    label: string;
    status: "active" | "inactive";
    seat_capacity: number;
    next_service_date: string;
    used_seats: number;
    available_seats: number;
  }[];
  active_assignments: number;
  payment_counts: { pending: number; paid: number; void: number };
};
export type Assignments = {
  assignments: {
    route_id: number;
    student_display_name: string;
    pickup_instruction: string;
    guardian_display_name: string;
    guardian_contact: string;
    starts_on: string;
    ends_on: string | null;
    id: number;
    created_at: string;
    updated_at: string;
  }[];
};
export type Assignment = {
  route_id: number;
  student_display_name: string;
  pickup_instruction: string;
  guardian_display_name: string;
  guardian_contact: string;
  starts_on: string;
  ends_on: string | null;
  id: number;
  created_at: string;
  updated_at: string;
};
export type AssignmentInput = {
  route_id: number;
  student_display_name: string;
  pickup_instruction: string;
  guardian_display_name: string;
  guardian_contact: string;
  starts_on: string;
  ends_on: string | null;
};
export type AssignmentUpdate = {
  route_id?: number;
  student_display_name?: string;
  pickup_instruction?: string;
  guardian_display_name?: string;
  guardian_contact?: string;
  starts_on?: string;
  ends_on?: string | null;
};
export type Payments = {
  payments: {
    assignment_id: number;
    service_period_start: string;
    service_period_end: string;
    amount_clp: number;
    due_on: string;
    id: number;
    status: "pending" | "paid" | "void";
    paid_at: string | null;
    created_at: string;
    updated_at: string;
  }[];
};
export type Payment = {
  assignment_id: number;
  service_period_start: string;
  service_period_end: string;
  amount_clp: number;
  due_on: string;
  id: number;
  status: "pending" | "paid" | "void";
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};
export type PaymentInput = {
  assignment_id: number;
  service_period_start: string;
  service_period_end: string;
  amount_clp: number;
  due_on: string;
};
export type Plans = {
  plans: { code: "basic" | "pro" | "elite"; display_label: string }[];
};
export type AdminSubscription = {
  publication: {
    profile_status: "active" | "suspended" | "deactivated";
    publication_requested: boolean;
    eligible: boolean;
    blockers: {
      code:
        | "account_inactive"
        | "driver_suspended"
        | "driver_deactivated"
        | "publication_not_requested"
        | "validation_not_approved"
        | "approved_revision_stale"
        | "required_document_missing"
        | "required_document_expired"
        | "subscription_missing"
        | "subscription_inactive"
        | "subscription_suspended"
        | "subscription_not_started"
        | "subscription_expired"
        | "profile_display_name_missing"
        | "profile_summary_missing"
        | "service_contact_email_missing"
        | "active_route_missing";
      message: string;
    }[];
    validation_state: "draft" | "pending" | "approved" | "rejected";
    current_validation_revision: number;
    approved_revision: number | null;
    subscription: {
      plan_code: "basic" | "pro" | "elite";
      plan_label: string;
      status: "inactive" | "active" | "suspended";
      starts_at: string | null;
      ends_at: string | null;
    } | null;
    active_route_count: number;
    coverage: { code: string; display_name: string }[];
  };
  version: number | null;
};
export type SubscriptionInput = {
  plan_code: "basic" | "pro" | "elite";
  status: "inactive" | "active" | "suspended";
  starts_at: string | null;
  ends_at: string | null;
  reason: string;
  expected_version: number | null;
};
export type DiscoveryDrivers = {
  results: {
    id: number;
    display_name: string;
    service_summary: string;
    validation_label: "Validado";
    coverage: { code: string; display_name: string }[];
    routes: {
      id: number;
      label: string;
      weekdays: (
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      )[];
      start_time: string;
      end_time: string;
      seat_capacity: number;
      used_seats: number;
      available_seats: number;
      next_service_date: string;
      coverage: { code: string; display_name: string }[];
    }[];
    review_average: number | null;
    review_count: number;
  }[];
};
export type DiscoveryDriver = {
  id: number;
  display_name: string;
  service_summary: string;
  validation_label: "Validado";
  coverage: { code: string; display_name: string }[];
  routes: {
    id: number;
    label: string;
    weekdays: (
      | "monday"
      | "tuesday"
      | "wednesday"
      | "thursday"
      | "friday"
      | "saturday"
      | "sunday"
    )[];
    start_time: string;
    end_time: string;
    seat_capacity: number;
    used_seats: number;
    available_seats: number;
    next_service_date: string;
    coverage: { code: string; display_name: string }[];
  }[];
  review_average: number | null;
  review_count: number;
  reviews: {
    score: number;
    text: string;
    created_at: string;
    created_on: string;
    is_demo: boolean;
  }[];
};
export type DriverContactRequests = {
  results: {
    id: number;
    message: string;
    status: "pending" | "accepted" | "declined" | "cancelled";
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    parent_display_name: string;
    parent_email: string;
  }[];
};
export type DriverContactRequest = {
  id: number;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  parent_display_name: string;
  parent_email: string;
};
