// Placeholder — will be auto-generated via `supabase gen types typescript`
// Run: pnpm --filter supabase generate-types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      teachers: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          department: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          department?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          department?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          roll_number: string;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          roll_number: string;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          roll_number?: string;
          phone?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          name: string;
          code: string;
          building: string;
          room_number: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          building: string;
          room_number: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          building?: string;
          room_number?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      class_schedules: {
        Row: {
          id: string;
          class_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      class_teacher_assignments: {
        Row: {
          id: string;
          class_id: string;
          teacher_id: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          teacher_id: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          teacher_id?: string;
        };
        Relationships: [];
      };
      class_enrollments: {
        Row: {
          id: string;
          class_id: string;
          student_id: string;
          enrolled_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          student_id: string;
          enrolled_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          student_id?: string;
          enrolled_at?: string;
        };
        Relationships: [];
      };
      class_locations: {
        Row: {
          id: string;
          class_id: string;
          latitude: number;
          longitude: number;
          radius_meters: number;
        };
        Insert: {
          id?: string;
          class_id: string;
          latitude: number;
          longitude: number;
          radius_meters?: number;
        };
        Update: {
          id?: string;
          class_id?: string;
          latitude?: number;
          longitude?: number;
          radius_meters?: number;
        };
        Relationships: [];
      };
      wifi_configs: {
        Row: {
          id: string;
          class_id: string;
          teacher_id: string;
          ssid: string;
          min_signal_dbm: number;
        };
        Insert: {
          id?: string;
          class_id: string;
          teacher_id: string;
          ssid: string;
          min_signal_dbm?: number;
        };
        Update: {
          id?: string;
          class_id?: string;
          teacher_id?: string;
          ssid?: string;
          min_signal_dbm?: number;
        };
        Relationships: [];
      };
      attendance_sessions: {
        Row: {
          id: string;
          class_id: string;
          teacher_id: string;
          session_date: string;
          started_at: string;
          expires_at: string;
          qr_payload: Json | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          class_id: string;
          teacher_id: string;
          session_date?: string;
          started_at?: string;
          expires_at: string;
          qr_payload?: Json | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          class_id?: string;
          teacher_id?: string;
          session_date?: string;
          started_at?: string;
          expires_at?: string;
          qr_payload?: Json | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          id: string;
          session_id: string;
          student_id: string;
          class_id: string;
          status: "present" | "absent" | "manual";
          scanned_at: string | null;
          gps_latitude: number | null;
          gps_longitude: number | null;
          geofence_passed: boolean | null;
          wifi_ssid_found: string | null;
          wifi_signal_dbm: number | null;
          wifi_passed: boolean | null;
          photo_url: string | null;
          marked_by: "system" | "teacher";
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          student_id: string;
          class_id: string;
          status?: "present" | "absent" | "manual";
          scanned_at?: string | null;
          gps_latitude?: number | null;
          gps_longitude?: number | null;
          geofence_passed?: boolean | null;
          wifi_ssid_found?: string | null;
          wifi_signal_dbm?: number | null;
          wifi_passed?: boolean | null;
          photo_url?: string | null;
          marked_by?: "system" | "teacher";
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          student_id?: string;
          class_id?: string;
          status?: "present" | "absent" | "manual";
          scanned_at?: string | null;
          gps_latitude?: number | null;
          gps_longitude?: number | null;
          geofence_passed?: boolean | null;
          wifi_ssid_found?: string | null;
          wifi_signal_dbm?: number | null;
          wifi_passed?: boolean | null;
          photo_url?: string | null;
          marked_by?: "system" | "teacher";
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
