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
