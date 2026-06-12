export type Visibility = "public" | "client";
export type ReportKind = "html" | "pdf" | "link";

export interface Client {
  id: string;
  slug: string;
  name: string;
  color: string;
  cover: string;
  initials: string;
  created_at: string;
}

export interface ClientMember {
  id: string;
  client_id: string;
  email: string;
  role: "admin" | "viewer";
}

export interface ReportStat {
  num: string;
  label: string;
}

export interface Report {
  id: string;
  client_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  kind: ReportKind;
  cover: string;
  badges: string[];
  stats: ReportStat[];
  edition: string | null;
  edition_label: string | null;
  canva_url: string | null;
  storage_path: string | null;
  external_url: string | null;
  published_at: string;
  created_at: string;
}

export const COVER_OPTIONS = [
  { cls: "accent-orange", hex: "#f26522" },
  { cls: "accent-wine", hex: "#722f37" },
  { cls: "accent-blue", hex: "#2563eb" },
  { cls: "accent-teal", hex: "#10b981" },
  { cls: "accent-purple", hex: "#8b5cf6" },
  { cls: "accent-slate", hex: "#475569" },
] as const;
