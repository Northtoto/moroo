export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  subscription_tier: 'free' | 'premium';
  // Approval flow fields
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  rejection_reason: string | null;
  signup_source: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  image_url: string | null;
  is_published: boolean;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  content: Record<string, unknown> | null;
  order_index: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  progress: number;
  enrolled_at: string;
}

export interface TutorSession {
  id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
}

export interface Message {
  id: string;
  session_id: string;
  user_id: string;
  input_type: 'text' | 'audio' | 'image';
  original_content: string;
  corrected_content: string | null;
  explanation: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CorrectionResult {
  original: string;
  corrected: string;
  error_categories: string[];
  error_type?: string | null;
  confidence?: number;
  explanation_de?: string;
  cefr_estimate: string;
  new_vocabulary?: Array<{ word: string; translation: string; cefr: string }>;
  transcription?: string;
  inputType?: 'text' | 'audio' | 'image';
}
