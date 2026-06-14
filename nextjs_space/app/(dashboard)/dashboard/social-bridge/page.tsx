'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n-context';
import { useWorkspace } from '@/lib/workspace-context';
import {
  Share2, Wifi, WifiOff, Chrome, Download, Send, Clock,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Brain,
  Twitter, Instagram, Facebook, Linkedin, Music2, Pin,
  AtSign, Youtube, Plus, Eye, Trash2, ExternalLink, Filter,
  Calendar, Shield, Zap, Sparkles, Play, RotateCcw, Target,
  TrendingUp, Palette, CalendarClock, Crown, Lock,
  Pause, Pencil, X, Save
} from 'lucide-react';

/* ═══════════════ Types ═══════════════ */
interface ExtensionStatus {
  isOnline: boolean;
  version: string | null;
  lastPing: string | null;
  connectedPlatforms: string[];
}

interface SocialConnectionInfo {
  platform: string;
  isConnected: boolean;
  username: string | null;
  lastSeen: string | null;
}

interface SocialPostItem {
  id: string;
  platform: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  status: string;
  platformUrl: string | null;
  errorMessage: string | null;
  source: string | null;
  scheduledFor: string | null;
  createdAt: string;
  publishedAt: string | null;
}

interface TrainingPatternItem {
  id: string;
  platform: string;
  actionType: string;
  steps: Array<Record<string, unknown>>;
  version: number;
  successCount: number;
  failCount: number;
}

/* ═══════════════ Content Type Config ═══════════════ */
type ContentTypeKey = 'text' | 'image' | 'video' | 'story' | 'reel' | 'thread' | 'carousel' | 'article' | 'pin' | 'community' | 'short';
const CONTENT_TYPE_LABELS_DEF: Record<ContentTypeKey, { en: string; es: string; emoji: string }> = {
  text: { en: 'Text', es: 'Texto', emoji: '📝' },
  image: { en: 'Image', es: 'Imagen', emoji: '🖼️' },
  video: { en: 'Video', es: 'Video', emoji: '🎬' },
  story: { en: 'Story', es: 'Historia', emoji: '⏳' },
  reel: { en: 'Reel', es: 'Reel', emoji: '🎞️' },
  thread: { en: 'Thread', es: 'Hilo', emoji: '🧵' },
  carousel: { en: 'Carousel', es: 'Carrusel', emoji: '📸' },
  article: { en: 'Article', es: 'Artículo', emoji: '📰' },
  pin: { en: 'Pin', es: 'Pin', emoji: '📌' },
  community: { en: 'Community', es: 'Comunidad', emoji: '💬' },
  short: { en: 'Short', es: 'Short', emoji: '⚡' },
};
function buildContentTypeLabels(isEn: boolean): Record<ContentTypeKey, { label: string; emoji: string }> {
  const result = {} as Record<ContentTypeKey, { label: string; emoji: string }>;
  for (const [k, v] of Object.entries(CONTENT_TYPE_LABELS_DEF)) {
    result[k as ContentTypeKey] = { label: isEn ? v.en : v.es, emoji: v.emoji };
  }
  return result;
}

/* ═══════════════ Platform Config ═══════════════ */
const PLATFORMS: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; contentTypes: ContentTypeKey[] }> = {
  twitter: { icon: <Twitter className="w-5 h-5" />, label: 'Twitter / X', color: '#1DA1F2', bg: 'rgba(29,161,242,0.1)', contentTypes: ['text', 'image', 'thread'] },
  instagram: { icon: <Instagram className="w-5 h-5" />, label: 'Instagram', color: '#E4405F', bg: 'rgba(228,64,95,0.1)', contentTypes: ['image', 'carousel', 'story', 'reel'] },
  facebook: { icon: <Facebook className="w-5 h-5" />, label: 'Facebook', color: '#1877F2', bg: 'rgba(24,119,242,0.1)', contentTypes: ['text', 'image', 'video', 'story', 'reel'] },
  linkedin: { icon: <Linkedin className="w-5 h-5" />, label: 'LinkedIn', color: '#0A66C2', bg: 'rgba(10,102,194,0.1)', contentTypes: ['text', 'image', 'video', 'article'] },
  tiktok: { icon: <Music2 className="w-5 h-5" />, label: 'TikTok', color: '#FF0050', bg: 'rgba(255,0,80,0.1)', contentTypes: ['video', 'image'] },
  pinterest: { icon: <Pin className="w-5 h-5" />, label: 'Pinterest', color: '#E60023', bg: 'rgba(230,0,35,0.1)', contentTypes: ['image', 'pin'] },
  threads: { icon: <AtSign className="w-5 h-5" />, label: 'Threads', color: '#000000', bg: 'rgba(0,0,0,0.05)', contentTypes: ['text', 'image'] },
  youtube: { icon: <Youtube className="w-5 h-5" />, label: 'YouTube', color: '#FF0000', bg: 'rgba(255,0,0,0.1)', contentTypes: ['community', 'video', 'short'] },
};

const STATUS_CONFIG_DEF: Record<string, { icon: React.ReactNode; color: string; en: string; es: string }> = {
  pending: { icon: <Clock className="w-4 h-4" />, color: '#f59e0b', en: 'Pending', es: 'Pendiente' },
  queued: { icon: <Clock className="w-4 h-4" />, color: '#8B5CF6', en: 'Queued', es: 'En cola' },
  paused: { icon: <Pause className="w-4 h-4" />, color: '#f59e0b', en: 'Paused', es: 'Pausado' },
  publishing: { icon: <RefreshCw className="w-4 h-4 animate-spin" />, color: '#3B82F6', en: 'Publishing...', es: 'Publicando...' },
  published: { icon: <CheckCircle2 className="w-4 h-4" />, color: '#4ade80', en: 'Published', es: 'Publicado' },
  failed: { icon: <XCircle className="w-4 h-4" />, color: '#f87171', en: 'Error', es: 'Error' },
};
function buildStatusConfig(isEn: boolean): Record<string, { icon: React.ReactNode; color: string; label: string }> {
  const result: Record<string, { icon: React.ReactNode; color: string; label: string }> = {};
  for (const [k, v] of Object.entries(STATUS_CONFIG_DEF)) {
    result[k] = { icon: v.icon, color: v.color, label: isEn ? v.en : v.es };
  }
  return result;
}

/* ═══════════════ Component ═══════════════ */
export default function SocialBridgePage() {
  const { locale } = useI18n();
  const isEn = locale === 'en';
  const CONTENT_TYPE_LABELS = buildContentTypeLabels(isEn);
  const STATUS_CONFIG = buildStatusConfig(isEn);
  const { data: session } = useSession() || {};
  const { activeWorkspace } = useWorkspace();
  const [tab, setTab] = useState<'overview' | 'publish' | 'history' | 'scheduler' | 'training'>('overview');
  const [extension, setExtension] = useState<ExtensionStatus | null>(null);
  const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
  const [posts, setPosts] = useState<SocialPostItem[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [platformStats, setPlatformStats] = useState<Record<string, number>>({});
  const [patterns, setPatterns] = useState<TrainingPatternItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // New post form
  const [newPost, setNewPost] = useState({ platform: '', content: '', mediaUrl: '', contentType: '', source: 'manual', scheduledFor: '' });
  const [scheduledPosts, setScheduledPosts] = useState<SocialPostItem[]>([]);

  // Filters
  const [historyFilter, setHistoryFilter] = useState<string>('all');

  // Edit modal state
  const [editingPost, setEditingPost] = useState<SocialPostItem | null>(null);
  const [editForm, setEditForm] = useState({ content: '', scheduledFor: '' });

  // LinkedIn API state
  const [linkedinApi, setLinkedinApi] = useState<{ connected: boolean; username?: string; profileImage?: string; isExpired?: boolean; message?: string } | null>(null);

  // SSE connection state
  const [sseConnected, setSseConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/social-bridge/status');
      if (res.ok) {
        const data = await res.json();
        setExtension(data.extension);
        setConnections(data.connections);
      }
    } catch (e) { console.error('Status fetch error:', e); }
    // Also check LinkedIn API status
    try {
      const liRes = await fetch('/api/social-bridge/linkedin/status');
      if (liRes.ok) {
        const liData = await liRes.json();
        setLinkedinApi(liData);
        // If LinkedIn API is connected, update connections list
        if (liData.connected) {
          setConnections(prev => {
            const others = prev.filter(c => c.platform !== 'linkedin');
            return [...others, {
              platform: 'linkedin',
              isConnected: true,
              username: liData.username || null,
              lastSeen: new Date().toISOString(),
            }];
          });
        }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/social-bridge/history');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
        setStats(data.stats);
        setPlatformStats(data.platformStats);
      }
    } catch (e) { console.error('History fetch error:', e); }
  }, []);

  const deletePost = useCallback(async (id: string) => {
    if (!confirm(isEn ? 'Delete this post from history?' : '¿Eliminar esta publicación del historial?')) return;
    try {
      const res = await fetch(`/api/social-bridge/history?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id));
      }
    } catch (e) { console.error('Delete error:', e); }
  }, []);

  const deleteAllPosts = useCallback(async () => {
    if (!confirm(isEn ? 'Delete ALL post history? This action cannot be undone.' : '¿Borrar TODO el historial de publicaciones? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch('/api/social-bridge/history?all=true', { method: 'DELETE' });
      if (res.ok) {
        setPosts([]);
        setStats({});
        setPlatformStats({});
      }
    } catch (e) { console.error('Delete all error:', e); }
  }, []);

  // Delete a scheduled post
  const deleteScheduledPost = useCallback(async (id: string) => {
    if (!confirm(isEn ? 'Delete this scheduled post?' : '¿Eliminar esta publicación programada?')) return;
    try {
      const res = await fetch(`/api/social-bridge/history?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setScheduledPosts(prev => prev.filter(p => p.id !== id));
      }
    } catch (e) { console.error('Delete scheduled error:', e); }
  }, []);

  // Pause/Resume a scheduled post
  const togglePausePost = useCallback(async (post: SocialPostItem) => {
    const newStatus = post.status === 'paused' ? 'queued' : 'paused';
    try {
      const res = await fetch('/api/social-bridge/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, status: newStatus })
      });
      if (res.ok) {
        setScheduledPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: newStatus } : p));
      }
    } catch (e) { console.error('Toggle pause error:', e); }
  }, []);

  // Open edit modal
  const openEditModal = useCallback((post: SocialPostItem) => {
    setEditingPost(post);
    setEditForm({
      content: post.content,
      scheduledFor: post.scheduledFor ? new Date(post.scheduledFor).toISOString().slice(0, 16) : ''
    });
  }, []);

  // Save edited post
  const saveEditedPost = useCallback(async () => {
    if (!editingPost) return;
    try {
      const res = await fetch('/api/social-bridge/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPost.id,
          content: editForm.content,
          scheduledFor: editForm.scheduledFor ? new Date(editForm.scheduledFor).toISOString() : null
        })
      });
      if (res.ok) {
        const data = await res.json();
        setScheduledPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, ...data.post } : p));
        setEditingPost(null);
      }
    } catch (e) { console.error('Save edit error:', e); }
  }, [editingPost, editForm]);

  const fetchTraining = useCallback(async () => {
    try {
      const res = await fetch('/api/social-bridge/training');
      if (res.ok) {
        const data = await res.json();
        setPatterns(data.patterns);
      }
    } catch (e) { console.error('Training fetch error:', e); }
  }, []);

  const fetchScheduled = useCallback(async () => {
    try {
      const res = await fetch('/api/social-bridge/scheduler', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setScheduledPosts(data.scheduled || []);
      }
    } catch (e) { console.error('Scheduled fetch error:', e); }
  }, []);

  // Handle URL params — from Creative Studio "Send to Social Bridge" or LinkedIn OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // LinkedIn OAuth redirect
    if (params.get('linkedin_connected') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('linkedin_error')) {
      console.error('[Social Bridge] LinkedIn OAuth error:', params.get('linkedin_error'));
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Pre-fill from Creative Studio or other modules
    const mediaUrl = params.get('mediaUrl');
    const content = params.get('content');
    const contentType = params.get('contentType');
    const source = params.get('source');
    const title = params.get('title');

    if (mediaUrl || content || source) {
      setNewPost(prev => ({
        ...prev,
        mediaUrl: mediaUrl || prev.mediaUrl,
        content: content || (title ? `${title}` : prev.content),
        contentType: contentType || prev.contentType,
        source: source || prev.source,
      }));
      // Auto-switch to publish tab
      setTab('publish');
      // Clean URL to avoid re-triggering
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Refresh data when workspace changes
  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  // Initial data load + SSE real-time connection
  useEffect(() => {
    Promise.all([fetchStatus(), fetchHistory(), fetchTraining(), fetchScheduled()]).finally(() => setLoading(false));

    // Connect to SSE stream for real-time updates
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    function connectSSE() {
      if (eventSource) { try { eventSource.close(); } catch {} }
      eventSource = new EventSource('/api/social-bridge/events?source=dashboard');
      sseRef.current = eventSource;

      eventSource.onopen = () => {
        setSseConnected(true);
        console.log('[Social Bridge] SSE connected');
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          switch (event.type) {
            case 'connected':
              setSseConnected(true);
              break;
            case 'extension_ping':
              // Extension just pinged — update extension status locally
              setExtension(prev => ({
                isOnline: true,
                version: prev?.version || null,
                lastPing: new Date().toISOString(),
                connectedPlatforms: event.data?.connectedPlatforms || prev?.connectedPlatforms || []
              }));
              break;
            case 'connection_change':
              // Platforms changed — refetch full connections
              fetchStatus();
              break;
            case 'publish_command':
              // New post queued — refresh history
              fetchHistory();
              break;
            case 'publish_result':
              // Post result received — refresh history for updated statuses
              fetchHistory();
              break;
            case 'training_update':
              fetchTraining();
              break;
            case 'heartbeat':
              // Keep-alive, no action needed
              break;
          }
        } catch (err) {
          console.error('[Social Bridge] SSE parse error:', err);
        }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
        if (eventSource) { try { eventSource.close(); } catch {} }
        eventSource = null;
        sseRef.current = null;
        // Reconnect after 5 seconds
        reconnectTimer = setTimeout(connectSSE, 5000);
      };
    }

    connectSSE();

    // Fallback: poll status every 60s in case SSE drops silently
    const fallbackInterval = setInterval(fetchStatus, 60000);

    // ─── SCHEDULER POLLING: Check for due scheduled posts every 30s ───
    const schedulerInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/social-bridge/scheduler');
        if (res.ok) {
          const data = await res.json();
          if (data.dispatched > 0) {
            console.log(`[Scheduler] ✅ ${data.dispatched} posts dispatched`);
            await fetchHistory();
            await fetchScheduled();
          }
        }
      } catch (e) { console.error('[Scheduler] Poll error:', e); }
    }, 30000);

    return () => {
      if (eventSource) { try { eventSource.close(); } catch {} }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fallbackInterval);
      clearInterval(schedulerInterval);
      sseRef.current = null;
    };
  }, [fetchStatus, fetchHistory, fetchTraining, fetchScheduled]);

  const handlePublish = async () => {
    if (!newPost.platform || !newPost.content) return;
    setPublishing(true);
    try {
      const payload: Record<string, string | null> = {
        platform: newPost.platform,
        content: newPost.content,
        mediaUrl: newPost.mediaUrl || null,
        contentType: newPost.contentType || null,
        source: newPost.source || 'manual',
        scheduledFor: newPost.scheduledFor || null,
      };
      const res = await fetch('/api/social-bridge/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewPost({ platform: '', content: '', mediaUrl: '', contentType: '', source: 'manual', scheduledFor: '' });
        await fetchHistory();
        if (payload.scheduledFor) await fetchScheduled();
      }
    } catch (e) { console.error('Publish error:', e); }
    setPublishing(false);
  };

  const connectedCount = connections.filter(c => c.isConnected).length;
  const filteredPosts = historyFilter === 'all'
    ? posts
    : posts.filter(p => p.status === historyFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
          <Share2 className="w-8 h-8 text-[#B8860B]" />
        </motion.div>
        <span className="ml-3 text-gray-500 font-medium" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.06)' }}>{isEn ? 'Loading Social Bridge...' : 'Cargando Social Bridge...'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1
            className="text-3xl font-black text-[#1A1A1A] flex items-center gap-3 tracking-tight"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1), 0 0 20px rgba(255,215,0,0.1)' }}
          >
            <span className="inline-flex p-2 rounded-xl bg-gradient-to-br from-[#FFD700]/20 to-[#C4622D]/20 border border-[#FFD700]/20" style={{ boxShadow: '0 4px 12px rgba(255,215,0,0.15), 0 2px 4px rgba(0,0,0,0.06)' }}>
              <Share2 className="w-7 h-7 text-[#B8860B]" />
            </span>
            Social Bridge
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-medium flex items-center gap-2" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
            {isEn ? 'Publish to all your social networks from OCTOPUS' : 'Publica en todas tus redes sociales desde OCTOPUS'}
            {activeWorkspace && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                🏢 {activeWorkspace.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              linkedinApi?.connected
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-300'
                : 'bg-gray-50 text-gray-400 border border-gray-200'
            }`}
            animate={{ scale: linkedinApi?.connected ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {linkedinApi?.connected ? <Zap className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {linkedinApi?.connected ? (isEn ? 'API Connected' : 'API Conectada') : (isEn ? 'No connection' : 'Sin conexión')}
          </motion.div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchStatus(); fetchHistory(); }}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> {isEn ? 'Refresh' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Wifi className="w-5 h-5" />}
          label={isEn ? 'Connected Networks' : 'Redes Conectadas'}
          value={connectedCount}
          color="#4ade80"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label={isEn ? 'Published' : 'Publicados'}
          value={stats.published || 0}
          color="#3B82F6"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label={isEn ? 'Queued' : 'En Cola'}
          value={(stats.pending || 0) + (stats.queued || 0)}
          color="#f59e0b"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5" />}
          label={isEn ? 'Errors' : 'Errores'}
          value={stats.failed || 0}
          color="#f87171"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-gray-100 rounded-xl border border-gray-200" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>
        {(['overview', 'publish', 'history', 'scheduler', 'training'] as const).map(tKey => {
          const emoji = tKey === 'overview' ? '📡' : tKey === 'publish' ? '📤' : tKey === 'history' ? '📊' : tKey === 'scheduler' ? '📅' : '🧠';
          const label = tKey === 'overview' ? (isEn ? 'Connections' : 'Conexiones') : tKey === 'publish' ? (isEn ? 'Publish' : 'Publicar') : tKey === 'history' ? (isEn ? 'History' : 'Historial') : tKey === 'scheduler' ? (isEn ? 'Schedule' : 'Programar') : (isEn ? 'Training' : 'Entrenamiento');
          return (
            <button
              key={tKey}
              onClick={() => setTab(tKey)}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                tab === tKey
                  ? 'bg-gradient-to-b from-[#FFD700]/15 to-[#FFD700]/5 text-[#B8860B] border border-[#FFD700]/25'
                  : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-100'
              }`}
              style={tab === tKey ? { boxShadow: '0 2px 8px rgba(255,215,0,0.15), 0 1px 3px rgba(0,0,0,0.08)', textShadow: '0 1px 3px rgba(255,215,0,0.2)' } : { textShadow: '0 1px 1px rgba(0,0,0,0.06)' }}
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-base" style={{ background: tab === tKey ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)', boxShadow: '0 2px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)', transform: 'perspective(200px) rotateX(2deg)' }}>{emoji}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Multi-Platform Extension — Coming Soon */}
            <Card className="p-6 mb-6 relative overflow-hidden border-gray-200/60 bg-gradient-to-br from-gray-50 to-gray-100/50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#C4622D]/10 to-[#FFD700]/10 border border-[#C4622D]/20 mb-2">
                    <Lock className="w-4 h-4 text-[#C4622D]" />
                    <span className="text-sm font-bold text-[#C4622D]">Coming Soon</span>
                  </div>
                  <p className="text-xs text-gray-400">{isEn ? 'Multi-platform extension in development' : 'Extensión multi-plataforma en desarrollo'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4 opacity-40">
                <div className="p-3 rounded-xl bg-gradient-to-br from-[#C4622D]/30 to-[#C4622D]/10">
                  <Chrome className="w-8 h-8 text-[#C4622D]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{isEn ? 'Multi-Platform Extension' : 'Extensión Multi-Plataforma'}</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {isEn ? 'Publish to Twitter/X, Instagram, Facebook, TikTok and more directly from your browser.' : 'Publica en Twitter/X, Instagram, Facebook, TikTok y más directamente desde tu navegador.'}
                  </p>
                  <div className="flex gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-400 text-sm">{isEn ? 'Coming Soon' : 'Próximamente'}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* LinkedIn API Connection Card */}
            <Card className={`p-6 mb-6 border ${linkedinApi?.connected ? 'bg-gradient-to-br from-emerald-50 to-[#0A66C2]/5 border-emerald-300' : 'bg-gradient-to-br from-[#0A66C2]/10 to-[#0A66C2]/5 border-[#0A66C2]/20'}`} style={{ boxShadow: '0 4px 16px rgba(10,102,194,0.1), 0 2px 4px rgba(0,0,0,0.06)' }}>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-[#0A66C2]/30 to-[#0A66C2]/10" style={{ boxShadow: '0 3px 10px rgba(10,102,194,0.15)', transform: 'perspective(200px) rotateX(3deg)' }}>
                  <Linkedin className="w-8 h-8 text-[#0A66C2]" />
                </div>
                <div className="flex-1">
                  {linkedinApi?.connected ? (
                    <>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-[#1A1A1A]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>{isEn ? 'LinkedIn Connected via API' : 'LinkedIn Conectado vía API'}</h3>
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-600"><Zap className="w-3 h-3" /> {isEn ? 'Direct API' : 'API Directa'}</span>
                        {activeWorkspace && (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                            🏢 {activeWorkspace.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        ✅ {isEn ? <>Connected as <strong>{linkedinApi.username}</strong>{activeWorkspace ? ` in workspace "${activeWorkspace.name}"` : ''} — Posts are sent directly via LinkedIn API.</> : <>Conectado como <strong>{linkedinApi.username}</strong>{activeWorkspace ? ` en workspace "${activeWorkspace.name}"` : ''} — Las publicaciones se envían directamente vía API de LinkedIn.</>}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (confirm(isEn ? 'Disconnect LinkedIn?' : '¿Desconectar LinkedIn?')) {
                              await fetch('/api/social-bridge/linkedin/status', { method: 'DELETE' });
                              setLinkedinApi(null);
                              await fetchStatus();
                            }
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-sm hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> {isEn ? 'Disconnect' : 'Desconectar'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-[#1A1A1A]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>{isEn ? 'Connect LinkedIn via API' : 'Conectar LinkedIn vía API'}</h3>
                        {activeWorkspace && (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                            🏢 {activeWorkspace.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        {activeWorkspace 
                          ? (isEn ? `Connect LinkedIn for workspace "${activeWorkspace.name}". Each workspace can have its own LinkedIn account.` : `Conecta LinkedIn para el workspace "${activeWorkspace.name}". Cada workspace puede tener su propia cuenta de LinkedIn.`)
                          : (isEn ? 'Publish directly to LinkedIn without an extension. Connect your LinkedIn account with a single click.' : 'Publica directamente en LinkedIn sin necesidad de extensión. Conecta tu cuenta de LinkedIn con un solo clic.')
                        }
                      </p>
                      <p className="text-xs text-gray-400 mb-4">
                        🔒 {isEn ? 'We use official LinkedIn OAuth 2.0. We only ask permission to post on your behalf. You can disconnect at any time.' : 'Usamos OAuth 2.0 oficial de LinkedIn. Solo pedimos permiso para publicar en tu nombre. Puedes desconectar en cualquier momento.'}
                      </p>
                      <a
                        href={`/api/social-bridge/linkedin/authorize${activeWorkspace?.id ? `?workspaceId=${activeWorkspace.id}` : ''}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white font-medium text-sm transition-colors"
                        style={{ boxShadow: '0 3px 10px rgba(10,102,194,0.25)' }}
                      >
                        <Linkedin className="w-4 h-4" /> {isEn ? `Connect LinkedIn${activeWorkspace?.name ? ` for ${activeWorkspace.name}` : ''}` : `Conectar LinkedIn${activeWorkspace?.name ? ` para ${activeWorkspace.name}` : ''}`}
                      </a>
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* Connected Platforms Grid */}
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>{isEn ? 'Platforms' : 'Plataformas'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(PLATFORMS).map(([key, cfg]) => {
                const conn = connections.find(c => c.platform === key);
                const isLinkedin = key === 'linkedin';
                const isActive = isLinkedin ? (linkedinApi?.connected || conn?.isConnected || false) : (conn?.isConnected || false);
                const isComingSoon = !isLinkedin;
                return (
                  <motion.div
                    key={key}
                    whileHover={isComingSoon ? {} : { scale: 1.03, y: -2 }}
                    className={`relative p-4 rounded-xl border transition-all overflow-hidden ${
                      isLinkedin && isActive
                        ? 'border-[#FFD700] bg-gradient-to-br from-emerald-50 to-[#0A66C2]/5 ring-1 ring-[#FFD700]/30'
                        : isComingSoon
                          ? 'border-gray-200/60 bg-gray-50/80'
                          : 'border-gray-200 bg-white'
                    }`}
                    style={{ boxShadow: isLinkedin && isActive ? '0 4px 20px rgba(184,134,11,0.15), 0 2px 6px rgba(10,102,194,0.1)' : '0 2px 8px rgba(0,0,0,0.04)', transform: 'perspective(800px) rotateX(1deg)' }}
                  >
                    {/* Crown for LinkedIn */}
                    {isLinkedin && (
                      <div className="absolute -top-1 -right-1 z-10">
                        <div className="p-1.5 rounded-bl-lg bg-gradient-to-br from-[#FFD700] to-[#B8860B]" style={{ boxShadow: '0 2px 6px rgba(184,134,11,0.3)' }}>
                          <Crown className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    )}
                    {/* Coming Soon overlay for non-LinkedIn */}
                    {isComingSoon && (
                      <div className="absolute inset-0 bg-white/50 backdrop-blur-[0.5px] z-10 flex items-center justify-center">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200/60">
                          <Lock className="w-3 h-3" /> {isEn ? 'Coming Soon' : 'Próximamente'}
                        </span>
                      </div>
                    )}
                    <div className={`flex items-center gap-3 mb-3 ${isComingSoon ? 'opacity-40' : ''}`}>
                      <div className="p-2.5 rounded-xl" style={{ background: cfg.bg, color: cfg.color, boxShadow: `0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)` }}>
                        {cfg.icon}
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1A1A]">{cfg.label}</p>
                        {isLinkedin && linkedinApi?.username && <p className="text-xs text-gray-400">@{linkedinApi.username}</p>}
                        {!isLinkedin && conn?.username && <p className="text-xs text-gray-400">@{conn.username}</p>}
                      </div>
                    </div>
                    <div className={`flex flex-wrap gap-1 mb-2 ${isComingSoon ? 'opacity-40' : ''}`}>
                      {cfg.contentTypes.map(ct => (
                        <span key={ct} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                          {CONTENT_TYPE_LABELS[ct]?.emoji} {CONTENT_TYPE_LABELS[ct]?.label}
                        </span>
                      ))}
                    </div>
                    <div className={`flex items-center justify-between ${isComingSoon ? 'opacity-40' : ''}`}>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-gray-50 text-gray-300'
                      }`}>
                        {isActive ? (isEn ? '● Connected' : '● Conectada') : (isEn ? '○ Not detected' : '○ No detectada')}
                      </span>
                      {platformStats[key] && (
                        <span className="text-xs text-gray-400">{platformStats[key]} posts</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {tab === 'publish' && (
          <motion.div key="publish" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-6 border-gray-200">
              {/* Banner when content comes from Creative Studio */}
              {newPost.source === 'estudio_creativo' && (newPost.mediaUrl || newPost.content) && (
                <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-[#C4622D]/10 to-[#FFD700]/10 border border-[#C4622D]/20 flex items-center gap-3">
                  <span className="text-2xl">🐙</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#C4622D]">{isEn ? 'Content from Creative Studio' : 'Contenido desde Estudio Creativo'}</p>
                    <p className="text-xs text-[#1A1A1A]/50 truncate">
                      {newPost.mediaUrl ? `📎 ${newPost.contentType === 'video' ? 'Video' : (isEn ? 'Image' : 'Imagen')} ${isEn ? 'attached' : 'adjunto'}` : newPost.content?.substring(0, 80)}
                    </p>
                  </div>
                  {newPost.mediaUrl && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F5F0E8] flex-shrink-0">
                      {newPost.contentType === 'video' ? (
                        <video src={newPost.mediaUrl} className="w-full h-full object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={newPost.mediaUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}
                </div>
              )}
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                <span className="inline-flex p-1.5 rounded-lg" style={{ background: 'rgba(255,215,0,0.1)', boxShadow: '0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)' }}><Send className="w-5 h-5 text-[#B8860B]" /></span> {isEn ? 'New Post' : 'Nueva Publicación'}
              </h3>

              {/* Platform selector */}
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-2 block">{isEn ? 'Platform' : 'Plataforma'}</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(PLATFORMS).map(([key, cfg]) => {
                    const conn = connections.find(c => c.platform === key);
                    const isActive = conn?.isConnected || false;
                    return (
                      <button
                        key={key}
                        onClick={() => setNewPost(p => ({ ...p, platform: key, contentType: cfg.contentTypes[0] || '' }))}
                        disabled={!isActive && key !== 'linkedin'}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border ${
                          newPost.platform === key
                            ? 'border-[#FFD700]/50 bg-[#FFD700]/10 text-[#B8860B]'
                            : isActive
                              ? 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                              : 'border-gray-200 bg-white text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <span style={{ color: newPost.platform === key ? cfg.color : undefined }}>{cfg.icon}</span>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Type Selector */}
              {newPost.platform && PLATFORMS[newPost.platform]?.contentTypes.length > 1 && (
                <div className="mb-4">
                  <label className="text-sm text-gray-500 mb-2 block">{isEn ? 'Content Type' : 'Tipo de Contenido'}</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS[newPost.platform].contentTypes.map(ct => {
                      const info = CONTENT_TYPE_LABELS[ct];
                      const isSelected = newPost.contentType === ct;
                      return (
                        <button
                          key={ct}
                          onClick={() => setNewPost(p => ({ ...p, contentType: ct }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all border ${
                            isSelected
                              ? 'border-[#C4622D]/40 bg-[#C4622D]/10 text-[#C4622D] font-medium'
                              : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <span>{info?.emoji}</span> {info?.label || ct}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-2 block">{isEn ? 'Content' : 'Contenido'}</label>
                <textarea
                  value={newPost.content}
                  onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                  placeholder={isEn ? 'Write your post here...' : 'Escribe tu publicación aquí...'}
                  rows={4}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-[#1A1A1A] placeholder-gray-400 focus:border-[#FFD700]/30 focus:outline-none resize-none"
                />
                <p className="text-xs text-gray-300 mt-1">{newPost.content.length} {isEn ? 'characters' : 'caracteres'}</p>
              </div>

              {/* Media URL */}
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-2 block">{isEn ? 'Media URL (optional)' : 'URL de Media (opcional)'}</label>
                <input
                  value={newPost.mediaUrl}
                  onChange={e => setNewPost(p => ({ ...p, mediaUrl: e.target.value }))}
                  placeholder={isEn ? 'https://i.ytimg.com/vi/C-dmNodsXCc/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLBqKz0QLeLE7h1BUXiogFWFJ9XepA (image or video)' : 'https://i.ytimg.com/vi/NpEaa2P7qZI/mqdefault.jpg (imagen o video)'}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-[#1A1A1A] placeholder-gray-400 focus:border-[#FFD700]/30 focus:outline-none"
                />
              </div>

              {/* Source + Schedule Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Source */}
                <div>
                  <label className="text-sm text-gray-500 mb-2 block flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> {isEn ? 'Source' : 'Fuente'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'manual', label: 'Manual', icon: '✍️' },
                      { key: 'estudio_creativo', label: isEn ? 'Creative Studio' : 'Estudio Creativo', icon: '🐙' },
                      { key: 'ad_factory', label: 'Ad Factory', icon: '🎨' },
                      { key: 'growth_engine', label: 'Growth Engine', icon: '📈' },
                      { key: 'ugc_factory', label: 'UGC Factory', icon: '🎬' },
                    ].map(s => (
                      <button
                        key={s.key}
                        onClick={() => setNewPost(p => ({ ...p, source: s.key }))}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                          newPost.source === s.key
                            ? 'border-[#2D4A3E]/30 bg-[#2D4A3E]/10 text-[#2D4A3E] font-medium'
                            : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        <span>{s.icon}</span> {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Schedule */}
                <div>
                  <label className="text-sm text-gray-500 mb-2 block flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" /> {isEn ? 'Schedule (optional)' : 'Programar (opcional)'}
                  </label>
                  <input
                    type="datetime-local"
                    value={newPost.scheduledFor}
                    onChange={e => setNewPost(p => ({ ...p, scheduledFor: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1A1A1A] text-sm focus:border-[#FFD700]/30 focus:outline-none"
                  />
                  {newPost.scheduledFor && (
                    <p className="text-xs text-[#2D4A3E] mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {isEn ? 'Will be published on ' : 'Se publicará el '}{new Date(newPost.scheduledFor).toLocaleDateString(isEn ? 'en' : 'es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>

              {/* Publish Button */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={handlePublish}
                  disabled={!newPost.platform || !newPost.content || publishing}
                  className="bg-gradient-to-r from-[#C4622D] to-[#FFD700] text-[#1A1A1A] font-bold"
                >
                  {publishing ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {isEn ? 'Sending...' : 'Enviando...'}</>
                  ) : newPost.scheduledFor ? (
                    <><CalendarClock className="w-4 h-4 mr-2" /> {isEn ? 'Schedule' : 'Programar'}</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> {isEn ? 'Publish' : 'Publicar'}</>
                  )}
                </Button>
{/* Extension status hidden - using direct API now */}
              </div>
            </Card>
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Filters + Delete All */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                {['all', 'published', 'pending', 'queued', 'failed'].map(f => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      historyFilter === f
                        ? 'bg-[#FFD700]/10 text-[#B8860B] border border-[#FFD700]/20'
                        : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    {f === 'all' ? (isEn ? 'All' : 'Todos') : STATUS_CONFIG[f]?.label || f}
                  </button>
                ))}
              </div>
              {posts.length > 0 && (
                <button
                  onClick={deleteAllPosts}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {isEn ? 'Delete All' : 'Borrar Todo'}
                </button>
              )}
            </div>

            {/* Posts List */}
            <div className="space-y-3">
              {filteredPosts.length === 0 ? (
                <Card className="p-8 text-center border-gray-200">
                  <Share2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">{isEn ? 'No posts yet' : 'No hay publicaciones aún'}</p>
                </Card>
              ) : filteredPosts.map(post => {
                const platform = PLATFORMS[post.platform];
                const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.pending;
                return (
                  <Card key={post.id} className="p-4 border-gray-200 hover:border-gray-200 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg" style={{ background: platform?.bg, color: platform?.color }}>
                        {platform?.icon || <Share2 className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-[#1A1A1A]">{platform?.label || post.platform}</span>
                          <span
                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                            style={{ color: statusCfg.color, background: `${statusCfg.color}15` }}
                          >
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                          {post.source && (
                            <span className="text-xs text-gray-300 bg-gray-50 px-2 py-0.5 rounded-full">
                              {post.source}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
                        {post.errorMessage && (
                          <p className="text-xs text-red-400 mt-1">⚠️ {post.errorMessage}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-300">
                            {new Date(post.createdAt).toLocaleDateString(isEn ? 'en' : 'es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {post.platformUrl && (
                            <a href={post.platformUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-[#B8860B]/60 hover:text-[#B8860B] flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> {isEn ? 'View post' : 'Ver post'}
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deletePost(post.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                        title={isEn ? 'Delete' : 'Eliminar'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}

        {tab === 'scheduler' && (
          <motion.div key="scheduler" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Scheduler Info */}
            <Card className="p-6 mb-6 bg-gradient-to-br from-blue-500/5 to-[#FFD700]/5 border-blue-300/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-500/15">
                  <CalendarClock className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">📅 {isEn ? 'Scheduled Posts' : 'Publicaciones Programadas'}</h3>
                  <p className="text-sm text-gray-500">
                    {isEn ? 'Schedule your posts for the perfect moment. OCTOPUS will send them automatically when the time comes.' : 'Programa tus publicaciones para el momento perfecto. OCTOPUS las enviará automáticamente cuando llegue la hora.'}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                      <Calendar className="w-3 h-3" /> {scheduledPosts.length} {isEn ? 'scheduled' : 'programadas'}
                    </span>
                    {/* Extension status badge hidden - using direct API now */}
                    <Button
                      onClick={async () => { await fetch('/api/social-bridge/scheduler'); await fetchScheduled(); await fetchHistory(); }}
                      className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> {isEn ? 'Check queue' : 'Verificar cola'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Scheduled Posts Timeline */}
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">⏰ {isEn ? 'Post Queue' : 'Cola de Publicaciones'}</h3>
            {scheduledPosts.length === 0 ? (
              <Card className="p-8 text-center border-gray-200">
                <CalendarClock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">{isEn ? 'No scheduled posts' : 'No hay publicaciones programadas'}</p>
                <p className="text-xs text-gray-300 mt-1">{isEn ? 'Use the Publish tab → "Schedule" field to schedule content' : 'Usa la pestaña Publicar → campo "Programar" para agendar contenido'}</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {scheduledPosts.map(post => {
                  const platform = PLATFORMS[post.platform];
                  const isPaused = post.status === 'paused';
                  const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.queued;
                  return (
                    <Card key={post.id} className={`p-4 transition-all ${isPaused ? 'border-amber-200 bg-amber-50/30' : 'border-blue-100 hover:border-blue-200 bg-blue-50/30'}`}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg" style={{ background: platform?.bg, color: platform?.color }}>
                          {platform?.icon || <Share2 className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm text-[#1A1A1A]">{platform?.label || post.platform}</span>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: `${statusCfg.color}20`, color: statusCfg.color }}>
                              {statusCfg.icon} {statusCfg.label}
                            </span>
                            {post.source && post.source !== 'manual' && (
                              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                {post.source === 'ad_factory' ? '🎨 Ad Factory' : post.source === 'growth_engine' ? '📈 Growth' : post.source === 'ugc_factory' ? '🎬 UGC' : post.source}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {post.scheduledFor ? new Date(post.scheduledFor).toLocaleDateString(isEn ? 'en' : 'es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : (isEn ? 'No date' : 'Sin fecha')}
                            </span>
                            {/* Action Buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditModal(post)}
                                className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition-colors"
                                title={isEn ? 'Edit' : 'Editar'}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => togglePausePost(post)}
                                className={`p-1.5 rounded-lg transition-colors ${isPaused ? 'hover:bg-emerald-100 text-emerald-500' : 'hover:bg-amber-100 text-amber-500'}`}
                                title={isPaused ? (isEn ? 'Resume' : 'Reanudar') : (isEn ? 'Pause' : 'Pausar')}
                              >
                                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => deleteScheduledPost(post.id)}
                                className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                                title={isEn ? 'Delete' : 'Eliminar'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'training' && (
          <motion.div key="training" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Training Header */}
            <Card className="p-6 mb-6 bg-gradient-to-br from-purple-900/10 to-[#FFD700]/5 border-purple-500/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <Brain className="w-8 h-8 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">🧠 {isEn ? 'Advanced Training Mode (Record & Learn)' : 'Training Mode Avanzado (Record & Learn)'}</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {isEn ? 'Teach OCTOPUS how to publish on each social network. Patterns are automatically verified and versioned when platforms change their interface.' : 'Enseña a OCTOPUS cómo publicar en cada red social. Los patrones se verifican automáticamente y se versionan cuando las plataformas cambian su interfaz.'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg text-sm">
                      <p className="font-medium text-[#B8860B] mb-1 flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> {isEn ? 'Automatic Learning' : 'Aprendizaje Automático'}</p>
                      <p className="text-xs text-gray-400">• {isEn ? 'OCTOPUS learns from each post' : 'OCTOPUS aprende de cada publicación'}</p>
                      <p className="text-xs text-gray-400">• {isEn ? 'Detects success patterns' : 'Detecta patrones de éxito'}</p>
                      <p className="text-xs text-gray-400">• {isEn ? 'Optimizes schedules and formats' : 'Optimiza horarios y formatos'}</p>
                      <p className="text-xs text-gray-400">• {isEn ? 'Continuous improvement with each post' : 'Mejora continua con cada post'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm">
                      <p className="font-medium text-purple-500 mb-1 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> {isEn ? 'Automatic Verification' : 'Verificación Automática'}</p>
                      <p className="text-xs text-gray-400">• {isEn ? 'Each pattern has a confidence score' : 'Cada patrón tiene score de confianza'}</p>
                      <p className="text-xs text-gray-400">• {isEn ? 'Consecutive successes → verified pattern ✓' : 'Éxitos consecutivos → patrón verificado ✓'}</p>
                      <p className="text-xs text-gray-400">• {isEn ? 'Failures → pattern flagged for review' : 'Fallos → patrón se marca para revisar'}</p>
                      <p className="text-xs text-gray-400">• {isEn ? 'Continuous improvement via API' : 'Mejora continua vía API'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Patterns Summary Stats */}
            {patterns.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 text-center">
                  <p className="text-2xl font-black text-purple-500">{patterns.length}</p>
                  <p className="text-xs text-gray-400">{isEn ? 'Patterns' : 'Patrones'}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                  <p className="text-2xl font-black text-emerald-500">{patterns.filter(p => p.successCount >= 3).length}</p>
                  <p className="text-xs text-gray-400">{isEn ? 'Verified' : 'Verificados'}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                  <p className="text-2xl font-black text-blue-500">{patterns.reduce((s, p) => s + p.successCount, 0)}</p>
                  <p className="text-xs text-gray-400">{isEn ? 'Total Successes' : 'Éxitos Totales'}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                  <p className="text-2xl font-black text-amber-500">{new Set(patterns.map(p => p.platform)).size}</p>
                  <p className="text-xs text-gray-400">{isEn ? 'Platforms' : 'Plataformas'}</p>
                </div>
              </div>
            )}

            {/* Patterns List */}
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>{isEn ? 'Learned Patterns' : 'Patrones Aprendidos'}</h3>
            {patterns.length === 0 ? (
              <Card className="p-8 text-center border-gray-200">
                <Brain className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">{isEn ? 'No patterns recorded yet' : 'Aún no hay patrones grabados'}</p>
                <p className="text-xs text-gray-300 mt-1">{isEn ? 'Patterns are created automatically when publishing' : 'Los patrones se crean automáticamente al publicar'}</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {patterns.map(p => {
                  const platform = PLATFORMS[p.platform];
                  const totalRuns = p.successCount + p.failCount;
                  const successRate = totalRuns > 0 ? Math.round((p.successCount / totalRuns) * 100) : 0;
                  const isVerified = p.successCount >= 3;
                  const needsRetrain = p.failCount > p.successCount && totalRuns >= 3;
                  return (
                    <Card key={p.id} className={`p-4 transition-all ${needsRetrain ? 'border-red-200 bg-red-50/30' : isVerified ? 'border-emerald-200 bg-emerald-50/20' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: platform?.bg, color: platform?.color }}>
                          {platform?.icon || <Share2 className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[#1A1A1A]">{platform?.label || p.platform}</span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              {p.actionType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-purple-400 bg-purple-50 px-2 py-0.5 rounded-full">v{p.version}</span>
                            {isVerified && (
                              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Shield className="w-3 h-3" /> {isEn ? 'Verified' : 'Verificado'}
                              </span>
                            )}
                            {needsRetrain && (
                              <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {isEn ? 'Retrain' : 'Re-entrenar'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-300">{p.steps.length} {isEn ? 'steps' : 'pasos'}</span>
                            <span className="text-xs text-emerald-600">✓ {p.successCount} {isEn ? 'successes' : 'éxitos'}</span>
                            {p.failCount > 0 && <span className="text-xs text-red-400">✗ {p.failCount} {isEn ? 'failures' : 'fallos'}</span>}
                            {totalRuns > 0 && (
                              <span className="text-xs text-gray-400">{successRate}% {isEn ? 'confidence' : 'confianza'}</span>
                            )}
                          </div>
                          {/* Confidence bar */}
                          {totalRuns > 0 && (
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${successRate >= 70 ? 'bg-emerald-400' : successRate >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${successRate}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Security Info (Phase 6) */}
            <Card className="p-5 mt-6 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border-emerald-200/30">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15">
                  <Shield className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h4 className="font-bold text-[#1A1A1A] mb-1 flex items-center gap-1.5">🛡️ {isEn ? 'Active Anti-Detection' : 'Anti-Detección Activa'}</h4>
                  <p className="text-xs text-gray-500 mb-2">{isEn ? 'Social Bridge includes advanced measures to simulate natural human behavior:' : 'Social Bridge incluye medidas avanzadas para simular comportamiento humano natural:'}</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: '⏱️', label: isEn ? 'Random delays' : 'Delays aleatorios' },
                      { icon: '🖱️', label: isEn ? 'Human scroll' : 'Scroll humano' },
                      { icon: '⌨️', label: isEn ? 'Variable typing' : 'Typing variable' },
                      { icon: '🎭', label: isEn ? 'Rotating profiles' : 'Perfiles rotativos' },
                      { icon: '⏳', label: 'Rate limiting' },
                      { icon: '🔄', label: isEn ? 'Smart retry' : 'Retry inteligente' },
                    ].map(f => (
                      <span key={f.label} className="text-[10px] px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center gap-1">
                        {f.icon} {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setEditingPost(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
                <h3 className="font-bold text-lg text-[#1A1A1A] flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-blue-500" />
                  {isEn ? 'Edit Post' : 'Editar Publicación'}
                </h3>
                <button onClick={() => setEditingPost(null)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Platform Info */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5" style={{ color: PLATFORMS[editingPost.platform]?.color }}>
                    {PLATFORMS[editingPost.platform]?.icon}
                    {PLATFORMS[editingPost.platform]?.label}
                  </span>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{isEn ? 'Content' : 'Contenido'}</label>
                  <textarea
                    value={editForm.content}
                    onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm resize-none"
                    placeholder={isEn ? 'Post content...' : 'Contenido del post...'}
                  />
                </div>

                {/* Scheduled Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{isEn ? 'Scheduled date and time' : 'Fecha y hora programada'}</label>
                  <input
                    type="datetime-local"
                    value={editForm.scheduledFor}
                    onChange={e => setEditForm(prev => ({ ...prev, scheduledFor: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                <Button
                  onClick={() => setEditingPost(null)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  {isEn ? 'Cancel' : 'Cancelar'}
                </Button>
                <Button
                  onClick={saveEditedPost}
                  className="px-4 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isEn ? 'Save changes' : 'Guardar cambios'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════ Sub-Components ═══════════════ */
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="p-4 border-gray-200 hover:border-gray-300 transition-all" style={{ boxShadow: `0 2px 8px rgba(0,0,0,0.06), 0 0 14px ${color}08`, transform: 'perspective(600px) rotateX(1deg)' }}>
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}15`, color, boxShadow: `0 2px 6px ${color}15, 0 1px 2px rgba(0,0,0,0.06)` }}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-black" style={{ color, textShadow: `0 1px 1px rgba(0,0,0,0.08), 0 0 8px ${color}20` }}>{value}</p>
          <p className="text-xs text-gray-400 font-medium" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.06)' }}>{label}</p>
        </div>
      </div>
    </Card>
  );
}