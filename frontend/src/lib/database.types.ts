export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string
          session_id: string
          channel: 'voice' | 'text'
          status: 'active' | 'closed' | 'escalated'
          vapi_call_id: string | null
          created_at: string
          ended_at: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          session_id: string
          channel: 'voice' | 'text'
          status?: 'active' | 'closed' | 'escalated'
          vapi_call_id?: string | null
          created_at?: string
          ended_at?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          session_id?: string
          channel?: 'voice' | 'text'
          status?: 'active' | 'closed' | 'escalated'
          vapi_call_id?: string | null
          ended_at?: string | null
          metadata?: Json
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          audio_url: string | null
          transcript_confidence: number | null
          intent: string | null
          action_taken: 'answered' | 'clarified' | 'escalated' | 'declined' | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          audio_url?: string | null
          transcript_confidence?: number | null
          intent?: string | null
          action_taken?: 'answered' | 'clarified' | 'escalated' | 'declined' | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          audio_url?: string | null
          transcript_confidence?: number | null
          intent?: string | null
          action_taken?: 'answered' | 'clarified' | 'escalated' | 'declined' | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          id: string
          title: string
          content: string
          category: string
          source: string | null
          source_type: 'file' | 'url'
          file_name: string | null
          file_hash: string | null
          embedding_status: 'pending' | 'processing' | 'complete' | 'failed' | 'duplicate'
          chunk_count: number
          is_active: boolean
          error_details: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content?: string
          category: string
          source?: string | null
          source_type?: 'file' | 'url'
          file_name?: string | null
          file_hash?: string | null
          embedding_status?: 'pending' | 'processing' | 'complete' | 'failed'
          chunk_count?: number
          is_active?: boolean
          error_details?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          category?: string
          source?: string | null
          source_type?: 'file' | 'url'
          file_name?: string | null
          file_hash?: string | null
          embedding_status?: 'pending' | 'processing' | 'complete' | 'failed'
          chunk_count?: number
          is_active?: boolean
          error_details?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_embeddings: {
        Row: {
          id: string
          knowledge_base_id: string
          embedding: number[] | null
          chunk_text: string | null
          chunk_index: number
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          knowledge_base_id: string
          embedding?: number[] | null
          chunk_text?: string | null
          chunk_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          knowledge_base_id?: string
          embedding?: number[] | null
          chunk_text?: string | null
          chunk_index?: number
        }
        Relationships: []
      }
      escalations: {
        Row: {
          id: string
          conversation_id: string | null
          timestamp: string
          user_name: string
          user_email: string
          category: 'compliance' | 'account' | 'dispute' | 'transaction' | 'identity' | 'other'
          reason: string
          call_booked: boolean
          appointment_time: string | null
          appointment_timezone: string | null
          status: 'open' | 'in_progress' | 'closed'
          assigned_agent_id: string | null
          resolution_notes: string | null
          notification_sent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id?: string | null
          timestamp?: string
          user_name: string
          user_email: string
          category: 'compliance' | 'account' | 'dispute' | 'transaction' | 'identity' | 'other'
          reason: string
          call_booked?: boolean
          appointment_time?: string | null
          appointment_timezone?: string | null
          status?: 'open' | 'in_progress' | 'closed'
          assigned_agent_id?: string | null
          resolution_notes?: string | null
          notification_sent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string | null
          timestamp?: string
          user_name?: string
          user_email?: string
          category?: 'compliance' | 'account' | 'dispute' | 'transaction' | 'identity' | 'other'
          reason?: string
          call_booked?: boolean
          appointment_time?: string | null
          appointment_timezone?: string | null
          status?: 'open' | 'in_progress' | 'closed'
          assigned_agent_id?: string | null
          resolution_notes?: string | null
          notification_sent?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          id: string
          name: string
          email: string
          role: 'support' | 'admin' | 'supervisor'
          is_available: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          role?: 'support' | 'admin' | 'supervisor'
          is_available?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: 'support' | 'admin' | 'supervisor'
          is_available?: boolean
        }
        Relationships: []
      }
      intent_log: {
        Row: {
          id: string
          conversation_id: string | null
          message_id: string | null
          intent: string | null
          confidence: number | null
          rag_results_count: number | null
          action_taken: string | null
          escalation_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id?: string | null
          message_id?: string | null
          intent?: string | null
          confidence?: number | null
          rag_results_count?: number | null
          action_taken?: string | null
          escalation_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          intent?: string | null
          confidence?: number | null
          action_taken?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_knowledge: {
        Args: {
          query_embedding: number[]
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          title: string
          content: string
          category: string
          similarity: number
        }[]
      }
      hybrid_search_knowledge: {
        Args: {
          query_embedding: number[]
          query_text: string
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          title: string
          content: string
          chunk_text: string
          category: string
          similarity: number
          rrf_score: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
