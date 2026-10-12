'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Lock, Mail, User, Eye, EyeOff, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

export default function AuthModal() {
  const { isAuthModalOpen, authModalView, closeAuthModal, login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(authModalView);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync activeTab when modal view prop changes
  React.useEffect(() => {
    setActiveTab(authModalView);
    setErrorMessage('');
  }, [authModalView, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      if (activeTab === 'login') {
        const result = await login(emailOrUsername, password);
        if (!result.success) {
          setErrorMessage(result.error || 'Failed to sign in. Please verify your credentials.');
        } else {
          // Success: reset form
          setEmailOrUsername('');
          setPassword('');
        }
      } else {
        const result = await register(username, email, password, fullName);
        if (!result.success) {
          setErrorMessage(result.error || 'Registration failed. Please check your details.');
        } else {
          // Success: reset form
          setUsername('');
          setEmail('');
          setPassword('');
          setFullName('');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop click handler */}
      <div className="absolute inset-0" onClick={closeAuthModal} />

      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/[0.12] bg-[#0c1019] p-6 shadow-2xl z-10 transition-all">
        {/* Close button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {activeTab === 'login' ? 'Welcome Back to SkillVault' : 'Create Your SkillVault Account'}
          </h2>
          <p className="mt-1 text-xs text-slate-400 max-w-xs">
            {activeTab === 'login'
              ? 'Access private lesson notes, track syllabus progress, and sync across sessions.'
              : 'Keep notes 100% private and synchronize your progress directly into Neon PostgreSQL.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mb-5 flex rounded-lg bg-[#070a12] p-1 border border-white/[0.08]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage('');
            }}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'login'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMessage('');
            }}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'register'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-400 animate-in fade-in">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'register' && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Full Name <span className="text-slate-500">(Optional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full rounded-lg border border-white/[0.08] bg-[#070a12] pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Username <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. dev_johndoe"
                    className="w-full rounded-lg border border-white/[0.08] bg-[#070a12] pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full rounded-lg border border-white/[0.08] bg-[#070a12] pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'login' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Email or Username <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="Email or Username"
                  className="w-full rounded-lg border border-white/[0.08] bg-[#070a12] pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={activeTab === 'register' ? 'Min. 6 characters' : 'Enter password'}
                className="w-full rounded-lg border border-white/[0.08] bg-[#070a12] pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs focus:outline-none transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{activeTab === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{activeTab === 'login' ? 'Sign In to SkillVault' : 'Create Free Account'}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div className="mt-5 text-center text-xs text-slate-400">
          {activeTab === 'login' ? (
            <>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage('');
                }}
                className="font-semibold text-sky-400 hover:text-sky-300 hover:underline"
              >
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage('');
                }}
                className="font-semibold text-sky-400 hover:text-sky-300 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
