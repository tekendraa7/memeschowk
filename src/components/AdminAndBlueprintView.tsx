import React, { useState } from 'react';
import {
  calculateMonthlyInfraCosts,
  canPerformModeration,
  MemeAsset,
  ModerationActionRecord,
  UserRole,
} from '../lib/domain-logic';
import { ZeroResultRequestItem } from '../data/seed-assets';
import {
  ShieldCheck,
  AlertTriangle,
  Check,
  X,
  Ban,
  Terminal,
  Database,
  Calculator,
  Lock,
} from 'lucide-react';

interface AdminAndBlueprintViewProps {
  currentRole: UserRole;
  isServerOrFirestoreVerifiedAdmin?: boolean;
  adminVerificationReason?: string;
  onOpenAuthModal: () => void;
  onReturnHome?: () => void;
  assets: MemeAsset[];
  moderationHistory: ModerationActionRecord[];
  zeroResultRequests: ZeroResultRequestItem[];
  onApproveAsset: (assetId: string, verifyCommercialRights: boolean) => void;
  onRejectAsset: (assetId: string, reason: string) => void;
  onTakedownAsset: (assetId: string, reason: string) => void;
  onSimulateThreePrivacyReports: (assetId: string) => void;
}

export const AdminAndBlueprintView: React.FC<AdminAndBlueprintViewProps> = ({
  currentRole,
  isServerOrFirestoreVerifiedAdmin = false,
  adminVerificationReason,
  onOpenAuthModal,
  onReturnHome,
  assets,
  moderationHistory,
  zeroResultRequests,
  onApproveAsset,
  onRejectAsset,
  onTakedownAsset,
  onSimulateThreePrivacyReports,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'moderation' | 'economics' | 'architecture'
  >('moderation');
  const [verifyCommercialCheckbox, setVerifyCommercialCheckbox] = useState<
    Record<string, boolean>
  >({});
  const [simMau, setSimMau] = useState(25000);
  const [simAssets, setSimAssets] = useState(5000);

  const isAuthorized =
    currentRole === 'ADMIN' &&
    canPerformModeration(currentRole) &&
    isServerOrFirestoreVerifiedAdmin;
  const costModel = calculateMonthlyInfraCosts({
    monthlyActiveVisitors: simMau,
    totalApprovedAssets: simAssets,
    vpsUsd: simMau <= 5000 ? 6 : simMau <= 40000 ? 16 : 48,
    moderationNpr: simMau <= 5000 ? 0 : simMau <= 40000 ? 8000 : 25000,
  });

  const pendingOrEmergencyAssets = assets.filter(
    (a) =>
      a.moderationStatus === 'PENDING_REVIEW' ||
      a.moderationStatus === 'UPLOADED_QUARANTINE' ||
      a.moderationStatus === 'UNDER_EMERGENCY_REVIEW'
  );

  if (!isAuthorized) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <div
          role="alert"
          data-testid="rbac-forbidden-banner"
          className="bg-[#2D161E] border border-[#FF4D4D] rounded-2xl p-8 text-center"
        >
          <Lock className="w-10 h-10 text-[#FF4D4D] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[#F3F4F6]">
            HTTP 403 Forbidden — ADMIN Role Required for /admin
          </h2>
          <p className="text-xs text-[#FCA5A5] mt-2 max-w-lg mx-auto">
            {adminVerificationReason ||
              `The /admin Moderation & Governance Console is strictly restricted to authenticated Platform Administrators (role: ADMIN). Public visitors and standard creators (${currentRole}) are blocked by server-side permission checks (/api/admin/verify) and Firestore Security Rules (/admins/{adminId}).`}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="admin-gate-signin-btn"
              onClick={onOpenAuthModal}
              className="px-5 py-2.5 rounded-xl bg-[#FFB800] text-[#0F1115] font-bold text-xs cursor-pointer"
            >
              Sign In with Verified ADMIN Credentials
            </button>
            {onReturnHome && (
              <button
                type="button"
                data-testid="admin-gate-return-home-btn"
                onClick={onReturnHome}
                className="px-4 py-2.5 rounded-xl bg-[#181B22] border border-[#262B36] text-[#F3F4F6] font-semibold text-xs cursor-pointer"
              >
                Return to Public Discover Feed
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Authenticated Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#262B36]">
        <div>
          <p className="text-xs text-[#10B981] font-medium">
            Authenticated Admin Session · Quarantine Verification · Takedown Kill-Switch
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F3F4F6] mt-1">
            Moderation Console & Engineering Blueprint
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-[#132A1E] border border-[#10B981] px-3.5 py-2 rounded-xl text-xs font-bold text-[#10B981]">
          <ShieldCheck className="w-4 h-4" />
          <span>Verified Role: {currentRole}</span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveSubTab('moderation')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'moderation'
              ? 'bg-[#232834] text-[#FFB800] border border-[#FFB800]/50'
              : 'bg-[#181B22] text-[#9CA3AF] border border-[#262B36]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Quarantine & Takedown Queue ({pendingOrEmergencyAssets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('economics')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'economics'
              ? 'bg-[#232834] text-[#FFB800] border border-[#FFB800]/50'
              : 'bg-[#181B22] text-[#9CA3AF] border border-[#262B36]'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Nepal/India Financial & R2 Bandwidth Simulator</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('architecture')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'architecture'
              ? 'bg-[#232834] text-[#FFB800] border border-[#FFB800]/50'
              : 'bg-[#181B22] text-[#9CA3AF] border border-[#262B36]'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Prisma Schema, FFmpeg Worker & Docker Setup</span>
        </button>
      </div>

      {/* TAB 1: MODERATION QUEUE */}
      {activeSubTab === 'moderation' && (
        <div>
          {(
            <div className="space-y-8">
              {/* Pending Quarantine Review Queue */}
              <div className="bg-[#181B22] border border-[#262B36] rounded-2xl p-5">
                <h2 className="text-base font-bold text-[#F3F4F6] mb-1">
                  Quarantine & Emergency Review Queue ({pendingOrEmergencyAssets.length})
                </h2>
                <p className="text-xs text-[#9CA3AF] mb-4">
                  Assets in <code className="font-mono">PENDING_REVIEW</code> or{' '}
                  <code className="font-mono">UNDER_EMERGENCY_REVIEW</code> are blocked from public
                  search and download until you approve them.
                </p>

                {pendingOrEmergencyAssets.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] py-6 text-center">
                    All quarantined uploads have been reviewed.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingOrEmergencyAssets.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-[#0F1115] border border-[#262B36] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-[#FFB800]">
                              {item.moderationStatus}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular text-[#9CA3AF]">
                              SHA256: {item.sha256Hash.slice(0, 12)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#9CA3AF]">
                              Declaration: {item.rightsRecord.sourceDeclaration}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[#F3F4F6]">{item.title}</h3>
                          <p className="text-xs font-deva text-[#E5E7EB]">
                            {item.transcriptDeva} — "{item.transcriptRoman}"
                          </p>

                          {item.rightsRecord.sourceDeclaration !==
                            'THIRD_PARTY_REACTION_CONTEXT' && (
                            <label className="inline-flex items-center gap-2 text-xs text-[#10B981] pt-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(verifyCommercialCheckbox[item.id])}
                                onChange={(e) =>
                                  setVerifyCommercialCheckbox((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.checked,
                                  }))
                                }
                                className="accent-[#10B981]"
                              />
                              <span>
                                Verify Creator Proof (Unlocks Commercial Eligibility on Approval)
                              </span>
                            </label>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onApproveAsset(item.id, Boolean(verifyCommercialCheckbox[item.id]))
                            }
                            className="px-3.5 py-2 rounded-lg bg-[#10B981] text-[#0F1115] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Approve to Public</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onRejectAsset(item.id, 'Rejected in quarantine review')
                            }
                            className="px-3.5 py-2 rounded-lg bg-[#232834] text-[#F3F4F6] hover:bg-[#374151] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Catalog Takedown & Emergency Auto-Lock Controls */}
              <div className="bg-[#181B22] border border-[#262B36] rounded-2xl p-5">
                <h2 className="text-base font-bold text-[#F3F4F6] mb-1">
                  Live Catalog Kill-Switch & Dignity/Privacy Protection
                </h2>
                <p className="text-xs text-[#9CA3AF] mb-4">
                  Execute an immediate <code className="font-mono">TAKEDOWN_REMOVED</code> action
                  (purges public variants and forces HTTP 410 Gone on downloads) or test the
                  3-report privacy auto-quarantine threshold.
                </p>

                <div className="space-y-2.5">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3.5 rounded-xl bg-[#0F1115] border border-[#262B36] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[#F3F4F6]">{asset.title}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#FFB800]">
                            {asset.moderationStatus}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#9CA3AF]">
                            Reports: {asset.reports.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                          Reuse Tier: {asset.rightsRecord.reuseTier} · Commercial:{' '}
                          {asset.rightsRecord.commercialEligible ? 'YES' : 'NO'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {asset.moderationStatus === 'APPROVED_PUBLIC' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onSimulateThreePrivacyReports(asset.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#232834] text-[#F59E0B] border border-[#F59E0B]/40 text-xs font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Simulate 3 Privacy Reports</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onTakedownAsset(
                                  asset.id,
                                  'DMCA / Privacy Takedown executed by Admin'
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#FF4D4D] text-[#0F1115] font-bold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Hard Takedown (HTTP 410)</span>
                            </button>
                          </>
                        )}
                        {asset.moderationStatus === 'TAKEDOWN_REMOVED' && (
                          <span className="text-xs font-mono-tabular text-[#FF4D4D]">
                            REMOVED (410 GONE)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zero-Result Queries & Community Requests */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#181B22] border border-[#262B36] rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-[#F3F4F6] mb-3">
                    Zero-Result Meme Requests (`MemeRequest` Table)
                  </h3>
                  <div className="space-y-2.5">
                    {zeroResultRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-xl bg-[#0F1115] border border-[#262B36] text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-[#F3F4F6]">
                          <span>Query: "{req.queryText}"</span>
                          <span className="font-mono-tabular text-[#FFB800]">
                            {req.upvotes} upvotes · {req.language}
                          </span>
                        </div>
                        <p className="text-[#9CA3AF] mt-1">{req.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#181B22] border border-[#262B36] rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-[#F3F4F6] mb-3">
                    Immutable Moderation Audit Log (`ModerationAction`)
                  </h3>
                  <div className="space-y-2.5">
                    {moderationHistory.slice(0, 6).map((act) => (
                      <div
                        key={act.id}
                        className="p-3 rounded-xl bg-[#0F1115] border border-[#262B36] text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#10B981]">{act.actionType}</span>
                          <span className="font-mono-tabular text-[#9CA3AF]">
                            {act.moderatorName}
                          </span>
                        </div>
                        <p className="text-[#E5E7EB] mt-1">{act.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NEPAL / INDIA FINANCIAL & BANDWIDTH SIMULATOR */}
      {activeSubTab === 'economics' && (
        <div className="bg-[#181B22] border border-[#262B36] rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#F3F4F6]">
              Unit Economics Simulator (Cloudflare R2 $0 Egress vs. AWS S3)
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Test Low (2,500 MAU), Base (25,000 MAU), and High (150,000 MAU) traffic scenarios for
              a student founder in Nepal (Dhangadhi / Kathmandu).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0F1115] border border-[#262B36] rounded-xl p-4">
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-2">
                Monthly Active Visitors (MAU):{' '}
                <strong className="font-mono-tabular text-[#F3F4F6]">
                  {simMau.toLocaleString()}
                </strong>
              </label>
              <input
                type="range"
                min={2500}
                max={150000}
                step={2500}
                value={simMau}
                onChange={(e) => setSimMau(parseInt(e.target.value, 10))}
                className="w-full accent-[#FFB800]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-2">
                Total Approved Assets ($N_assets$):{' '}
                <strong className="font-mono-tabular text-[#F3F4F6]">
                  {simAssets.toLocaleString()}
                </strong>
              </label>
              <input
                type="range"
                min={500}
                max={25000}
                step={500}
                value={simAssets}
                onChange={(e) => setSimAssets(parseInt(e.target.value, 10))}
                className="w-full accent-[#FFB800]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0F1115] border border-[#262B36]">
              <span className="text-xs text-[#9CA3AF]">Object Storage Used</span>
              <div className="text-xl font-bold font-mono-tabular text-[#F3F4F6] mt-1">
                {costModel.storageGb} GB
              </div>
              <span className="text-[11px] text-[#9CA3AF]">R2 Storage: ${costModel.r2StorageUsd}/mo</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0F1115] border border-[#262B36]">
              <span className="text-xs text-[#9CA3AF]">Monthly Bandwidth Egress</span>
              <div className="text-xl font-bold font-mono-tabular text-[#F3F4F6] mt-1">
                {costModel.bandwidthGb} GB
              </div>
              <span className="text-[11px] text-[#10B981]">Cloudflare R2 Egress: $0.00</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0F1115] border border-[#262B36]">
              <span className="text-xs text-[#9CA3AF]">If Hosted on AWS S3 ($0.09/GB)</span>
              <div className="text-xl font-bold font-mono-tabular text-[#FF4D4D] mt-1">
                ${costModel.awsS3BandwidthUsd} / mo
              </div>
              <span className="text-[11px] text-[#9CA3AF]">Saved by R2 zero-egress</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0F1115] border border-[#FFB800]/50">
              <span className="text-xs text-[#FFB800]">Total Monthly Cash Cost (NPR)</span>
              <div className="text-xl font-bold font-mono-tabular text-[#F3F4F6] mt-1">
                NPR {costModel.totalNprR2.toLocaleString()}
              </div>
              <span className="text-[11px] text-[#9CA3AF]">
                Includes VPS (${costModel.totalUsdR2}) + Mod Stipend
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRISMA SCHEMA, FFMPEG WORKER & LINUX DOCKER SETUP */}
      {activeSubTab === 'architecture' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#181B22] border border-[#262B36] rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#FFB800] mb-2">
              <Terminal className="w-4 h-4" />
              <span>Sandboxed FFmpeg EBU R128 Loudness Normalization Command</span>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-xs font-mono text-[#E5E7EB] overflow-x-auto">
{`# Executed via child_process.execFile('ffmpeg', args)
# Network SSRF isolated with -protocol_whitelist file,pipe
ffmpeg -nostdin -y -protocol_whitelist file,pipe \\
  -i quarantine_input.mp3 \\
  -map_metadata -1 -vn \\
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" \\
  -ar 44100 -ac 2 -b:a 128k \\
  staging_normalized.mp3`}
            </pre>
          </div>

          <div className="bg-[#181B22] border border-[#262B36] rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#10B981] mb-2">
              <Database className="w-4 h-4" />
              <span>PostgreSQL 16 Hybrid Cross-Script Query (`pg_trgm` + `SearchAlias`)</span>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-xs font-mono text-[#E5E7EB] overflow-x-auto">
{`SELECT a.id,
  MAX(CASE
    WHEN sa."normalizedAlias" = $1 THEN 1.00
    WHEN sa."normalizedAlias" LIKE $1 || '%' THEN 0.85
    ELSE GREATEST(
      similarity(COALESCE(sa."normalizedAlias",''), $1),
      similarity(LOWER(a.title), $1)
    ) * 0.65
  END) + LEAST(a."trendingScore" * 0.05, 0.25) AS rank_score
FROM "Asset" a
LEFT JOIN "SearchAlias" sa ON sa."assetId" = a.id
WHERE a."moderationStatus" = 'APPROVED_PUBLIC'
GROUP BY a.id ORDER BY rank_score DESC LIMIT 24;`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
