'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListTodo,
  Code,
  Quote,
  Minus,
  Pin,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  X,
  ChevronRight,
  BookOpen,
  Info,
  Cloud,
  CloudUpload,
  Database,
  Loader2,
  Search,
  ExternalLink
} from 'lucide-react';
import {
  fetchLessonNote,
  saveLessonNote,
  deleteLessonNote,
  fetchAllUserNotes,
  LessonNoteData
} from '@/lib/api';

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

// Starter templates for Notion-like notes
const NOTE_TEMPLATES = [
  {
    id: 'summary',
    name: '🎯 Summary & Takeaways',
    generate: (title: string) => `# 📝 Notes: ${title}

> 💡 **Core Takeaway**: Quick 1-line summary of what matters most in this topic.

## 🔑 Key Concepts
- **Concept 1**: 
- **Concept 2**: 

## 💻 Code Patterns & Usage
\`\`\`typescript
// Implementation snippet
\`\`\`

## 🎯 Review Checklist
- [ ] Understand key definitions
- [ ] Implement demo example
- [ ] Review common edge cases
`
  },
  {
    id: 'cheatsheet',
    name: '⚡ Quick Cheat Sheet',
    generate: (title: string) => `# ⚡ Cheat Sheet: ${title}

> 📌 **Quick Reference**: Key functions, APIs, and syntax signatures.

## 🛠️ Syntax & Signatures
- \`apiMethod(config)\`: Description here

## ⚠️ Common Gotchas
> ⚠️ Watch out for: 

## 💡 Best Practices
- [ ] Follow reactive paradigm
- [ ] Clean up subscriptions or resources
`
  },
  {
    id: 'interview',
    name: '💼 Interview Prep Q&A',
    generate: (title: string) => `# 💼 Interview Prep: ${title}

> 🎯 **Level**: Frontend / Fullstack Interview Questions

## Q1: How does this work under the hood?
> 💡 **Answer**: 

## Q2: What are the common trade-offs and performance pitfalls?
- **Trade-off**: 
- **Pitfall**: 

## 🧪 Knowledge Check
- [ ] Can explain in 60 seconds without notes
- [ ] Can write code from scratch
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

  // Quick Reference / All Notes modal state
  const [showAllNotesModal, setShowAllNotesModal] = useState<boolean>(false);
  const [allUserNotes, setAllUserNotes] = useState<LessonNoteData[]>([]);
  const [isLoadingAllNotes, setIsLoadingAllNotes] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedNoteId, setCopiedNoteId] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load note on lesson or course change (Local draft + Neon DB fetch)
  useEffect(() => {
    let isMounted = true;

    // 1. Immediate 0ms local draft restore from localStorage
    let localDraft = '';
    try {
      localDraft = localStorage.getItem(storageKey) || '';
    } catch (e) {}

    setNoteContent(localDraft);

    // 2. Fetch authoritative saved note from Neon DB backend (NO auto-save call!)
    setIsLoadingFromDb(true);
    fetchLessonNote(courseSlug, lessonSlug)
      .then((dbNote) => {
        if (!isMounted) return;
        setIsLoadingFromDb(false);
        if (dbNote && dbNote.content) {
          setLastDbSavedContent(dbNote.content);
          if (dbNote.updatedAt) {
            const timeStr = new Date(dbNote.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setLastSavedDbTime(timeStr);
          }

          // If local draft is empty or equals DB content, sync completely
          if (!localDraft || localDraft === dbNote.content) {
            setNoteContent(dbNote.content);
            setDbStatus('synced');
            try {
              localStorage.setItem(storageKey, dbNote.content);
            } catch (e) {}
          } else {
            // Local draft has edits not yet saved to DB
            setDbStatus('unsaved');
          }
        } else {
          setLastDbSavedContent('');
          setDbStatus(localDraft ? 'unsaved' : 'synced');
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoadingFromDb(false);
          setDbStatus(localDraft ? 'unsaved' : 'synced');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [courseSlug, lessonSlug, storageKey]);

  // Record that this lesson has notes in the global index
  const updateNotesIndex = (hasContent: boolean) => {
    try {
      const raw = localStorage.getItem('skillvault_lessons_with_notes');
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      const key = `${courseSlug}/${lessonSlug}`;
      if (hasContent) {
        set.add(key);
      } else {
        set.delete(key);
      }
      localStorage.setItem('skillvault_lessons_with_notes', JSON.stringify(Array.from(set)));
    } catch (e) {
      // ignore
    }
  };

  // Local draft update (NO API CALL: only caches in localStorage for safety)
  const handleContentChange = (newText: string) => {
    setNoteContent(newText);
    try {
      localStorage.setItem(storageKey, newText);
      updateNotesIndex(Boolean(newText.trim()));
    } catch (e) {}

    // Mark as unsaved if different from database version
    if (newText !== lastDbSavedContent) {
      setDbStatus('unsaved');
    } else {
      setDbStatus('synced');
    }
  };

  // EXPLICIT SAVE TO NEON DB (Only triggers when clicking the Save button or Cmd+S)
  const handleSaveToDatabase = async () => {
    if (isSavingToDb) return;
    setIsSavingToDb(true);

    try {
      const saved = await saveLessonNote(courseSlug, lessonSlug, lessonTitle, noteContent);
      setLastDbSavedContent(noteContent);
      setDbStatus('synced');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedDbTime(timeStr);
      try {
        localStorage.setItem(storageKey, noteContent);
        updateNotesIndex(Boolean(noteContent.trim()));
      } catch (e) {}
    } catch (err) {
      console.error('Failed to save to Neon DB:', err);
      setDbStatus('error');
    } finally {
      setIsSavingToDb(false);
    }
  };

  // Text formatting insertion helper
  const insertFormatting = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = el.value.substring(start, end);
    const insertText = sel || defaultPlaceholder;

    const updated = el.value.substring(0, start) + prefix + insertText + suffix + el.value.substring(end);
    handleContentChange(updated);

    setTimeout(() => {
      el.focus();
      const newCursor = start + prefix.length + insertText.length;
      el.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  // Block insertion helper (ensures newlines)
  const insertBlock = (blockText: string) => {
    const el = textareaRef.current;
    if (!el) {
      const updated = noteContent ? `${noteContent}\n\n${blockText}` : blockText;
      handleContentChange(updated);
      return;
    }

    const start = el.selectionStart;
    const before = el.value.substring(0, start);
    const after = el.value.substring(start);

    const needLeading = before.length > 0 && !before.endsWith('\n');
    const insertion = (needLeading ? '\n\n' : '') + blockText + '\n';
    const updated = before + insertion + after;

    handleContentChange(updated);

    setTimeout(() => {
      el.focus();
      const pos = before.length + insertion.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  // Handle Tab and hotkeys in textarea (Cmd+S / Ctrl+S saves directly to Neon DB!)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const updated = el.value.substring(0, start) + '  ' + el.value.substring(end);
      handleContentChange(updated);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      }, 0);
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', 'bold text');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', 'italic text');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSaveToDatabase();
    }
  };

  // Clip the active topic heading into notes
  const handleClipActiveTopic = () => {
    const activeSub = subtopics[activeSubtopicIndex];
    const heading = activeSub ? activeSub.title : lessonTitle;
    insertBlock(`### ${heading}\n- `);
  };

  // Clip any text currently highlighted on the page into notes as a quote
  const handleClipSelection = () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      insertBlock(`> "${selection}"\n`);
    } else {
      handleClipActiveTopic();
    }
  };

  // Copy entire note
  const handleCopyNote = () => {
    navigator.clipboard.writeText(noteContent);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  // Download note as markdown file
  const handleDownload = () => {
    const blob = new Blob([noteContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lessonSlug}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear note (clears local draft AND deletes from Neon DB)
  const handleClearNote = async () => {
    handleContentChange('');
    setLastDbSavedContent('');
    setDbStatus('synced');
    setShowClearConfirm(false);
    try {
      await deleteLessonNote(courseSlug, lessonSlug);
    } catch (e) {
      // ignore
    }
  };

  // Apply a template
  const applyTemplate = (templateId: string) => {
    const tpl = NOTE_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const generated = tpl.generate(lessonTitle);
    handleContentChange(generated);
    setShowTemplateMenu(false);
    setViewMode('edit');
  };

  // Interactive task list toggle in preview
  const toggleTaskInMarkdown = (targetIndex: number) => {
    let count = 0;
    const updated = noteContent.replace(/^(\s*[-*]\s+)\[([ xX])\]/gm, (match, prefix, check) => {
      if (count++ === targetIndex) {
        const isChecked = check.toLowerCase() === 'x';
        return prefix + (isChecked ? '[ ]' : '[x]');
      }
      return match;
    });
    handleContentChange(updated);
  };

  // Open All Notes / Quick Reference modal
  const handleOpenAllNotesModal = async () => {
    setShowAllNotesModal(true);
    setIsLoadingAllNotes(true);
    try {
      const notes = await fetchAllUserNotes();
      setAllUserNotes(notes);
    } catch (e) {
      setAllUserNotes([]);
    } finally {
      setIsLoadingAllNotes(false);
    }
  };

  // Word count & stats
  const stats = useMemo(() => {
    const trimmed = noteContent.trim();
    if (!trimmed) return { words: 0, chars: 0 };
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    return { words, chars: trimmed.length };
  }, [noteContent]);

  // Width presets
  const handlePresetWidth = (newW: number) => {
    onWidthChange(newW);
    try {
      localStorage.setItem('skillvault_right_sidebar_width', String(newW));
    } catch (e) {}
  };

  // Filtered all notes for search
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

  if (!isOpen) return null;

  return (
    <>
      <aside
        style={{ width: isOverlay ? '100%' : `${width}px` }}
        className={`fixed top-16 bottom-0 right-0 z-40 flex flex-col border-l border-[#30363d] bg-[#12161f] text-slate-200 select-text shadow-2xl transition-all duration-150 ${
          isOverlay ? 'max-w-md md:max-w-lg' : ''
        }`}
      >
        {/* DRAG HANDLE (Left border of right sidebar) - Desktop only */}
        {!isOverlay && onStartDrag && (
          <div
            onMouseDown={onStartDrag}
            onDoubleClick={onResetWidth}
            title="Drag to resize Notes sidebar • Double-click to reset width"
            className={`group absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-50 flex items-center justify-center select-none transition-colors ${
              isDragging ? 'bg-purple-500/30' : 'hover:bg-purple-500/15'
            }`}
          >
            <div
              className={`h-8 w-1 rounded-full transition-all duration-200 ${
                isDragging ? 'bg-purple-400 scale-y-125' : 'bg-slate-600/70 group-hover:bg-purple-400 group-hover:h-10'
              }`}
            />
          </div>
        )}

        {/* 1. TOP HEADER: Navigation Tabs, Save to DB Button & Controls */}
        <div className="shrink-0 border-b border-[#30363d] bg-[#161b22] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Tabs: Notes & Outline */}
            <div className="flex items-center bg-[#0d1117] p-1 rounded-lg border border-[#30363d]/80">
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'notes'
                    ? 'bg-[#7c3aed] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161b22]'
                }`}
              >
                <PenLine className="h-3.5 w-3.5" />
                <span>Notes</span>
                {noteContent.trim() && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      dbStatus === 'unsaved' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </button>

              <button
                onClick={() => setActiveTab('outline')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'outline'
                    ? 'bg-[#7c3aed] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161b22]'
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                <span>Outline</span>
                <span className="text-[10px] opacity-80">({subtopics.length})</span>
              </button>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center gap-1.5">
              {/* EXPLICIT SAVE TO NEON DB BUTTON (No spamming APIs on keystrokes) */}
              {activeTab === 'notes' && (
                <button
                  onClick={handleSaveToDatabase}
                  disabled={isSavingToDb}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shadow-xs ${
                    isSavingToDb
                      ? 'bg-[#21262d] text-slate-400 cursor-wait'
                      : dbStatus === 'unsaved'
                      ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9] ring-2 ring-purple-400/30'
                      : 'bg-[#21262d] text-emerald-400 border border-emerald-500/30 hover:bg-[#30363d]'
                  }`}
                  title="Save notes to Neon DB (Ctrl+S / Cmd+S)"
                >
                  {isSavingToDb ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-300" />
                  ) : dbStatus === 'unsaved' ? (
                    <CloudUpload className="h-3.5 w-3.5 text-purple-100" />
                  ) : (
                    <Cloud className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span>
                    {isSavingToDb ? 'Saving...' : dbStatus === 'unsaved' ? 'Save to DB' : 'Saved'}
                  </span>
                </button>
              )}

              {/* Quick Reference / All Notes Button */}
              <button
                onClick={handleOpenAllNotesModal}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                title="Quick Reference: Browse All Notes in Neon DB"
              >
                <Database className="h-3.5 w-3.5 text-purple-400" />
              </button>

              {/* Width Presets (desktop only) */}
              {!isOverlay && (
                <div className="hidden sm:flex items-center gap-1 border-r border-[#30363d] pr-1.5 mr-0.5">
                  <button
                    onClick={() => handlePresetWidth(width > 450 ? 360 : 540)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#21262d] transition-colors"
                    title={width > 450 ? 'Narrower Panel' : 'Wider Panel'}
                  >
                    {width > 450 ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {/* Close / Collapse Button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                title="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sub-status bar for Notes */}
          {activeTab === 'notes' && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    dbStatus === 'unsaved' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span className="text-slate-300 truncate max-w-[150px]">{lessonTitle}</span>
                {isLoadingFromDb ? (
                  <span className="text-slate-500">• Loading DB...</span>
                ) : isSavingToDb ? (
                  <span className="text-purple-400">• Saving to DB...</span>
                ) : dbStatus === 'unsaved' ? (
                  <span className="text-amber-400">• Unsaved (Press Save to DB)</span>
                ) : lastSavedDbTime ? (
                  <span className="text-emerald-400/90">• Neon DB synced ({lastSavedDbTime})</span>
                ) : (
                  <span className="text-slate-500">• Draft</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 text-slate-500">
                <span>{stats.words} words</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. BODY CONTENT: NOTES VIEW */}
        {activeTab === 'notes' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117]">
            {/* Notion-style Action & Format Toolbar */}
            <div className="shrink-0 border-b border-[#30363d]/80 bg-[#161b22]/90 px-2 py-1.5 flex flex-wrap items-center justify-between gap-1 select-none">
              {/* View Mode Switcher */}
              <div className="flex items-center bg-[#0d1117] p-0.5 rounded border border-[#30363d]">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`p-1 rounded text-xs transition-colors ${
                    viewMode === 'edit' ? 'bg-[#21262d] text-purple-300 font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Edit Markdown"
                >
                  <PenLine className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`p-1 rounded text-xs transition-colors ${
                    viewMode === 'preview' ? 'bg-[#21262d] text-purple-300 font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Rendered Notion Preview"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                {width >= 440 && (
                  <button
                    onClick={() => setViewMode('split')}
                    className={`p-1 rounded text-xs transition-colors ${
                      viewMode === 'split' ? 'bg-[#21262d] text-purple-300 font-medium' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Split Edit & Preview"
                  >
                    <Columns className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Markdown Formatting buttons (visible when editing or split) */}
              {viewMode !== 'preview' && (
                <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-0.5">
                  <button
                    onClick={() => insertFormatting('# ', '', 'Heading 1')}
                    className="px-1.5 py-0.5 text-[11px] font-bold rounded text-slate-300 hover:bg-[#21262d] hover:text-white"
                    title="Heading 1"
                  >
                    H1
                  </button>
                  <button
                    onClick={() => insertFormatting('## ', '', 'Heading 2')}
                    className="px-1.5 py-0.5 text-[11px] font-bold rounded text-slate-300 hover:bg-[#21262d] hover:text-white"
                    title="Heading 2"
                  >
                    H2
                  </button>
                  <button
                    onClick={() => insertFormatting('### ', '', 'Heading 3')}
                    className="px-1.5 py-0.5 text-[11px] font-bold rounded text-slate-300 hover:bg-[#21262d] hover:text-white"
                    title="Heading 3"
                  >
                    H3
                  </button>
                  <div className="h-3 w-px bg-[#30363d] mx-0.5" />
                  <button
                    onClick={() => insertFormatting('**', '**', 'bold')}
                    className="p-1 rounded text-slate-300 hover:bg-[#21262d] hover:text-white"
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => insertFormatting('*', '*', 'italic')}
                    className="p-1 rounded text-slate-300 hover:bg-[#21262d] hover:text-white"
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => insertBlock('- [ ] ')}
                    className="p-1 rounded text-slate-300 hover:bg-[#21262d] hover:text-white"
                    title="Task Checkbox (- [ ])"
                  >
                    <ListTodo className="h-3.5 w-3.5 text-purple-400" />
                  </button>
                  <button
                    onClick={() => insertBlock('- ')}
                    className="p-1 rounded text-slate-300 hover:bg-[#21262d] hover:text-white"
                    title="Bullet List (- )"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => insertBlock('> 💡 **Key Takeaway**: ')}
                    className="p-1 rounded text-amber-400 hover:bg-[#21262d] hover:text-amber-300"
                    title="Notion Callout Box (> 💡)"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => insertFormatting('`', '`', 'code')}
                    className="p-1 rounded text-slate-300 hover:bg-[#21262d] hover:text-white font-mono text-xs"
                    title="Inline Code (`code`)"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => insertBlock('```typescript\n// your code here\n```')}
                    className="px-1 py-0.5 rounded text-[11px] font-mono text-indigo-300 hover:bg-[#21262d] hover:text-white"
                    title="Code Block"
                  >
                    {`{ }`}
                  </button>
                </div>
              )}

              {/* Quick Actions Menu (Clip, Template, Export, Clear) */}
              <div className="flex items-center gap-1">
                {/* Quick Clip Current Subtopic button */}
                <button
                  onClick={handleClipSelection}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#7c3aed]/15 text-purple-300 border border-[#7c3aed]/30 hover:bg-[#7c3aed]/25 hover:text-white transition-colors"
                  title="Clip current subtopic or highlighted text into notes"
                >
                  <Pin className="h-3 w-3" />
                  <span className="hidden sm:inline">Clip Topic</span>
                </button>

                {/* Starter Templates Dropdown Toggle */}
                <div className="relative">
                  <button
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                    title="Insert Template"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>

                  {showTemplateMenu && (
                    <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-[#30363d] bg-[#161b22] p-1.5 shadow-xl z-50">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Starter Templates
                      </div>
                      {NOTE_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => applyTemplate(t.id)}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-[#21262d] hover:text-purple-300 rounded transition-colors"
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
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                  title="Copy all notes"
                >
                  {hasCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>

                {/* Download .md */}
                <button
                  onClick={handleDownload}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                  title="Export as Markdown (.md)"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>

                {/* Clear */}
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-[#21262d] transition-colors"
                  title="Clear notes"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Clear confirmation alert */}
            {showClearConfirm && (
              <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 flex items-center justify-between text-xs text-rose-200">
                <span>Delete note from DB & local draft?</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearNote}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-0.5 rounded bg-[#21262d] text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* MAIN WORKSPACE AREA */}
            <div className="flex-1 overflow-hidden relative">
              {/* VIEW MODE: EDIT ONLY */}
              {viewMode === 'edit' && (
                <div className="h-full flex flex-col p-3">
                  <textarea
                    ref={textareaRef}
                    value={noteContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Type your notes here while reading...\n\nTips:\n• Click "Save to DB" or press Cmd+S to persist to Neon DB\n• Use # for headings, **bold**, *italic*\n• Use - [ ] for interactive to-do checkboxes\n• Use > 💡 for Notion callout boxes\n• Use \`\`\`ts for syntax highlighted code\n• Click "Clip Topic" to auto-insert sections`}
                    className="flex-1 w-full resize-none bg-transparent text-slate-200 text-xs sm:text-sm leading-relaxed font-sans placeholder-slate-600 focus:outline-none border-0 overflow-y-auto selection:bg-[#7c3aed]/40"
                    autoFocus
                  />
                </div>
              )}

              {/* VIEW MODE: PREVIEW ONLY */}
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

              {/* VIEW MODE: SPLIT (Side-by-side or stacked) */}
              {viewMode === 'split' && (
                <div className="h-full flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-[#30363d]">
                  <div className="flex-1 h-1/2 sm:h-full p-3 overflow-hidden flex flex-col">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 select-none">
                      Markdown Editor
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={noteContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type markdown..."
                      className="flex-1 w-full resize-none bg-transparent text-slate-200 text-xs leading-relaxed font-sans placeholder-slate-600 focus:outline-none border-0 overflow-y-auto selection:bg-[#7c3aed]/40"
                    />
                  </div>
                  <div className="flex-1 h-1/2 sm:h-full p-3 sm:p-4 overflow-y-auto bg-[#0a0e17]">
                    <div className="text-[10px] uppercase tracking-wider text-purple-400 font-bold mb-2 select-none">
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

        {/* 3. BODY CONTENT: OUTLINE / TIMELINE VIEW (PRESERVED SUBTOPICS) */}
        {activeTab === 'outline' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="pb-3 border-b border-[#30363d] mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                  <ListOrdered className="h-4 w-4 text-[#7c3aed]" />
                  <span>On This Page (Timeline)</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {subtopics.length} Sections
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Click any subtopic to jump directly to it, or clip it to your notes.
              </p>
            </div>

            {/* Timeline Path */}
            <div className="relative pl-3 space-y-4">
              {/* Vertical Connecting Line */}
              <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-[#30363d]" />

              {subtopics.map((sub, sIdx) => {
                const isCurrent = sIdx === activeSubtopicIndex;
                const isPassed = sIdx < activeSubtopicIndex;

                return (
                  <div
                    key={sub.id}
                    className="group relative flex items-start gap-3 cursor-pointer select-none"
                    onClick={() => onSelectSubtopic(sub.title, sIdx)}
                  >
                    {/* Timeline node bullet */}
                    <div
                      className={`mt-1 h-3.5 w-3.5 rounded-full border-2 transition-all duration-200 shrink-0 z-10 ${
                        isCurrent
                          ? 'bg-[#7c3aed] border-white ring-4 ring-[#7c3aed]/40 scale-110 shadow-lg shadow-[#7c3aed]/50'
                          : isPassed
                          ? 'bg-[#7c3aed] border-[#7c3aed]'
                          : 'bg-[#161b22] border-slate-600 group-hover:border-[#7c3aed]'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div
                          className={`text-xs leading-snug transition-all duration-200 line-clamp-2 ${
                            isCurrent
                              ? 'font-bold text-[#c4b5fd] translate-x-0.5'
                              : isPassed
                              ? 'text-slate-300 font-medium'
                              : 'text-slate-500 group-hover:text-slate-300'
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
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-purple-400 hover:bg-[#21262d] transition-opacity shrink-0"
                          title="Add section to notes"
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                      </div>

                      <div
                        className={`text-[10px] font-mono mt-0.5 transition-colors ${
                          isCurrent ? 'text-indigo-400 font-semibold' : 'text-slate-600'
                        }`}
                      >
                        Step {sIdx + 1}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl text-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-3.5 bg-[#1a202c]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#7c3aed]/20 text-purple-400 border border-[#7c3aed]/30">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Quick Reference: All Notes (Neon DB)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Search and review all your notes saved across courses.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAllNotesModal(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#2d3748] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-[#30363d] bg-[#12161f]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search across all your saved notes..."
                  className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingAllNotes ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400 mb-2" />
                  <span>Loading notes from Neon DB...</span>
                </div>
              ) : filteredAllNotes.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {searchQuery ? 'No notes matched your search query.' : 'No notes saved to database yet. Write a note and click "Save to DB"!'}
                </div>
              ) : (
                filteredAllNotes.map((n) => (
                  <div
                    key={n.id || `${n.courseSlug}-${n.lessonSlug}`}
                    className="p-3.5 rounded-lg border border-[#30363d] bg-[#0d1117] hover:border-purple-500/50 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
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
                          className="p-1 rounded hover:text-white hover:bg-[#21262d] transition-colors"
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
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#21262d] hover:bg-purple-600 hover:text-white text-[11px] font-semibold text-purple-300 transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Markdown snippet */}
                    <p className="text-xs text-slate-400 line-clamp-3 font-mono bg-[#161b22] p-2 rounded border border-[#30363d]/60 leading-relaxed whitespace-pre-wrap">
                      {n.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#30363d] px-5 py-2.5 bg-[#161b22] flex items-center justify-between text-[11px] text-slate-500">
              <span>{filteredAllNotes.length} saved note(s) in Neon PostgreSQL</span>
              <button
                onClick={() => setShowAllNotesModal(false)}
                className="px-3 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-semibold"
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
              <h1 className="text-base sm:text-lg font-bold text-white border-b border-[#30363d] pb-1.5 mt-3 mb-2 tracking-tight">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-sm sm:text-base font-semibold text-purple-200 mt-3 mb-1.5">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xs sm:text-sm font-semibold text-blue-300 mt-2.5 mb-1">
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
                    <CheckSquare className="h-4 w-4 text-purple-400 fill-purple-400/20" />
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
                  className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-purple-300 font-mono text-[11px]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <code {...props}>{children}</code>;
          },
          hr() {
            return <hr className="my-3 border-[#30363d]" />;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-[#30363d]">
                <table className="w-full text-xs text-left text-slate-300">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="bg-[#161b22] px-3 py-2 border-b border-[#30363d] font-semibold text-slate-200">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-1.5 border-b border-[#30363d]/50 bg-[#0d1117]/60">
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
// NOTION CALLOUT BOX (Handles > 💡, > ⚠️, > 📌, > 🚀, etc.)
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
  let colorTheme = 'border-purple-500/40 bg-purple-500/10 text-purple-200';

  if (trimmed.startsWith('💡')) {
    emoji = '💡';
    colorTheme = 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  } else if (trimmed.startsWith('⚠️') || trimmed.toLowerCase().startsWith('warning')) {
    emoji = '⚠️';
    colorTheme = 'border-rose-500/40 bg-rose-500/10 text-rose-200';
  } else if (trimmed.startsWith('📌')) {
    emoji = '📌';
    colorTheme = 'border-blue-500/40 bg-blue-500/10 text-blue-200';
  } else if (trimmed.startsWith('🚀')) {
    emoji = '🚀';
    colorTheme = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  } else if (trimmed.startsWith('ℹ️') || trimmed.startsWith('ℹ')) {
    emoji = 'ℹ️';
    colorTheme = 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200';
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
    <blockquote className="my-2.5 border-l-2 border-[#7c3aed] bg-[#7c3aed]/5 px-3 py-1.5 text-xs italic text-slate-300 rounded-r [&>p]:m-0">
      {children}
    </blockquote>
  );
}

// -------------------------------------------------------------
// NOTION CODE BLOCK (Copyable + Highlighted)
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
    <div className="relative group my-2.5 rounded-md overflow-hidden border border-[#30363d] bg-[#0d1117]">
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#161b22] border-b border-[#30363d]/70 text-[10px] text-slate-400 font-mono">
        <span>{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors px-1.5 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d]"
          title="Copy code"
        >
          {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-2.5 text-xs leading-relaxed overflow-x-auto text-slate-200 font-mono m-0 bg-transparent border-0">
        {children}
      </pre>
    </div>
  );
}

// -------------------------------------------------------------
// EMPTY STATE (Helpful starters)
// -------------------------------------------------------------
function EmptyNoteState({
  onSelectTemplate,
  onClipTopic
}: {
  onSelectTemplate: (tplId: string) => void;
  onClipTopic: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 shadow-lg">
        <PenLine className="h-6 w-6" />
      </div>

      <h3 className="text-sm font-bold text-white mb-1">
        Start Taking Notes
      </h3>
      <p className="text-xs text-slate-400 max-w-xs mb-4">
        Capture takeaways, code snippets, and review questions as you read. Click &quot;Save to DB&quot; to persist to Neon DB.
      </p>

      <div className="w-full max-w-xs space-y-2">
        <button
          onClick={onClipTopic}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold shadow-md transition-all"
        >
          <Pin className="h-3.5 w-3.5" />
          <span>Clip Current Topic</span>
        </button>

        <div className="pt-2 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
          Or start from a template:
        </div>

        {NOTE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t.id)}
            className="w-full text-left px-3 py-2 rounded-lg border border-[#30363d] bg-[#161b22] hover:bg-[#21262d] hover:border-purple-500/40 text-xs text-slate-300 hover:text-white transition-all flex items-center justify-between"
          >
            <span>{t.name}</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>
        ))}
      </div>
    </div>
  );
}
