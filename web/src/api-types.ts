// Generated from backend/openapi.json. Do not edit by hand.
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
export type Plans = {
  plans: { code: "basic" | "pro" | "elite"; display_label: string }[];
};
export type AdminSubscription = {
  publication: {
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
