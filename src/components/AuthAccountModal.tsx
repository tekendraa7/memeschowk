import React, { useState } from 'react';
import {
  getRolePermissions,
  LanguageCode,
  MemeAsset,
} from '../lib/domain-logic';
import {
  AuthenticatedCreatorAccount,
  hashPasswordClient,
  loginChowkAccountFromCloud,
  registerChowkAccountInCloud,
  signInWithGoogleAndProvisionProfile,
} from '../lib/firebase-client';
import {
  X,
  UserCheck,
  UserPlus,
  LogIn,
  Shield,
  Heart,
  Bookmark,
  Share2,
  Download,
  Globe,
  LogOut,
  Trash2,
  Lock,
} from 'lucide-react';

interface AuthAccountModalProps {
  currentUser: AuthenticatedCreatorAccount | null;
  assets: MemeAsset[];
  onClose: () => void;
  onAuthenticated: (user: AuthenticatedCreatorAccount) => void;
  onLogout: () => void;
  onDeleteOwnAsset: (assetId: string) => void;
  onInspectAsset: (assetId: string) => void;
}

export const AuthAccountModal: React.FC<AuthAccountModalProps> = ({
  currentUser,
  assets,
  onClose,
  onAuthenticated,
  onLogout,
  onDeleteOwnAsset,
  onInspectAsset,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Registration fields
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState<LanguageCode>('NE');
  const [adminCode, setAdminCode] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await resp.json();
      if (resp.ok && data.user) {
        onAuthenticated({
          ...data.user,
          authSource: 'CHOWK_ACCOUNT',
        });
        onClose();
        return;
      }

      // Fallback check directly against Firestore /chowk_accounts for cross-instance published link accounts
      const cloudAccount = await loginChowkAccountFromCloud(identifier, password);
      if (cloudAccount) {
        onAuthenticated(cloudAccount);
        onClose();
        return;
      }

      setErrorMsg(data.error || 'Invalid email/@handle or password.');
    } catch {
      const cloudAccount = await loginChowkAccountFromCloud(identifier, password).catch(
        () => null
      );
      if (cloudAccount) {
        onAuthenticated(cloudAccount);
        onClose();
        return;
      }
      setErrorMsg('Login failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickCreatorSwitch = async (id: string, pass: string) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: id, password: pass }),
      });
      const data = await resp.json();
      if (resp.ok && data.user) {
        onAuthenticated({
          ...data.user,
          authSource: 'CHOWK_ACCOUNT',
        });
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to switch creator account');
      }
    } catch {
      setErrorMsg('Network error switching account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          handle,
          email,
          password: regPassword,
          primaryLanguage,
          adminCode,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Registration failed');
        return;
      }

      // Also persist to Firestore /chowk_accounts from client so published link & friends share the account
      if (data.user && data.user.role === 'CREATOR') {
        const pwdHash = await hashPasswordClient(regPassword);
        await registerChowkAccountInCloud({
          uid: data.user.uid,
          handle: data.user.handle,
          displayName: data.user.displayName,
          primaryLanguage: data.user.primaryLanguage,
          passwordHash: pwdHash,
        }).catch(() => {});
      }

      onAuthenticated({
        ...data.user,
        authSource: 'CHOWK_ACCOUNT',
      });
      onClose();
    } catch {
      setErrorMsg('Network error during registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const user = await signInWithGoogleAndProvisionProfile(
        handle || undefined,
        primaryLanguage
      );
      onAuthenticated(user);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Google Sign-In popup was closed or blocked. You can also use Email/Handle login below.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const myUploads = currentUser
    ? assets.filter(
        (a) =>
          a.uploaderUid === currentUser.uid ||
          a.uploaderHandle.toLowerCase() === currentUser.handle.toLowerCase()
      )
    : [];

  const totalLikesEarned = myUploads.reduce((acc, a) => acc + (a.likeCount ?? 0), 0);
  const totalFavoritesEarned = myUploads.reduce(
    (acc, a) => acc + (a.favoriteCount ?? 0),
    0
  );
  const totalSharesEarned = myUploads.reduce((acc, a) => acc + (a.shareCount ?? 0), 0);
  const totalDownloadsEarned = myUploads.reduce(
    (acc, a) => acc + (a.downloadCount ?? 0),
    0
  );

  const perms = currentUser ? getRolePermissions(currentUser.role) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="auth-account-modal"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-[#181B22] border border-[#262B36] rounded-2xl max-w-2xl w-full overflow-hidden my-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262B36]">
          <div>
            <p className="text-xs font-semibold text-[#FFB800]">
              Firestore Cloud Sync · Public Creator Accounts & Protected Admin Auth
            </p>
            <h2 className="text-lg font-bold text-[#F3F4F6] mt-0.5">
              {currentUser
                ? `Account Profile — ${currentUser.displayName} (@${currentUser.handle})`
                : mode === 'login'
                ? 'Login to MemeChowk (Share Public Uploads Across Friends & Links)'
                : 'Register Public Creator Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="p-2 rounded-lg bg-[#0F1115] text-[#9CA3AF] hover:text-[#F3F4F6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {currentUser && perms ? (
            <div className="space-y-5">
              {/* Role & Permissions Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  currentUser.role === 'ADMIN'
                    ? 'bg-[#132A1E] border-[#10B981]'
                    : 'bg-[#0F1115] border-[#FFB800]/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    {currentUser.role === 'ADMIN' ? (
                      <Shield className="w-4 h-4 text-[#10B981]" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-[#FFB800]" />
                    )}
                    <span
                      className={
                        currentUser.role === 'ADMIN'
                          ? 'text-[#10B981]'
                          : 'text-[#FFB800]'
                      }
                    >
                      Active Role: {perms.displayLabel.toUpperCase()} ({currentUser.role})
                    </span>
                    <span className="text-[#9CA3AF]">·</span>
                    <span className="text-[#E5E7EB]">@{currentUser.handle}</span>
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    {currentUser.role === 'ADMIN'
                      ? 'Authenticated Admin Session: You have verified access to the Admin Moderation Console, Quarantine Queue, and Takedown controls.'
                      : 'Public Creator Session: Your uploaded audio, video, and GIF files sync directly to Firebase Firestore so your friends on the published link can play, like, favorite, share, and download them. Moderation controls are hidden for public users.'}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="logout-btn"
                  onClick={onLogout}
                  className="px-3.5 py-2 rounded-xl bg-[#2D161E] border border-[#FF4D4D] text-xs font-bold text-[#FF4D4D] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out / Switch User</span>
                </button>
              </div>

              {/* Creator Reputation & Public Engagement Metrics */}
              <div>
                <h3 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-2.5">
                  Your Public Creator Stats (Synced via Firebase Firestore)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#0F1115] border border-[#262B36]">
                    <div className="flex items-center gap-1 text-xs text-[#9CA3AF]">
                      <Globe className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>Public Uploads</span>
                    </div>
                    <div className="text-lg font-extrabold font-mono-tabular text-[#F3F4F6] mt-1">
                      {myUploads.length}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0F1115] border border-[#262B36]">
                    <div className="flex items-center gap-1 text-xs text-[#9CA3AF]">
                      <Heart className="w-3.5 h-3.5 text-[#F43F5E]" />
                      <span>Likes</span>
                    </div>
                    <div className="text-lg font-extrabold font-mono-tabular text-[#F3F4F6] mt-1">
                      {totalLikesEarned}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0F1115] border border-[#262B36]">
                    <div className="flex items-center gap-1 text-xs text-[#9CA3AF]">
                      <Bookmark className="w-3.5 h-3.5 text-[#FFB800]" />
                      <span>Favorites</span>
                    </div>
                    <div className="text-lg font-extrabold font-mono-tabular text-[#F3F4F6] mt-1">
                      {totalFavoritesEarned}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0F1115] border border-[#262B36]">
                    <div className="flex items-center gap-1 text-xs text-[#9CA3AF]">
                      <Share2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                      <span>Shares</span>
                    </div>
                    <div className="text-lg font-extrabold font-mono-tabular text-[#F3F4F6] mt-1">
                      {totalSharesEarned}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0F1115] border border-[#262B36]">
                    <div className="flex items-center gap-1 text-xs text-[#9CA3AF]">
                      <Download className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>Downloads</span>
                    </div>
                    <div className="text-lg font-extrabold font-mono-tabular text-[#F3F4F6] mt-1">
                      {totalDownloadsEarned}
                    </div>
                  </div>
                </div>
              </div>

              {/* My Public Uploads List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-[#F3F4F6]">
                  My Shared Public Uploads ({myUploads.length})
                </h3>
                {myUploads.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] p-4 rounded-xl bg-[#0F1115] border border-[#262B36]">
                    You haven't uploaded any clips under @{currentUser.handle} yet. Upload an audio, video, or GIF and your friends on the published link will immediately see and play it!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {myUploads.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#0F1115] border border-[#262B36] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#F3F4F6] truncate">
                            {item.title}{' '}
                            <span className="text-[#10B981] font-mono">
                              [{item.language} · CLOUD PUBLIC]
                            </span>
                          </div>
                          <div className="text-[#9CA3AF] font-mono-tabular mt-0.5">
                            ♥ {item.likeCount ?? 0} · ★ {item.favoriteCount ?? 0} · ↗{' '}
                            {item.shareCount ?? 0} · ↓ {item.downloadCount ?? 0}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onInspectAsset(item.id);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#181B22] border border-[#262B36] text-[#FFB800] font-semibold cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteOwnAsset(item.id)}
                            title="Delete your upload"
                            className="p-1.5 rounded-lg bg-[#181B22] border border-[#262B36] text-[#9CA3AF] hover:text-[#FF4D4D] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Creator-Only Account Switcher (No public 1-click Admin bypass!) */}
              <div className="pt-3 border-t border-[#262B36] space-y-2">
                <p className="text-xs font-semibold text-[#9CA3AF]">
                  Switch Public Creator Account (Test Friend Perspective):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="switch-creator-aarav"
                    onClick={() => handleQuickCreatorSwitch('aarav_ktm', 'creator123')}
                    className="p-2.5 rounded-xl bg-[#0F1115] hover:bg-[#232834] border border-[#262B36] text-left text-xs cursor-pointer"
                  >
                    <div className="font-bold text-[#FFB800]">@aarav_ktm</div>
                    <div className="text-[11px] text-[#9CA3AF]">Role: PUBLIC CREATOR (NP)</div>
                  </button>
                  <button
                    type="button"
                    data-testid="switch-friend-rohan"
                    onClick={() => handleQuickCreatorSwitch('rohan_delhi', 'friend123')}
                    className="p-2.5 rounded-xl bg-[#0F1115] hover:bg-[#232834] border border-[#262B36] text-left text-xs cursor-pointer"
                  >
                    <div className="font-bold text-[#38BDF8]">@rohan_delhi (Friend)</div>
                    <div className="text-[11px] text-[#9CA3AF]">Role: PUBLIC CREATOR (IN)</div>
                  </button>
                </div>
                <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5 pt-1">
                  <Lock className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>
                    Admin Moderation Console requires logging out and authenticating with Admin credentials or Google Sign-In (<code className="font-mono">pantsubash30@gmail.com</code>).
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Mode Switcher Tabs: Login vs Register */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#0F1115] border border-[#262B36] rounded-xl">
                <button
                  type="button"
                  data-testid="auth-tab-login"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#FFB800] text-[#0F1115]'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login to Account</span>
                </button>
                <button
                  type="button"
                  data-testid="auth-tab-register"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#FFB800] text-[#0F1115]'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register New Account</span>
                </button>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-[#2D161E] border border-[#FF4D4D] text-xs text-[#FCA5A5]"
                >
                  {errorMsg}
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                      Email or Creator @Handle
                    </label>
                    <input
                      data-testid="login-identifier-input"
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Enter your @handle or email address"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                      Password
                    </label>
                    <input
                      data-testid="login-password-input"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="login-submit-btn"
                    className="w-full py-3 rounded-xl bg-[#FFB800] hover:bg-[#e6a600] text-[#0F1115] font-bold text-xs cursor-pointer"
                  >
                    {isSubmitting ? 'Signing In...' : 'Login & Sync Public Cloud Catalog'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                        Display Name
                      </label>
                      <input
                        data-testid="register-name-input"
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., Bikash Gurung"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                        Creator Handle (@handle)
                      </label>
                      <input
                        data-testid="register-handle-input"
                        type="text"
                        required
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="e.g., bikash_pokhara"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                        Email Address
                      </label>
                      <input
                        data-testid="register-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                        Password (4+ chars)
                      </label>
                      <input
                        data-testid="register-password-input"
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Create a password"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                        Preferred Regional Language
                      </label>
                      <select
                        value={primaryLanguage}
                        onChange={(e) => setPrimaryLanguage(e.target.value as LanguageCode)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
                      >
                        <option value="NE">🇳🇵 Nepali (नेपाली)</option>
                        <option value="HI">🇮🇳 Hindi / Hinglish (हिन्दी)</option>
                        <option value="EN">🇬🇧 South Asian English</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                        Admin Secret Passcode (Optional)
                      </label>
                      <input
                        data-testid="register-admin-code-input"
                        type="password"
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        placeholder="Leave blank for Public Creator"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="register-submit-btn"
                    className="w-full py-3 rounded-xl bg-[#10B981] hover:bg-[#0ea572] text-[#0F1115] font-bold text-xs cursor-pointer"
                  >
                    {isSubmitting
                      ? 'Creating Account...'
                      : 'Create Account & Start Uploading to Public Feed'}
                  </button>
                </form>
              )}

              {/* Google Firebase Auth Option */}
              <div className="pt-3 border-t border-[#262B36] space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#232834] hover:bg-[#2E3545] border border-[#262B36] text-xs font-bold text-[#F3F4F6] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-[#FFB800]" />
                  <span>Continue with Google (Verified Firebase Cloud Auth)</span>
                </button>

                {/* Creator-Only Demo Accounts for Testing Friend Sharing */}
                <div className="space-y-1.5">
                  <p className="text-[11px] text-[#9CA3AF]">
                    Quick Public Creator Demo Accounts (for testing friend sharing):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="demo-login-creator"
                      onClick={() => handleQuickCreatorSwitch('aarav_ktm', 'creator123')}
                      className="p-2.5 rounded-xl bg-[#0F1115] hover:bg-[#232834] border border-[#262B36] text-left text-xs cursor-pointer"
                    >
                      <div className="font-bold text-[#FFB800]">@aarav_ktm</div>
                      <div className="text-[10px] text-[#9CA3AF]">Public Creator (You)</div>
                    </button>
                    <button
                      type="button"
                      data-testid="demo-login-friend"
                      onClick={() => handleQuickCreatorSwitch('rohan_delhi', 'friend123')}
                      className="p-2.5 rounded-xl bg-[#0F1115] hover:bg-[#232834] border border-[#262B36] text-left text-xs cursor-pointer"
                    >
                      <div className="font-bold text-[#38BDF8]">@rohan_delhi</div>
                      <div className="text-[10px] text-[#9CA3AF]">Public Creator (Friend)</div>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
