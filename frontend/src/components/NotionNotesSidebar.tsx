'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import {
  FileText,
  ListOrdered,
  Eye,
  PenLine,
  Columns,
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  Heading,
  Bold,
  Italic,
  List,
  ListTodo,
  Code,
  Pin,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  X,
  ChevronRight,
  BookOpen,
  Cloud,
  CloudUpload,
  Database,
  Loader2,
  Search,
  ExternalLink,
  Lock,
  ChevronDown
} from 'lucide-react';
import {
  fetchLessonNote,
  saveLessonNote,
  deleteLessonNote,
  fetchAllUserNotes,
  LessonNoteData
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface SubtopicItem {
  id: string;
  title: string;
  content?: string;
  estimatedMinutes?: number;
}

interface NotionNotesSidebarProps {
  courseSlug: string;
  courseTitle?: string;
  lessonSlug: string;
  lessonTitle: string;
  subtopics: SubtopicItem[];
  activeSubtopicIndex: number;
  onSelectSubtopic: (title: string, index: number) => void;
  width: number;
  onWidthChange: (newWidth: number) => void;
  isOpen: boolean;
  onClose: () => void;
  isDragging?: boolean;
  onStartDrag?: (e: React.MouseEvent) => void;
  onResetWidth?: () => void;
  isOverlay?: boolean;
}

// Curated starter templates for Notion-like notes
const NOTE_TEMPLATES = [
  {
    id: 'summary',
    name: 'Summary & Core Takeaways',
    generate: (title: string) => `# Notes: ${title}

> 💡 **Core Architecture Takeaway**: 

## Key Technical Principles
- **Principle 1**: 
- **Principle 2**: 

## Code Patterns & Implementation
\`\`\`typescript
// Implementation snippet
\`\`\`

## Verification Checklist
- [ ] Understand internal mechanics & lifecycle
- [ ] Account for concurrency & failure modes
- [ ] Benchmark performance trade-offs
`
  },
  {
    id: 'cheatsheet',
    name: 'Quick API Cheat Sheet',
    generate: (title: string) => `# Cheat Sheet: ${title}

> 📌 **Quick Reference**: Key APIs, configurations, and syntax signatures.

## Syntax & Signatures
- \`method(config)\`: Description

## Common Gotchas & Failure Modes
> ⚠️ Warning: 

## Production Best Practices
- [ ] Handle resource cleanup & memory leaks
- [ ] Set appropriate connection pool timeouts
`
  },
  {
    id: 'interview',
    name: 'Senior Interview Prep Q&A',
    generate: (title: string) => `# Interview Deep Dive: ${title}

## Q1: How does this behave under high concurrency or failure?
> 💡 **Rationale**: 

## Q2: What are the engineering trade-offs of this approach?
- **Trade-off A**: 
- **Trade-off B**: 

## Verification Checklist
- [ ] Can articulate failure modes without looking at notes
- [ ] Understand memory & computational complexity
`
  }
];

export default function NotionNotesSidebar({
  courseSlug,
  courseTitle,
  lessonSlug,
  lessonTitle,
  subtopics,
  activeSubtopicIndex,
  onSelectSubtopic,
  width,
  onWidthChange,
  isOpen,
  onClose,
  isDragging = false,
  onStartDrag,
  onResetWidth,
  isOverlay = false,
}: NotionNotesSidebarProps) {
  const { user, isAuthenticated, openAuthModal } = useAuth();

  // Active top tab: 'notes' (default) or 'outline'
  const [activeTab, setActiveTab] = useState<'notes' | 'outline'>('notes');

  // View mode inside Notes: 'edit' | 'preview' | 'split'
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');

  // Note content state
  const storageKey = `skillvault_notes_${courseSlug}_${lessonSlug}`;
  const [noteContent, setNoteContent] = useState<string>('');
  const [lastDbSavedContent, setLastDbSavedContent] = useState<string>('');
  const [isSavingToDb, setIsSavingToDb] = useState<boolean>(false);
  const [isLoadingFromDb, setIsLoadingFromDb] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<'synced' | 'unsaved' | 'error'>('synced');
  const [lastSavedDbTime, setLastSavedDbTime] = useState<string>('');

  const [hasCopied, setHasCopied] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState<boolean>(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState<boolean>(false);

  // Modal state: Browse all notes across database
  const [showAllNotesModal, setShowAllNotesModal] = useState<boolean>(false);
  const [allUserNotes, setAllUserNotes] = useState<LessonNoteData[]>([]);
  const [isLoadingAllNotes, setIsLoadingAllNotes] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedNoteId, setCopiedNoteId] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load note from Database (or fallback to LocalStorage) on lesson switch
  useEffect(() => {
    let isCurrent = true;

    // 1. Instant optimistic restore from local storage
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached !== null) {
        setNoteContent(cached);
      } else {
        setNoteContent('');
      }
    } catch (_) {}

    // 2. Fetch ground truth from Neon PostgreSQL
    setIsLoadingFromDb(true);
    fetchLessonNote(courseSlug, lessonSlug)
      .then((remoteData) => {
        if (!isCurrent) return;
        if (remoteData && remoteData.content) {
          setNoteContent(remoteData.content);
          setLastDbSavedContent(remoteData.content);
          setDbStatus('synced');
          if (remoteData.updatedAt) {
            setLastSavedDbTime(
              new Date(remoteData.updatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })
            );
          }
          try {
            localStorage.setItem(storageKey, remoteData.content);
          } catch (_) {}
        } else {
          // No DB record yet
          setLastDbSavedContent('');
          try {
            const localDraft = localStorage.getItem(storageKey) || '';
            setDbStatus(localDraft ? 'unsaved' : 'synced');
          } catch (_) {}
        }
      })
      .catch(() => {
        if (isCurrent) setDbStatus('synced');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingFromDb(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [courseSlug, lessonSlug, storageKey, isAuthenticated]);

  // Handle local typing: update localStorage immediately and track unsaved status
  const handleContentChange = (newVal: string) => {
    setNoteContent(newVal);
    try {
      localStorage.setItem(storageKey, newVal);
    } catch (_) {}

    if (newVal !== lastDbSavedContent) {
      setDbStatus('unsaved');
    } else {
      setDbStatus('synced');
    }
  };

  // Explicit Save to Database
  const handleSaveToDatabase = useCallback(async () => {
    if (isSavingToDb) return;

    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    setIsSavingToDb(true);
    try {
      const saved = await saveLessonNote(
        courseSlug,
        lessonSlug,
        lessonTitle,
        noteContent
      );
      setLastDbSavedContent(saved.content || noteContent);
      setDbStatus('synced');
      setLastSavedDbTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err) {
      setDbStatus('error');
    } finally {
      setIsSavingToDb(false);
    }
  }, [isSavingToDb, isAuthenticated, openAuthModal, courseSlug, lessonSlug, lessonTitle, noteContent]);

  // Keyboard shortcut: Cmd+S / Ctrl+S saves note
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (isOpen && activeTab === 'notes') {
          e.preventDefault();
          handleSaveToDatabase();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, handleSaveToDatabase]);

  // Text insertion helpers
  const insertFormatting = (prefix: string, suffix = '', placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.substring(start, end) || placeholder;

    const replacement = `${prefix}${selected}${suffix}`;
    const nextVal = current.substring(0, start) + replacement + current.substring(end);

    handleContentChange(nextVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  const insertBlock = (blockText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const current = textarea.value;

    const needsNewlineBefore = start > 0 && current[start - 1] !== '\n';
    const prefix = needsNewlineBefore ? '\n\n' : '';
    const insertion = `${prefix}${blockText}\n`;

    const nextVal = current.substring(0, start) + insertion + current.substring(start);
    handleContentChange(nextVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 10);
  };

  // Clip highlighted text or active topic
  const handleClipSelection = () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      insertBlock(`> 📌 **Clipped from Lesson**:\n> ${selection.split('\n').join('\n> ')}\n`);
    } else {
      const activeTopic = subtopics[activeSubtopicIndex]?.title || lessonTitle;
      insertBlock(`### ${activeTopic}\n- `);
    }
    setViewMode('edit');
  };

  const handleClipActiveTopic = () => {
    const activeTopic = subtopics[activeSubtopicIndex]?.title || lessonTitle;
    insertBlock(`### ${activeTopic}\n- `);
    setViewMode('edit');
  };

  const applyTemplate = (tplId: string) => {
    const tpl = NOTE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    const generated = tpl.generate(lessonTitle);
    const separator = noteContent.trim() ? '\n\n---\n\n' : '';
    handleContentChange(noteContent + separator + generated);
    setShowTemplateMenu(false);
    setViewMode('edit');
  };

  // Copy note to clipboard
  const handleCopyNote = () => {
    if (!noteContent) return;
    navigator.clipboard.writeText(noteContent);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  // Download note as Markdown (.md)
  const handleDownload = () => {
    if (!noteContent) return;
    const blob = new Blob([noteContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lessonSlug}-notes.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Delete note from DB & local draft
  const handleClearNote = async () => {
    handleContentChange('');
    setShowClearConfirm(false);
    try {
      localStorage.removeItem(storageKey);
      if (isAuthenticated) {
        await deleteLessonNote(courseSlug, lessonSlug);
      }
      setLastDbSavedContent('');
      setDbStatus('synced');
    } catch (_) {}
  };

  // Interactive to-do checkbox toggle in rendered preview
  const toggleTaskInMarkdown = (taskIndex: number) => {
    let currentIdx = 0;
    const regex = /^(\s*[-*]\s*\[)([ xX])(\]\s+.*)$/gm;
    const nextVal = noteContent.replace(regex, (match, prefix, checkState, suffix) => {
      if (currentIdx === taskIndex) {
        currentIdx++;
        const nextCheck = checkState === ' ' ? 'x' : ' ';
        return `${prefix}${nextCheck}${suffix}`;
      }
      currentIdx++;
      return match;
    });
    handleContentChange(nextVal);
  };

  // Open All Notes Modal
  const handleOpenAllNotesModal = async () => {
    setShowAllNotesModal(true);
    setIsLoadingAllNotes(true);
    try {
      const data = await fetchAllUserNotes();
      setAllUserNotes(data);
    } catch (_) {
      setAllUserNotes([]);
    } finally {
      setIsLoadingAllNotes(false);
    }
  };

  const filteredAllNotes = useMemo(() => {
    if (!searchQuery.trim()) return allUserNotes;
    const q = searchQuery.toLowerCase();
    return allUserNotes.filter(
      (n) =>
        n.lessonTitle.toLowerCase().includes(q) ||
        n.courseSlug.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  }, [allUserNotes, searchQuery]);

  const stats = useMemo(() => {
    const chars = noteContent.length;
    const words = noteContent.trim() ? noteContent.trim().split(/\s+/).length : 0;
    const lines = noteContent ? noteContent.split('\n').length : 0;
    return { chars, words, lines };
  }, [noteContent]);

  // Width presets
  const handlePresetWidth = (target: number) => {
    onWidthChange(target);
  };

  if (!isOpen) return null;

  return (
    <>
      <aside
        style={{ width: isOverlay ? '100%' : `${width}px` }}
        className={`fixed top-16 bottom-0 right-0 z-40 flex flex-col bg-[#0a0e17] border-l border-white/[0.08] shadow-2xl text-slate-100 ${
          isOverlay ? 'max-w-md w-full' : ''
        }`}
      >
        {/* DRAGGABLE LEFT RESIZE HANDLE (Desktop XL only) */}
        {!isOverlay && onStartDrag && (
          <div
            onMouseDown={onStartDrag}
            onDoubleClick={onResetWidth}
            title="Drag to resize panel • Double-click to reset"
            className={`group absolute top-0 bottom-0 left-0 w-3 -ml-1.5 cursor-col-resize z-50 flex items-center justify-center transition-colors select-none ${
              isDragging ? 'bg-sky-500/20' : 'hover:bg-sky-500/10'
            }`}
          >
            <div
              className={`h-8 w-1 rounded-full transition-all duration-200 ${
                isDragging ? 'bg-sky-400 scale-y-125' : 'bg-slate-700 group-hover:bg-sky-400 group-hover:h-10'
              }`}
            />
          </div>
        )}

        {/* 1. TOP HEADER: Navigation Tabs & Controls */}
        <div className="shrink-0 border-b border-white/[0.06] bg-[#0c1019] px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Clean Segmented Tab Control */}
            <div className="flex items-center bg-[#070a12] p-0.5 rounded-md border border-white/[0.06]">
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  activeTab === 'notes'
                    ? 'bg-white/[0.08] text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PenLine className="h-3 w-3" />
                <span>Notes</span>
                {noteContent.trim() && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      dbStatus === 'unsaved' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </button>

              <button
                onClick={() => setActiveTab('outline')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  activeTab === 'outline'
                    ? 'bg-white/[0.08] text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListOrdered className="h-3 w-3" />
                <span>Outline</span>
                <span className="text-[10px] text-slate-500 font-mono">({subtopics.length})</span>
              </button>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center gap-1.5">
              {/* Save Button */}
              {activeTab === 'notes' && (
                <button
                  onClick={handleSaveToDatabase}
                  disabled={isSavingToDb}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    isSavingToDb
                      ? 'bg-white/[0.06] text-slate-400 cursor-wait'
                      : dbStatus === 'unsaved'
                      ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
                      : 'bg-white/[0.04] text-emerald-400 border border-emerald-500/30 hover:bg-white/[0.06]'
                  }`}
                  title="Save to Neon DB (Cmd+S)"
                >
                  {isSavingToDb ? (
                    <Loader2 className="h-3 w-3 animate-spin text-sky-200" />
                  ) : dbStatus === 'unsaved' ? (
                    <CloudUpload className="h-3 w-3" />
                  ) : (
                    <Cloud className="h-3 w-3 text-emerald-400" />
                  )}
                  <span>{isSavingToDb ? 'Saving...' : dbStatus === 'unsaved' ? 'Save' : 'Saved'}</span>
                </button>
              )}

              {/* Browse All Notes in DB */}
              <button
                onClick={handleOpenAllNotesModal}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Browse All Saved Notes"
              >
                <Database className="h-3.5 w-3.5 text-slate-400 hover:text-sky-400" />
              </button>

              {/* Width Presets (desktop only) */}
              {!isOverlay && (
                <div className="hidden sm:flex items-center gap-1 border-r border-white/[0.06] pr-1.5 mr-0.5">
                  <button
                    onClick={() => handlePresetWidth(width > 450 ? 360 : 540)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title={width > 450 ? 'Narrower Panel' : 'Wider Panel'}
                  >
                    {width > 450 ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Close Notes panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sub-status bar */}
          {activeTab === 'notes' && (
            <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    dbStatus === 'unsaved' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span className="text-slate-300 truncate max-w-[160px]">{lessonTitle}</span>
                {isLoadingFromDb ? (
                  <span className="text-slate-500">• Loading...</span>
                ) : isSavingToDb ? (
                  <span className="text-sky-400">• Syncing...</span>
                ) : dbStatus === 'unsaved' ? (
                  <span className="text-amber-400">• Unsaved</span>
                ) : lastSavedDbTime ? (
                  <span className="text-emerald-400/90">• Synced ({lastSavedDbTime})</span>
                ) : (
                  <span className="text-slate-500">• Local Draft</span>
                )}
              </div>

              <div className="text-slate-500 text-[10px]">
                {stats.words} words
              </div>
            </div>
          )}
        </div>

        {/* 2. BODY CONTENT: NOTES VIEW */}
        {activeTab === 'notes' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0e17]">
            {/* Subtle Local Notice when unauthenticated */}
            {!isAuthenticated && (
              <div className="shrink-0 bg-[#0c1019] border-b border-white/[0.06] px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>Draft saved locally. Sign in to sync across devices.</span>
                </div>
                <button
                  onClick={() => openAuthModal('login')}
                  className="shrink-0 text-sky-400 hover:text-sky-300 font-semibold text-[11px] transition-colors"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Notion-style Clean Toolbar */}
            <div className="shrink-0 border-b border-white/[0.06] bg-[#0c1019] px-2.5 py-1.5 flex items-center justify-between gap-1 select-none">
              {/* Left Segment: View Switcher */}
              <div className="flex items-center bg-[#070a12] p-0.5 rounded border border-white/[0.06]">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`p-1 rounded text-xs transition-colors ${
                    viewMode === 'edit' ? 'bg-white/[0.08] text-sky-400' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Editor"
                >
                  <PenLine className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`p-1 rounded text-xs transition-colors ${
                    viewMode === 'preview' ? 'bg-white/[0.08] text-sky-400' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Preview"
                >
                  <Eye className="h-3 w-3" />
                </button>
                {width >= 440 && (
                  <button
                    onClick={() => setViewMode('split')}
                    className={`p-1 rounded text-xs transition-colors ${
                      viewMode === 'split' ? 'bg-white/[0.08] text-sky-400' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Split View"
                  >
                    <Columns className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Center: Formatting Essentials (Clean, refined) */}
              {viewMode !== 'preview' && (
                <div className="flex items-center gap-1">
                  {/* Headings Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowHeadingMenu(!showHeadingMenu)}
                      className="px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-300 hover:bg-white/[0.06] hover:text-white flex items-center gap-0.5"
                      title="Headings"
                    >
                      <Heading className="h-3 w-3" />
                      <ChevronDown className="h-2.5 w-2.5 text-slate-500" />
                    </button>
                    {showHeadingMenu && (
                      <div className="absolute left-0 top-full mt-1 w-28 rounded-md border border-white/[0.1] bg-[#0c1019] p-1 shadow-xl z-50">
                        <button
                          onClick={() => {
                            insertFormatting('# ', '', 'Heading 1');
                            setShowHeadingMenu(false);
                          }}
                          className="w-full text-left px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.06] rounded"
                        >
                          Heading 1
                        </button>
                        <button
                          onClick={() => {
                            insertFormatting('## ', '', 'Heading 2');
                            setShowHeadingMenu(false);
                          }}
                          className="w-full text-left px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.06] rounded"
                        >
                          Heading 2
                        </button>
                        <button
                          onClick={() => {
                            insertFormatting('### ', '', 'Heading 3');
                            setShowHeadingMenu(false);
                          }}
                          className="w-full text-left px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.06] rounded"
                        >
                          Heading 3
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="h-3 w-px bg-white/[0.06] mx-0.5" />

                  <button
                    onClick={() => insertFormatting('**', '**', 'bold')}
                    className="p-1 rounded text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    title="Bold"
                  >
                    <Bold className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => insertFormatting('*', '*', 'italic')}
                    className="p-1 rounded text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    title="Italic"
                  >
                    <Italic className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => insertFormatting('`', '`', 'code')}
                    className="p-1 rounded text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    title="Inline Code"
                  >
                    <Code className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => insertBlock('- ')}
                    className="p-1 rounded text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    title="Bullet List"
                  >
                    <List className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => insertBlock('- [ ] ')}
                    className="p-1 rounded text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    title="Checklist"
                  >
                    <ListTodo className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => insertBlock('> 💡 **Key Takeaway**: ')}
                    className="p-1 rounded text-amber-400 hover:bg-white/[0.06]"
                    title="Callout Box"
                  >
                    <Sparkles className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Right: Actions */}
              <div className="flex items-center gap-1">
                {/* Clip Topic */}
                <button
                  onClick={handleClipSelection}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/25 hover:bg-sky-500/20 transition-colors"
                  title="Clip current topic into notes"
                >
                  <Pin className="h-3 w-3" />
                  <span className="hidden sm:inline">Clip Topic</span>
                </button>

                {/* Templates Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Templates"
                  >
                    <BookOpen className="h-3 w-3" />
                  </button>

                  {showTemplateMenu && (
                    <div className="absolute right-0 top-full mt-1 w-52 rounded-md border border-white/[0.1] bg-[#0c1019] p-1 shadow-xl z-50">
                      <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Starter Templates
                      </div>
                      {NOTE_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => applyTemplate(t.id)}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white rounded transition-colors"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Copy Markdown */}
                <button
                  onClick={handleCopyNote}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Copy markdown"
                >
                  {hasCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>

                {/* Download */}
                <button
                  onClick={handleDownload}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Download .md"
                >
                  <Download className="h-3 w-3" />
                </button>

                {/* Clear */}
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors"
                  title="Delete note"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Clear Confirmation Banner */}
            {showClearConfirm && (
              <div className="p-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between text-xs text-rose-300">
                <span>Delete note and clear draft?</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearNote}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px]"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-0.5 rounded bg-white/[0.06] text-slate-300 hover:text-white text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* 3. MAIN EDITOR WORKSPACE */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
              {/* EDIT MODE */}
              {viewMode === 'edit' && (
                <div className="flex-1 flex flex-col p-4">
                  <textarea
                    ref={textareaRef}
                    value={noteContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Take notes, jot down code snippets, or clip key topics from the lesson..."
                    className="flex-1 w-full resize-none bg-transparent text-slate-200 text-xs sm:text-sm leading-relaxed font-sans placeholder-slate-600 focus:outline-none border-0 overflow-y-auto selection:bg-sky-500/25"
                    autoFocus
                  />
                  <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-slate-500 select-none">
                    <span>Markdown supported</span>
                    <span>Cmd+S to save</span>
                  </div>
                </div>
              )}

              {/* PREVIEW MODE */}
              {viewMode === 'preview' && (
                <div className="h-full overflow-y-auto p-4 sm:p-5">
                  {noteContent.trim() ? (
                    <NotionRenderedPreview
                      content={noteContent}
                      onToggleTask={toggleTaskInMarkdown}
                    />
                  ) : (
                    <EmptyNoteState onSelectTemplate={applyTemplate} onClipTopic={handleClipActiveTopic} />
                  )}
                </div>
              )}

              {/* SPLIT VIEW */}
              {viewMode === 'split' && (
                <div className="h-full flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                  <div className="flex-1 h-1/2 sm:h-full p-3 overflow-hidden flex flex-col">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-semibold mb-1 select-none">
                      Markdown
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={noteContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      placeholder="Type markdown..."
                      className="flex-1 w-full resize-none bg-transparent text-slate-200 text-xs leading-relaxed font-sans placeholder-slate-600 focus:outline-none border-0 overflow-y-auto selection:bg-sky-500/25"
                    />
                  </div>
                  <div className="flex-1 h-1/2 sm:h-full p-3 sm:p-4 overflow-y-auto bg-[#070a12]">
                    <div className="text-[10px] uppercase tracking-wider text-sky-400 font-mono font-semibold mb-2 select-none">
                      Rendered Preview
                    </div>
                    {noteContent.trim() ? (
                      <NotionRenderedPreview
                        content={noteContent}
                        onToggleTask={toggleTaskInMarkdown}
                      />
                    ) : (
                      <div className="text-xs text-slate-500 italic">No notes written yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. BODY CONTENT: OUTLINE VIEW */}
        {activeTab === 'outline' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#0a0e17]">
            <div className="pb-3 border-b border-white/[0.06] mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  <ListOrdered className="h-3.5 w-3.5 text-sky-400" />
                  <span>On This Page</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {subtopics.length} Sections
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Click any section to jump directly to it, or clip it into your notes.
              </p>
            </div>

            {/* Timeline Path */}
            <div className="relative pl-3 space-y-4">
              {/* Vertical Connecting Line */}
              <div className="absolute left-[17px] top-2 bottom-2 w-px bg-white/[0.1]" />

              {subtopics.map((sub, sIdx) => {
                const isCurrent = sIdx === activeSubtopicIndex;
                const isPassed = sIdx < activeSubtopicIndex;

                return (
                  <div
                    key={sub.id}
                    className="group relative flex items-start gap-3 cursor-pointer select-none"
                    onClick={() => onSelectSubtopic(sub.title, sIdx)}
                  >
                    {/* Timeline node */}
                    <div
                      className={`mt-1 h-3 w-3 rounded-full border transition-all duration-200 shrink-0 z-10 ${
                        isCurrent
                          ? 'bg-sky-400 border-white ring-2 ring-sky-400/30 scale-110'
                          : isPassed
                          ? 'bg-sky-500 border-sky-500'
                          : 'bg-[#0c1019] border-slate-600 group-hover:border-sky-400'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div
                          className={`text-xs leading-snug transition-all duration-200 line-clamp-2 ${
                            isCurrent
                              ? 'font-bold text-white'
                              : isPassed
                              ? 'text-slate-300 font-medium'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        >
                          {sub.title}
                        </div>

                        {/* Clip button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            insertBlock(`### ${sub.title}\n- `);
                            setActiveTab('notes');
                            setViewMode('edit');
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-sky-400 hover:bg-white/[0.06] transition-opacity shrink-0"
                          title="Add section to notes"
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                      </div>

                      <div
                        className={`text-[10px] font-mono mt-0.5 ${
                          isCurrent ? 'text-sky-400 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        Section {sIdx + 1}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {/* QUICK REFERENCE MODAL: BROWSE ALL NOTES IN NEON DB */}
      {showAllNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-white/[0.12] bg-[#0c1019] shadow-2xl text-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5 bg-[#0e1320]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    All Saved Notes (Neon PostgreSQL)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Search and review notes synchronized across all course tracks.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAllNotesModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-white/[0.06] bg-[#0a0e17]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search across all saved notes..."
                  className="w-full rounded-lg border border-white/[0.08] bg-[#070a12] pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                  autoFocus
                />
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingAllNotes ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-400 mb-2" />
                  <span>Loading notes from database...</span>
                </div>
              ) : filteredAllNotes.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {searchQuery ? 'No notes matched your search query.' : 'No notes saved to database yet. Write a note and click Save!'}
                </div>
              ) : (
                filteredAllNotes.map((n) => (
                  <div
                    key={n.id || `${n.courseSlug}-${n.lessonSlug}`}
                    className="p-3.5 rounded-lg border border-white/[0.08] bg-[#070a12] hover:border-white/[0.16] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          {n.courseSlug}
                        </span>
                        <h4 className="text-xs font-bold text-white truncate max-w-sm">
                          {n.lessonTitle || n.lessonSlug}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                        {n.updatedAt && (
                          <span className="font-mono text-[10px] text-slate-500">
                            {new Date(n.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(n.content);
                            setCopiedNoteId(n.id || 1);
                            setTimeout(() => setCopiedNoteId(null), 2000);
                          }}
                          className="p-1 rounded hover:text-white hover:bg-white/[0.06] transition-colors"
                          title="Copy note markdown"
                        >
                          {copiedNoteId === n.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <Link
                          href={`/courses/${n.courseSlug}/${n.lessonSlug}`}
                          onClick={() => setShowAllNotesModal(false)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-[11px] font-semibold text-sky-400 transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Markdown snippet */}
                    <p className="text-xs text-slate-400 line-clamp-3 font-mono bg-[#0c1019] p-2 rounded border border-white/[0.06] leading-relaxed whitespace-pre-wrap">
                      {n.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06] px-5 py-2.5 bg-[#0e1320] flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{filteredAllNotes.length} saved note(s) in Neon PostgreSQL</span>
              <button
                onClick={() => setShowAllNotesModal(false)}
                className="px-3 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// -------------------------------------------------------------
// NOTION RENDERED PREVIEW COMPONENT
// -------------------------------------------------------------
interface NotionRenderedPreviewProps {
  content: string;
  onToggleTask: (index: number) => void;
}

function NotionRenderedPreview({ content, onToggleTask }: NotionRenderedPreviewProps) {
  let taskCounter = 0;

  return (
    <div className="notion-markdown-content space-y-3 text-slate-200 text-xs sm:text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
          h1({ children }) {
            return (
              <h1 className="text-base sm:text-lg font-bold text-white border-b border-white/[0.08] pb-1.5 mt-3 mb-2 tracking-tight">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-sm sm:text-base font-semibold text-white mt-3 mb-1.5">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xs sm:text-sm font-semibold text-sky-400 mt-2.5 mb-1">
                {children}
              </h3>
            );
          },
          p({ children }) {
            return <p className="mb-2 leading-relaxed text-slate-300">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-4 mb-2 space-y-1 text-slate-300">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 mb-2 space-y-1 text-slate-300">{children}</ol>;
          },
          li({ children, className, ...props }: any) {
            const isTask = className?.includes('task-list-item');
            if (isTask) {
              return (
                <li className="flex items-start gap-2 my-1.5 text-slate-200 list-none -ml-4" {...props}>
                  {children}
                </li>
              );
            }
            return <li className="my-1 text-slate-300" {...props}>{children}</li>;
          },
          input({ checked, ...props }: any) {
            if (props.type === 'checkbox') {
              const thisIdx = taskCounter++;
              return (
                <button
                  type="button"
                  onClick={() => onToggleTask(thisIdx)}
                  className="mt-0.5 shrink-0 transition-transform active:scale-90"
                  title="Toggle task"
                >
                  {checked ? (
                    <CheckSquare className="h-4 w-4 text-sky-400 fill-sky-400/20" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-500 hover:text-slate-300" />
                  )}
                </button>
              );
            }
            return <input {...props} />;
          },
          blockquote({ children }) {
            return <NotionCalloutBox>{children}</NotionCalloutBox>;
          },
          pre({ children, ...props }: any) {
            return <NotionCodeBlock {...props}>{children}</NotionCodeBlock>;
          },
          code({ inline, className, children, ...props }: any) {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-sky-300 font-mono text-[11px]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <code {...props}>{children}</code>;
          },
          hr() {
            return <hr className="my-3 border-white/[0.08]" />;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-white/[0.08]">
                <table className="w-full text-xs text-left text-slate-300">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="bg-[#0c1019] px-3 py-2 border-b border-white/[0.08] font-semibold text-slate-200">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-1.5 border-b border-white/[0.04] bg-[#070a12]">
                {children}
              </td>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// -------------------------------------------------------------
// NOTION CALLOUT BOX
// -------------------------------------------------------------
function NotionCalloutBox({ children }: { children: React.ReactNode }) {
  let rawText = '';
  const extract = (node: any) => {
    if (!node) return;
    if (typeof node === 'string') rawText += node;
    else if (Array.isArray(node)) node.forEach(extract);
    else if (React.isValidElement(node)) extract((node.props as any)?.children);
  };
  extract(children);

  const trimmed = rawText.trim();
  let emoji = '';
  let colorTheme = 'border-sky-500/30 bg-sky-500/10 text-sky-200';

  if (trimmed.startsWith('💡')) {
    emoji = '💡';
    colorTheme = 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  } else if (trimmed.startsWith('⚠️') || trimmed.toLowerCase().startsWith('warning')) {
    emoji = '⚠️';
    colorTheme = 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  } else if (trimmed.startsWith('📌')) {
    emoji = '📌';
    colorTheme = 'border-blue-500/30 bg-blue-500/10 text-blue-200';
  } else if (trimmed.startsWith('🚀')) {
    emoji = '🚀';
    colorTheme = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }

  if (emoji) {
    return (
      <div className={`my-2.5 p-3 rounded-lg border flex items-start gap-2.5 ${colorTheme}`}>
        <span className="text-base select-none shrink-0 mt-0.5">{emoji}</span>
        <div className="min-w-0 flex-1 text-xs leading-relaxed [&>p]:m-0">
          {children}
        </div>
      </div>
    );
  }

  return (
    <blockquote className="my-2.5 border-l-2 border-sky-400 bg-sky-500/5 px-3 py-1.5 text-xs italic text-slate-300 rounded-r [&>p]:m-0">
      {children}
    </blockquote>
  );
}

// -------------------------------------------------------------
// NOTION CODE BLOCK
// -------------------------------------------------------------
function NotionCodeBlock({ children, className, ...props }: any) {
  const [copied, setCopied] = useState(false);
  let raw = '';

  const extract = (node: any) => {
    if (!node) return;
    if (typeof node === 'string' || typeof node === 'number') {
      raw += node;
    } else if (Array.isArray(node)) {
      node.forEach(extract);
    } else if (React.isValidElement(node)) {
      extract((node.props as any)?.children);
    }
  };
  extract(children);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(raw.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';

  return (
    <div className="relative group my-2.5 rounded-lg overflow-hidden border border-white/[0.08] bg-[#070a12]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0c1019] border-b border-white/[0.06] text-[10px] text-slate-400 font-mono">
        <span>{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08]"
          title="Copy code"
        >
          {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 text-xs leading-relaxed overflow-x-auto text-slate-200 font-mono m-0 bg-transparent border-0">
        {children}
      </pre>
    </div>
  );
}

// -------------------------------------------------------------
// EMPTY STATE
// -------------------------------------------------------------
function EmptyNoteState({
  onSelectTemplate,
  onClipTopic
}: {
  onSelectTemplate: (tplId: string) => void;
  onClipTopic: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="h-11 w-11 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
        <PenLine className="h-5 w-5" />
      </div>

      <h3 className="text-sm font-bold text-white mb-1">
        Start Taking Notes
      </h3>
      <p className="text-xs text-slate-400 max-w-xs mb-4">
        Capture takeaways, code snippets, and review questions as you read.
      </p>

      <div className="w-full max-w-xs space-y-2">
        <button
          onClick={onClipTopic}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Pin className="h-3.5 w-3.5" />
          <span>Clip Current Topic</span>
        </button>

        <div className="pt-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Or start from a template:
        </div>

        {NOTE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t.id)}
            className="w-full text-left px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0c1019] hover:bg-[#121826] hover:border-white/[0.16] text-xs text-slate-300 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>{t.name}</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>
        ))}
      </div>
    </div>
  );
}
